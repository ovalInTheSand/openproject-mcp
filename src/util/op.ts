// src/util/op.ts
import { VERSION } from "../constants/version";
import { log } from "./logger";
// Optional Sentry capture (loaded lazily to avoid mandatory dependency at runtime tests)
let sentryCapture: ((e: unknown, ctx?: Record<string, unknown>) => void) | null = null;
async function capture(e: unknown, ctx?: Record<string, unknown>) {
  try {
    if (!sentryCapture) {
      // dynamic import to keep bundle lean if not used
  const mod: any = await import("../observability/sentry").catch(() => null);
      sentryCapture = mod?.captureError || (() => {});
    }
    sentryCapture && sentryCapture(e, ctx);
  } catch {
    // swallow
  }
}

export type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface Env {
  OP_BASE_URL: string;
  OP_TOKEN: string;
  // Optional observability / hardening
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  SENTRY_SEND_PII?: string;
  SENTRY_ENABLE_LOGS?: string;
  ALLOWED_ORIGINS?: string; // comma-separated
  OP_ALLOW_INSECURE_HTTP?: string; // explicit opt-in for http
}

export type OpCollectionMeta = {
  total?: number;
  count?: number;
  pageSize?: number;
  offset?: number;
  nextOffset?: number | null;
};

export function toId(v: string | number): string {
  return typeof v === "number" ? String(v) : v;
}

export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//.test(path)) {return path;}
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

export function withQuery(u: string, params?: Record<string, unknown>): string {
  if (!params) {return u;}
  const url = new URL(u, "http://dummy");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) {continue;}
    // OpenProject expects JSON-encoded strings for filters/sortBy etc.
    if (k === "filters" || k === "sortBy") {
      const val = typeof v === "string" ? v : JSON.stringify(v);
      url.searchParams.set(k, val);
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  // Drop dummy origin
  return url.pathname + (url.search ? url.search : "");
}

function scrubHeaders(h: HeadersInit | undefined): HeadersInit | undefined {
  if (!h) {return h;}
  const out = new Headers(h as any);
  out.delete("authorization");
  out.delete("Authorization");
  return out;
}

