// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { StreamableHTTPTransport } from "@hono/mcp";
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

// CORS: allow inspector origins + mcp-session-id header + SSE headers
const corsConfig = {
  origin: (origin: string | undefined, c: any) => {
    const allow = c.env.ALLOWED_ORIGINS?.split(",").map((s: string) => s.trim()).filter(Boolean) ?? [];
    if (!origin) return allow.length ? allow[0] : "*";
    return allow.includes(origin) ? origin : "";
  },
  allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "Cache-Control"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Type", "Cache-Control"],
};

app.use("/mcp", cors(corsConfig));

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

  return handleSSEConnection(c);
});

// MCP route using our modular server (primary transport)
app.all("/mcp", async (c) => {
  const transport = new StreamableHTTPTransport();
  const server = buildServer();

  // Set global ENV for this request context
  (globalThis as any).ENV = c.env;

  await server.connect(transport as any);
  return transport.handleRequest(c);
});

export default app;