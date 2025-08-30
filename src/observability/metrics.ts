// In-memory metrics (ephemeral per instance)
export type ToolOutcome = 'success' | 'error' | 'timeout';
const counters: Record<string, number> = Object.create(null);
const BUCKETS = [50, 200, 1000];

function inc(name: string, by = 1) { counters[name] = (counters[name] || 0) + by; }
export function recordRequest() { inc('requests_total'); }
export function recordRateLimited() { inc('rate_limited_total'); }
export function recordToolCall(tool: string, outcome: ToolOutcome) { inc(`tool_calls_total|${tool}|${outcome}`); }
export function observeToolLatency(tool: string, ms: number) {
  let binned = false;
  for (const b of BUCKETS) { if (ms <= b) { inc(`tool_latency_ms_bucket|${tool}|<=${b}`); binned = true; break; } }
  if (!binned) inc(`tool_latency_ms_bucket|${tool}|>1000`);
}
export function getMetricsSnapshot() { return { counters: { ...counters } }; }