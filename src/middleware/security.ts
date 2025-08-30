// src/middleware/security.ts
import type { Context, Next } from 'hono';
import { recordRequest, recordRateLimited } from '../observability/metrics';

// In-memory rate limit store (per process). For production, replace with durable store.
type RateRecord = { count: number; reset: number };
const rateMap = new Map<string, RateRecord>();

export interface SecurityOptions {
  requestsPerWindow: number;      // e.g. 100
  windowMs: number;               // e.g. 60_000
  maxBodyBytes: number;           // e.g. 128 * 1024
  requireAuthHeader?: boolean;    // if MCP_SERVER_TOKEN set
}

function readInt(env: any, key: string, fallback: number): number {
  const raw = env?.[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function securityMiddleware(base: SecurityOptions) {
  // HMAC / nonce replay store
  type NonceRec = { ts: number };
  const nonceCache = new Map<string, NonceRec>();
  function prune(max: number) { if (nonceCache.size <= max) return; let i=0; for (const k of nonceCache.keys()) { nonceCache.delete(k); if (++i >= (nonceCache.size-max)) break; } }
  function timingSafe(a: string,b: string){ if(a.length!==b.length)return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }
  async function verifyHmac(raw: string, c: Context) {
    const secret = (c.env as any)?.MCP_HMAC_SECRET; if (!secret) return null;
    const sig = c.req.header('x-mcp-signature'); const tsStr = c.req.header('x-mcp-timestamp'); const nonce = c.req.header('x-mcp-nonce');
    if (!sig || !tsStr || !nonce) return { code: 'missing_signature', message: 'Missing HMAC headers' };
    if (!sig.startsWith('v1=')) return { code: 'bad_signature', message: 'Unsupported signature format' };
    const ts = parseInt(tsStr,10); if(!Number.isFinite(ts)) return { code: 'bad_signature', message: 'Invalid timestamp' };
    const skew = parseInt((c.env as any)?.MCP_HMAC_MAX_SKEW_SEC||'300',10)||300; const now=Math.floor(Date.now()/1000);
    if (Math.abs(now-ts) > skew) return { code: 'stale_timestamp', message: 'Timestamp outside allowed skew' };
    const limit = parseInt((c.env as any)?.MCP_HMAC_NONCE_CACHE_SIZE||'1000',10)||1000; if (nonceCache.has(nonce)) return { code:'replay_nonce', message:'Nonce replay detected' };
    const enc = new TextEncoder(); const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
    const data = enc.encode(`${ts}.${nonce}.${raw}`); const sigBuf = await crypto.subtle.sign('HMAC', key, data);
    const calc = Array.from(new Uint8Array(sigBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const provided = sig.slice(3);
    if (!timingSafe(calc, provided)) return { code: 'bad_signature', message: 'Signature mismatch' };
    prune(limit); nonceCache.set(nonce,{ts}); return null;
  }

  interface GuardLimits { maxArray:number; maxString:number; maxDepth:number; maxFilters:number; }
  function guard(obj:any, limits:GuardLimits){ const stack=[{v:obj,d:0,p:'$'}]; while(stack.length){ const {v,d,p}=stack.pop()!; if(d>limits.maxDepth) throw { code:'input_limit_exceeded', message:'Max depth exceeded', detail:{ path:p, limit:limits.maxDepth }}; if(Array.isArray(v)){ if(v.length>limits.maxArray) throw { code:'input_limit_exceeded', message:'Array too large', detail:{ path:p, limit:limits.maxArray, actual:v.length }}; v.forEach((x,i)=>stack.push({v:x,d:d+1,p:`${p}[${i}]`})); } else if(v && typeof v==='object'){ for(const [k,val] of Object.entries(v)){ if(k==='filters' && Array.isArray(val) && val.length>limits.maxFilters) throw { code:'input_limit_exceeded', message:'Too many filters', detail:{ path:`${p}.filters`, limit:limits.maxFilters, actual:val.length }}; stack.push({v:val,d:d+1,p:`${p}.${k}`}); } } else if(typeof v==='string'){ if(v.length>limits.maxString) throw { code:'input_limit_exceeded', message:'String too long', detail:{ path:p, limit:limits.maxString, actual:v.length }}; } } }

  return async (c: Context, next: Next) => {
    const start = Date.now();
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local';
    recordRequest();
    let rid = c.req.header('x-request-id'); if(!rid || rid.length>64) rid = crypto.randomUUID(); c.header('x-request-id', rid);
    const key = `rl:${ip}`;
    const now = Date.now();
    const opts: SecurityOptions = {
      requestsPerWindow: readInt(c.env, 'MCP_RATE_LIMIT', base.requestsPerWindow),
      windowMs: readInt(c.env, 'MCP_RATE_WINDOW_MS', base.windowMs),
      maxBodyBytes: readInt(c.env, 'MCP_MAX_BODY_BYTES', base.maxBodyBytes),
      requireAuthHeader: base.requireAuthHeader || !!(c.env as any)?.MCP_SERVER_TOKEN
    };

    const rec = rateMap.get(key);
    if (!rec || rec.reset < now) {
      rateMap.set(key, { count: 1, reset: now + opts.windowMs });
    } else {
      rec.count++;
      if (rec.count > opts.requestsPerWindow) {
        const retryAfterMs = rec.reset - now;
        c.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
        recordRateLimited();
        return c.json({ error: 'rate_limited', retryAfterMs }, 429);
      }
    }

    // Optional shared secret auth (server-to-server protection)
    if (opts.requireAuthHeader) {
      const expected = (c.env as any)?.MCP_SERVER_TOKEN;
      if (expected) {
        const provided = c.req.header('x-mcp-auth');
        if (!provided || provided !== expected) {
          return c.json({ error: 'unauthorized' }, 401);
        }
      }
    }

    // Enforce body size limit for JSON requests
  if (c.req.method === 'POST') {
      const contentType = c.req.header('content-type') || '';
      if (contentType.includes('application/json')) {
        const raw = await c.req.raw.clone().text();
        if (raw.length > opts.maxBodyBytes) { return c.json({ error: 'payload_too_large', limit: opts.maxBodyBytes }, 413); }
        const hErr = await verifyHmac(raw, c); if (hErr) return c.json({ error:'auth_failed', code:hErr.code, message:hErr.message }, 401);
        try {
          const parsed = JSON.parse(raw);
          const limits: GuardLimits = {
            maxArray: readInt(c.env,'MCP_MAX_ARRAY_ITEMS',200),
            maxString: readInt(c.env,'MCP_MAX_STRING_LENGTH',5000),
            maxDepth: readInt(c.env,'MCP_MAX_NESTING_DEPTH',8),
            maxFilters: readInt(c.env,'MCP_MAX_FILTERS',25)
          };
          guard(parsed, limits);
        } catch (g:any) {
          if (g?.code === 'input_limit_exceeded') return c.json({ error:'validation_error', code:g.code, detail:g.detail, message:g.message }, 422);
        }
        (c.req as any)._cachedJsonText = raw;
      }
    }

    // Security headers
    await next();
    const res = c.res;
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.headers.set('Cache-Control', 'no-store');
    // Basic CSP for API (restrict everything by default)
    res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

    // Minimal structured access log (redacted)
    const duration = Date.now() - start;
    try {
      let logIp = ip; const salt = (c.env as any)?.MCP_IP_HASH_SALT; if (salt) { const buf = new TextEncoder().encode(`${salt}:${ip}`); const dig = await crypto.subtle.digest('SHA-256', buf); logIp = 'h:' + Array.from(new Uint8Array(dig)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,12); }
      console.log(JSON.stringify({ e:'access', m:c.req.method, p:c.req.path, ip:logIp, s:res.status, ms:duration, rid }));
    } catch {}
  };
}

// Harden CORS origin evaluation: returns empty string for disallowed instead of wildcard.
export function isOriginAllowed(origin: string | undefined, allowedList: string[]): string | '' {
  if (!origin) return allowedList[0] || '';
  return allowedList.includes(origin) ? origin : '';
}

// Simple SSE connection tracking. In a multi-process/worker deployment this is per-instance.
let activeSse = 0;
export function trackSseConnection<T>(handler: () => Promise<T>, maxConnections: number): Promise<T> {
  if (activeSse >= maxConnections) {
    return Promise.reject(new Error('sse_connection_limit'));
  }
  activeSse++;
  return handler().finally(() => { activeSse = Math.max(0, activeSse - 1); });
}
