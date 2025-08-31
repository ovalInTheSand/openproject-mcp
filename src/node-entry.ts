// Node.js production entrypoint (bypasses wrangler dev inside container)
import { serve } from '@hono/node-server';
import app from './index';

const port = parseInt(process.env.PORT || '8788', 10);

// Expose env to global for server tool handlers
(globalThis as any).ENV = process.env;

serve({ fetch: app.fetch, port });

console.log(`[node-entry] OpenProject MCP server listening on :${port}`);