function baseAuthHeader(token: string): string {
  // OpenProject API uses Basic with username 'apikey' and the API key as password.
  const raw = `apikey:${token}`;
  // Use TextEncoder for safe UTF-8 to base64 conversion
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const binaryString = String.fromCharCode(...data);
    return "Basic " + btoa(binaryString);
  } catch (error) {
    throw new Error(`Failed to encode authentication header: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type FetchOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  // Optional query params to append
  params?: Record<string, unknown>;
  // Retry controls
  retries?: number; // default 2
  retryOn?: number[]; // default [429, 500, 502, 503, 504]
  signal?: AbortSignal;
};

const DEFAULT_RETRY = [429, 500, 502, 503, 504];

export async function opFetch<T = any>(
  env: Env,
  path: string,
  opts: FetchOptions = {},
): Promise<{ res: Response; json: T }> {
  let base = env.OP_BASE_URL?.trim();
  if (!base) {throw new Error("OP_BASE_URL not configured");}
  if (!/^https:/.test(base) && env.OP_ALLOW_INSECURE_HTTP !== 'true') {
    throw new Error('Insecure OP_BASE_URL requires OP_ALLOW_INSECURE_HTTP=true');
  }
  const token = env.OP_TOKEN?.trim() || (env as any).OP_API_KEY?.trim();
  if (!token) {throw new Error("OP_TOKEN not configured (expected OP_TOKEN or OP_API_KEY)");}

  // Development host auto-rewrite (placeholder -> fallback) when enabled
  try {
    if (typeof process !== 'undefined' && process.env?.OP_BASE_URL_AUTO_REWRITE === 'true') {
      const placeholderHosts = ['thisistheway.local'];
      const u = new URL(base);
      if (placeholderHosts.includes(u.host)) {
        const fallback = process.env.DEV_HOST_FALLBACK || 'https://127.0.0.1';
        base = fallback.replace(/\/$/, '');
        log.debug('opFetch_host_rewrite', { original: env.OP_BASE_URL, rewritten: base });
      }
    }
  } catch {}

  // Offline test stub: only active for test or explicit dev mode
  const offlineMode = (token === 'test-api-key') && (typeof process !== 'undefined') && ((process.env.NODE_ENV === 'test') || (process.env.DEV_MODE === 'true'));
  if (offlineMode) {
    const synth = (body: any, status = 200) => {
      const res = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/hal+json' } });
      return { res, json: body } as { res: Response; json: T };
    };
    // Normalize path (strip query)
    const clean = path.split('?')[0];
    // Simple routers
    if (/^\/api\/v3\/projects\/(\d+)$/.test(clean)) {
      const id = clean.match(/projects\/(\d+)/)![1];
      return synth({ id: Number(id), name: 'Test Project', identifier: 'test-project', status: 'active' });
    }
    if (/^\/api\/v3\/projects\/(\d+)\/work_packages$/.test(clean)) {
      // Provide two sample work packages
      const now = new Date();
      const day = (d: number) => new Date(now.getTime() + d*86400000).toISOString().slice(0,10);
      return synth({
        _embedded: {
          elements: [
            {
              id: 101,
              subject: 'Initial Planning',
              percentageDone: 80,
              estimatedTime: 'PT40H',
              spentTime: 'PT32H',
              startDate: day(-14),
              dueDate: day(-2),
              status: { name: 'In Progress', isClosed: false },
              type: { name: 'Task' },
              assignee: { name: 'User One' },
              _links: {
                status: { href: '/api/v3/statuses/1' },
                type: { href: '/api/v3/types/1' },
                assignee: { href: '/api/v3/users/1' }
              }
            },
            {
              id: 102,
              subject: 'Execution Phase',
              percentageDone: 20,
              estimatedTime: 'PT80H',
              spentTime: 'PT8H',
              startDate: day(-1),
              dueDate: day(20),
              status: { name: 'In Progress', isClosed: false },
              type: { name: 'Task' },
              assignee: { name: 'User Two' },
              _links: {
                status: { href: '/api/v3/statuses/1' },
                type: { href: '/api/v3/types/1' },
                assignee: { href: '/api/v3/users/2' }
              }
            }
          ]
        },
        total: 2, count: 2, offset: 0, pageSize: 2
      });
    }
    if (clean === '/api/v3/time_entries') {
      return synth({
        _embedded: {
          elements: [
            {
              id: 201,
              hours: 8,
              spentOn: new Date().toISOString().slice(0,10),
              user: { name: 'User One' },
              project: { name: 'Test Project' },
              workPackage: { subject: 'Initial Planning' },
              _links: {
                user: { href: '/api/v3/users/1' },
                project: { href: '/api/v3/projects/1' },
                workPackage: { href: '/api/v3/work_packages/101' }
              }
            }
          ]
        }
      });
    }
    if (/^\/api\/v3\/projects\/(\d+)\/budgets$/.test(clean)) {
      return synth({ _embedded: { elements: [ { id: 301, subject: 'Main Budget'} ] } });
    }
    if (clean === '/api/v3/statuses') {
      return synth({ _embedded: { elements: [ { id: 1, name: 'In Progress', isClosed: false }, { id: 2, name: 'Closed', isClosed: true } ] } });
    }
    if (clean === '/api/v3/priorities') {
      return synth({ _embedded: { elements: [ { id: 1, name: 'Normal' }, { id: 2, name: 'High' } ] } });
    }
    if (/^\/api\/v3\/projects\/(\d+)\/memberships$/.test(clean)) {
      return synth({ _embedded: { elements: [ { id: 1, user: { id: 1, name: 'User One'} }, { id: 2, user: { id: 2, name: 'User Two'} } ] } });
    }
    if (/^\/api\/v3\/users\/(\d+)$/.test(clean)) {
      const id = clean.match(/users\/(\d+)/)![1];
      return synth({ id: Number(id), name: `User ${id}` });
    }
    // Default generic ok response
  return synth({ ok: true, path: clean });
  }

  // Egress allowlist: default allow only OP_BASE_URL host; can extend via MCP_EGRESS_ALLOW (comma list)
  try {
    const allowEnv = (globalThis as any).ENV?.MCP_EGRESS_ALLOW || (env as any).MCP_EGRESS_ALLOW;
    const allowHosts = [new URL(base).host, ...(allowEnv ? String(allowEnv).split(',').map((s) => s.trim()).filter(Boolean) : [])];
    // If path is absolute URL ensure it's in allowlist
    if (/^https?:\/\//i.test(path)) {
      const host = new URL(path).host;
      if (!allowHosts.includes(host)) {
        throw new Error(`egress_blocked: host ${host} not in allowlist`);
      }
    }
  } catch (egressErr) {
    if (egressErr instanceof Error && egressErr.message.startsWith('egress_blocked')) {throw egressErr;}
    // If URL parsing fails, continue; downstream will surface meaningful errors.
  }

  const url = joinUrl(base, withQuery(path, opts.params));
  const headers = new Headers({
    Accept: "application/hal+json; charset=utf-8",
    "Accept-Encoding": "gzip, deflate, br",
    Authorization: baseAuthHeader(token),
  "User-Agent": `openproject-mcp/${VERSION} (+mcp +webhooks +realtime)`,
  });

  // Merge provided headers (but keep our Authorization)
  if (opts.headers) {
    const headerObj = new Headers(opts.headers as any);
    headerObj.forEach((v, k) => {
      if (/^authorization$/i.test(k)) {return;} // do not allow override
      headers.set(k, v);
    });
  }
  // Default content-type if a plain JSON body is provided
  const method = (opts.method ?? (opts.body ? "POST" : "GET")).toUpperCase();
  if (opts.body && !(headers.has("content-type") || headers.has("Content-Type"))) {
    if (typeof opts.body === "string" || opts.body instanceof Blob) {
      // Keep as-is; caller can set content-type for multipart etc.
    } else {
      headers.set("Content-Type", "application/json; charset=utf-8");
    }
  }

  const retries = opts.retries ?? 2;
  const retryOn = opts.retryOn ?? DEFAULT_RETRY;

  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= retries) {
    try {
  const signal = opts.signal || (env as any).MCP_ABORT_SIGNAL;
  const res = await fetch(url, { method, headers, body: opts.body ?? null, signal });
      if (retryOn.includes(res.status) && attempt < retries) {
        const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
        const jitter = Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, backoff + jitter));
        attempt++;
        continue;
      }
      let json: any = null;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        json = await res.json();
      } else if (ct.includes("application/hal+json")) {
        json = await res.json();
      } else if (ct) {
        // Fallback: try json
        try {
          json = await res.json();
        } catch {
          json = null;
        }
      }

      if (!res.ok) {
        // Surface upstream error details to caller—this proved vital during Inspector usage
        const msg = (json && (json.message || json.error || JSON.stringify(json))) || `HTTP ${res.status}`;
        const e = new Error(`OpenProject error: ${msg}`);
        (e as any).status = res.status;
        (e as any).body = json;
        throw e;
      }

      // ✅ Correct type assertion placement (assert the whole object or json separately)
  log.debug('opFetch_success', { url, status: res.status, offline: offlineMode });
  return { res, json } as { res: Response; json: T };
    } catch (e) {
  lastErr = e;
  log.warn('opFetch_retry', { url, attempt, error: e instanceof Error ? e.message : String(e) });
      if (attempt >= retries) {break;}
      attempt++;
    }
  }

  const err = lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  const scrubbed = scrubHeaders(headers);
  const headerObj: Record<string, string> = {};
  if (scrubbed) {
    new Headers(scrubbed).forEach((v, k) => {
      headerObj[k] = v;
    });
  }
  (err as any).request = { url, method, headers: headerObj };
  log.error('opFetch_fail', { url, error: err.message });
  // Best-effort capture
  capture(err, { url, method });
  throw err;
}

export function parseCollectionMeta(body: any): OpCollectionMeta {
  const total = typeof body?.total === "number" ? body.total : undefined;
  const count = typeof body?.count === "number" ? body.count : undefined;
  const pageSize = typeof body?.pageSize === "number" ? body.pageSize : undefined;
  const offset = typeof body?.offset === "number" ? body.offset : undefined;
  const nextOffset =
    typeof total === "number" && typeof pageSize === "number" && typeof offset === "number"
      ? (offset + pageSize < total ? offset + pageSize : null)
      : undefined;
  return { total, count, pageSize, offset, nextOffset };
}

// Small helpers for building HAL _links payloads
export const hal = {
  project(id: string | number) {
    return { href: `/api/v3/projects/${toId(id)}` };
  },
  type(id: string | number) {
    return { href: `/api/v3/types/${toId(id)}` };
  },
  user(id: string | number) {
    return { href: `/api/v3/users/${toId(id)}` };
  },
  status(id: string | number) {
    return { href: `/api/v3/statuses/${toId(id)}` };
  },
  priority(id: string | number) {
    return { href: `/api/v3/priorities/${toId(id)}` };
  },
  workPackage(id: string | number) {
    return { href: `/api/v3/work_packages/${toId(id)}` };
  },
};
