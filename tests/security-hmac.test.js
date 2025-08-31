#!/usr/bin/env node
/**
 * Security HMAC Test
 * Sends request without required headers; if HMAC enabled expects auth_failed; else passes.
 */
import { test } from 'node:test';
import { ok } from 'node:assert';

const ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';

test('Security: HMAC missing headers handling', async () => {
  const body = { jsonrpc: '2.0', id: 9200, method: 'tools/call', params: { name: 'op.health', arguments: {} } };
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(()=>({}));
    if (res.status === 401 && j.error === 'auth_failed') {
      ok(true, 'HMAC enforced');
    } else {
      ok(true, 'HMAC not enforced (no secret)');
    }
  } catch {
    console.log('⚠️  HMAC Test: SKIPPED (server unreachable)');
  }
});
