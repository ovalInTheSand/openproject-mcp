// Helper to parse MCP responses that may arrive via SSE (text/event-stream)
// or as a single JSON body when Accept includes application/json.
// We read the raw text and reconstruct the final JSON-RPC message.

export async function parseMcpFetchResponse(response) {
  // If content-type explicitly starts with application/json, fall back to response.json()
  const ct = response.headers.get('content-type') || '';
  if (ct.startsWith('application/json')) {
    return await response.json();
  }
  // Otherwise treat as SSE stream text
  const raw = await response.text();
  return parseMcpResponseText(raw);
}

export function parseMcpResponseText(raw) {
  // SSE frames look like: event: message\n data: {json}\n\n ... we gather last JSON object with id/result/error
  // Split by double newlines to obtain events
  const chunks = raw.split(/\n\n+/).map(c => c.trim()).filter(Boolean);
  let lastObj = null;
  for (const chunk of chunks) {
    // Extract data lines
    const dataLines = chunk.split(/\n/).filter(l => l.startsWith('data:'));
    for (const line of dataLines) {
      const jsonPart = line.replace(/^data:\s*/, '');
      try {
        const obj = JSON.parse(jsonPart);
        if (obj && (Object.prototype.hasOwnProperty.call(obj, 'result') || Object.prototype.hasOwnProperty.call(obj, 'error'))) {
          lastObj = obj; // Keep updating, last one should be the final JSON-RPC response
        }
      } catch (_) {
        // ignore parse errors for intermediate heartbeat data
      }
    }
  }
  if (lastObj) return lastObj;
  // Fallback: try raw as JSON (single-line?)
  try { return JSON.parse(raw); } catch { /* ignore */ }
  throw new Error('Unable to parse MCP response from stream');
}
