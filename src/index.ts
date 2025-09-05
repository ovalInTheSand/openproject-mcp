// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { StreamableHTTPTransport } from "@hono/mcp";
import { securityMiddleware, trackSseConnection } from './middleware/security';
import { buildServer } from "./server";
import { handleSSEConnection } from "./sse";

type Bindings = {
  OP_BASE_URL: string;
  OP_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  OP_ALLOW_INSECURE_HTTP?: string;
  SENTRY_DSN?: string;
  SSE_ENABLED?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Unified CORS/SSE config including security & HMAC headers
const corsConfig = {
  origin: (origin: string | undefined, c: any) => {
    const allow = c.env.ALLOWED_ORIGINS?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [];
    if (!allow.length) { return ''; }
    if (!origin) { return allow[0]; }
    return allow.includes(origin) ? origin : '';
  },
  allowHeaders: [
    'content-type',
    'authorization',
    'mcp-protocol-version',
    'mcp-session-id',
    'x-mcp-auth',
    'x-mcp-signature',
    'x-mcp-timestamp',
    'x-mcp-nonce',
    'cache-control',
    'last-event-id'
  ],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['content-type', 'cache-control'],
};

app.use("/mcp", cors(corsConfig));
// Phase 2 security middleware (rate limit, headers, size limit, optional auth)
// Dynamic auth requirement (auto true when MCP_SERVER_TOKEN or MCP_HMAC_SECRET set at process runtime)
const dynamicAuth = (() => {
  try { if (typeof process !== 'undefined' && process.env) { return Boolean(process.env.MCP_SERVER_TOKEN || process.env.MCP_HMAC_SECRET); } } catch { /* workers */ }
  return false;
})();

app.use('*', securityMiddleware({
  requestsPerWindow: 200,
  windowMs: 60_000,
  maxBodyBytes: 512 * 1024,
  requireAuthHeader: dynamicAuth
}));

// Optional SSE route (disabled by default per project philosophy)
app.use("/sse", cors(corsConfig));
app.get("/sse", async (c) => {
  // Check if SSE is enabled via environment variable
  const sseEnabled = c.env.SSE_ENABLED?.toLowerCase() === "true";
  
  if (!sseEnabled) {
    return c.json({ 
      error: "SSE endpoint is disabled", 
      message: "Set SSE_ENABLED=true to enable Server-Sent Events" 
    }, 404);
  }

  // Set global ENV for this request context
  (globalThis as any).ENV = c.env;

  return trackSseConnection(() => handleSSEConnection(c), 25).catch(() => c.json({ error: 'too_many_sse_connections' }, 429));
});

// MCP route using our modular server (primary transport)
app.all("/mcp", async (c) => {
  // Enforce JSON-RPC over POST; return consistent 405 for other methods (improves test stability vs ambiguous 406)
  if (c.req.method !== 'POST') {
    return c.json({ error: 'Method Not Allowed', allowed: ['POST'] }, 405);
  }
  const transport = new StreamableHTTPTransport();
  const server = buildServer();

  // Set global ENV for this request context
  (globalThis as any).ENV = c.env;

  await server.connect(transport as any);
  return transport.handleRequest(c);
});

export default app;