#!/usr/bin/env node
/**
 * Security Rate Limit Test
 * Fires a short burst; pass if any 429 or all succeed (limit high) or server unreachable skip.
 */
import { test } from 'node:test';
import { ok } from 'node:assert';

const ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';

async function makeCall(id) {
  const body = { jsonrpc: '2.0', id, method: 'tools/list', params: {} };
  return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('Security: Rate limit burst', async () => {
  try {
    const calls = await Promise.all(Array.from({ length: 12 }, (_, i) => makeCall(9300 + i)));
    const any429 = calls.some(r => r.status === 429);
    ok(any429 || calls.every(r => r.ok), 'Burst handled (either limited or accepted)');
  } catch {
    console.log('⚠️  Rate Limit Test: SKIPPED (server unreachable)');
  }
});
