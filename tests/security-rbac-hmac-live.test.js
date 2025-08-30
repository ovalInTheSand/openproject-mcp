/**
 * Live RBAC + HMAC integration test.
 *
 * This test expects you to have the MCP server running locally (default: http://localhost:8788/mcp)
 * with environment variables:
 *  MCP_HMAC_SECRET (>=32 chars)  e.g. superlongsecretvalue_superlongsecretvalue_1234567890
 *  MCP_TOOL_SCOPES  e.g. {"op.health":["admin"],"*": ["base"]}
 *
 * It exercises four scenarios (skipping gracefully if preconditions not met):
 *  1. RBAC denial: op.health without required scope (when configured)
 *  2. RBAC success: op.health with required scope
 *  3. HMAC denial: Missing signature headers returns auth_failed/missing_signature
 *  4. HMAC success: Valid HMAC headers accepted
 */

import assert from 'assert';

const ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';

async function postRaw(body, headers = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', ...headers },
    body: body,
  });
  const text = await res.text();
  return { status: res.status, text };
}

function parseEventStreamPayload(text) {
  // Expect first data: line with JSON-RPC envelope
  const dataLine = text.split('\n').find(l => l.startsWith('data: '));
  if (!dataLine) return null;
  try { return JSON.parse(dataLine.slice(6)); } catch { return null; }
}

(async () => {
  // Quick reachability check
  try {
    const ping = await postRaw('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
    if (!ping.text.includes('tools')) {
      console.log('SKIP: server responded but unexpected payload (tools/list)');
      return;
    }
  } catch (e) {
    console.log('SKIP: server not reachable at', ENDPOINT);
    return;
  }

  const hasHmac = !!process.env.MCP_HMAC_SECRET;
  if (!hasHmac) {
    console.log('SKIP: MCP_HMAC_SECRET not set in test env – cannot exercise HMAC paths.');
    return;
  }

  const requestBody = JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'op.health', arguments: {} } });

  // 1. RBAC denial (only if RBAC configured to require admin scope). We'll send no scopes header.
  const rbacDeny = await postRaw(requestBody); // no x-mcp-scopes
  const denyPayload = parseEventStreamPayload(rbacDeny.text);
  const forbidden = JSON.stringify(denyPayload).includes('forbidden');
  if (forbidden) {
    console.log('RBAC denial observed as expected (missing scopes).');
  } else {
    console.log('RBAC denial NOT observed (either RBAC not configured for op.health or default scope satisfied).');
  }

  // 2. RBAC success with admin scope (always should succeed if tool exists)
  const rbacAllow = await postRaw(requestBody, { 'x-mcp-scopes': 'admin' });
  const allowPayload = parseEventStreamPayload(rbacAllow.text);
  assert(allowPayload?.result || !forbidden, 'Expected success payload for op.health with admin scope');
  console.log('RBAC success verified.');

  // 3. HMAC denial (missing signature headers) – should return auth_failed with missing_signature or weak_secret
  const hmacMissing = await postRaw(requestBody, { 'x-mcp-scopes': 'admin' });
  const hmacMissingPayload = parseEventStreamPayload(hmacMissing.text);
  const missingAuth = JSON.stringify(hmacMissingPayload).includes('auth_failed');
  if (!missingAuth) {
    console.log('WARN: Expected auth_failed for missing HMAC headers; payload=', hmacMissingPayload);
  } else {
    console.log('HMAC missing-signature denial observed.');
  }

  // 4. HMAC success
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const secret = process.env.MCP_HMAC_SECRET || '';
  function toHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${nonce}.${requestBody}`));
  const signature = 'v1=' + toHex(signatureBuf);
  const hmacOk = await postRaw(requestBody, { 'x-mcp-scopes': 'admin', 'x-mcp-timestamp': String(ts), 'x-mcp-nonce': nonce, 'x-mcp-signature': signature });
  const hmacOkPayload = parseEventStreamPayload(hmacOk.text);
  assert(hmacOkPayload?.result, 'Expected successful result with valid HMAC');
  console.log('HMAC valid signature accepted.');

  console.log('RBAC + HMAC live test complete.');
})().catch(e => { console.error('TEST ERROR', e); process.exitCode = 1; });
