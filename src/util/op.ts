// src/util/op.ts

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
  if (/^https?:\/\//.test(path)) return path;
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

export function withQuery(u: string, params?: Record<string, unknown>): string {
  if (!params) return u;
  const url = new URL(u, "http://dummy");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
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
  if (!h) return h;
  const out = new Headers(h as any);
  out.delete("authorization");
  out.delete("Authorization");
  return out;
}

function baseAuthHeader(token: string): string {
  // OpenProject API uses Basic with username 'apikey' and the API key as password.
  const raw = `apikey:${token}`;
  // btoa is available in Workers runtime
  return "Basic " + btoa(raw);
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
};

const DEFAULT_RETRY = [429, 500, 502, 503, 504];

export async function opFetch<T = any>(
  env: Env,
  path: string,
  opts: FetchOptions = {},
): Promise<{ res: Response; json: T }> {
  const base = env.OP_BASE_URL?.trim();
  if (!base) throw new Error("OP_BASE_URL not configured");
  const token = env.OP_TOKEN?.trim();
  if (!token) throw new Error("OP_TOKEN not configured");

  const url = joinUrl(base, withQuery(path, opts.params));
  const headers = new Headers({
    Accept: "application/hal+json; charset=utf-8",
    Authorization: baseAuthHeader(token),
    "User-Agent": "openproject-mcp/0.3.0 (+mcp)",
  });

  // Merge provided headers (but keep our Authorization)
  if (opts.headers) {
    const headerObj = new Headers(opts.headers as any);
    headerObj.forEach((v, k) => {
      if (/^authorization$/i.test(k)) return; // do not allow override
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
      const res = await fetch(url, { method, headers, body: opts.body ?? null });
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
      return { res, json } as { res: Response; json: T };
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) break;
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
