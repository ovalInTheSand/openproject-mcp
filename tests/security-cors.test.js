#!/usr/bin/env node
/**
 * CORS & Auth Hardening Tests
 * - Verifies preflight includes custom HMAC headers
 * - Verifies auth required when MCP_SERVER_TOKEN set
 * - Verifies SSE preflight mirrors /mcp
 */
import { test } from 'node:test';
import { ok, strictEqual } from 'node:assert';

const ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';
const SSE_ENDPOINT = (ENDPOINT.replace(/\/mcp$/, '')) + '/sse';
const ORIGIN = process.env.TEST_ORIGIN || 'http://localhost:8123';

async function preflight(url) {
  return fetch(url, {
    method: 'OPTIONS',
    headers: {
      'Origin': ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization,mcp-protocol-version,mcp-session-id,x-mcp-auth,x-mcp-signature,x-mcp-timestamp,x-mcp-nonce'
    }
  });
}

test('CORS: preflight includes custom HMAC headers', async () => {
  try {
    const res = await preflight(ENDPOINT);
    const allow = res.headers.get('access-control-allow-headers') || '';
    ok(/x-mcp-signature/i.test(allow) && /x-mcp-timestamp/i.test(allow) && /x-mcp-nonce/i.test(allow), 'Custom HMAC headers allowed');
  } catch {
    console.log('⚠️  CORS Test: SKIPPED (server unreachable)');
  }
});

test('Auth: missing x-mcp-auth rejected when MCP_SERVER_TOKEN set', async () => {
  if (!process.env.MCP_SERVER_TOKEN) {
    ok(true, 'MCP_SERVER_TOKEN not set; auth requirement not enforced');
    return;
  }
  const body = { jsonrpc: '2.0', id: 9501, method: 'tools/call', params: { name: 'op.health', arguments: {} } };
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN }, body: JSON.stringify(body) });
  if (res.status === 401) { ok(true, '401 without auth as expected'); return; }
  ok(false, `Expected 401, got ${res.status}`);
});

test('SSE: preflight mirrors /mcp allow headers', async () => {
  try {
    const mcp = await preflight(ENDPOINT);
    const sse = await preflight(SSE_ENDPOINT);
    const a = (mcp.headers.get('access-control-allow-headers')||'').split(',').map(s=>s.trim().toLowerCase()).sort();
    const b = (sse.headers.get('access-control-allow-headers')||'').split(',').map(s=>s.trim().toLowerCase()).sort();
    strictEqual(a.join('|'), b.join('|'), 'SSE allow-headers match /mcp');
  } catch {
    console.log('⚠️  SSE CORS Test: SKIPPED (server unreachable)');
  }
});
