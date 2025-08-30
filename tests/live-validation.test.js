#!/usr/bin/env node
/**
 * Live OpenProject Validation Script
 * Verifies: project listing, capabilities tool, EVM calculation, variable retrieval & optional update.
 */
import { parseMcpFetchResponse } from './_helpers/mcpResponse.js';

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';
const today = new Date().toISOString().slice(0,10);

let rpcId = 1;
async function rpc(method, params) {
  const body = { jsonrpc: '2.0', id: rpcId++, method, params };
  const res = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} body=${text.slice(0,500)}`);
  }
  return parseMcpFetchResponse(res);
}

async function callTool(name, args = {}) {
  const data = await rpc('tools/call', { name, arguments: args });
  if (data.error) throw new Error(`${name} error: ${JSON.stringify(data.error)}`);
  const payload = data.result?.structuredContent || data.result?.content || data.result;
  if (data.result?.isError) {
    throw new Error(`${name} tool wrapper error: ${JSON.stringify(payload).slice(0,400)}`);
  }
  if (payload && typeof payload === 'object' && payload.code === 'upstream_error') {
    throw new Error(`${name} upstream error: ${JSON.stringify(payload).slice(0,400)}`);
  }
  return payload;
}

(async () => {
  console.log('--- Live Validation Start ---');
  // Capabilities
  const caps = await callTool('system.getCapabilities');
  console.log('Capabilities:', caps?.version, 'tools:', caps?.toolCount);

  // Projects (projects.list returns { elements, total, count, pageSize, offset })
  const projectsList = await callTool('projects.list', {});
  const elements = Array.isArray(projectsList?.elements) ? projectsList.elements :
    (projectsList?.structuredContent && Array.isArray(projectsList.structuredContent.elements) ? projectsList.structuredContent.elements : []);
  if (!elements.length) throw new Error('No projects returned (expected elements array). Raw keys: ' + Object.keys(projectsList || {}).join(','));
  console.log('Projects returned:', elements.length, 'meta total:', projectsList.total);
  const targetProjects = elements.slice(0,2);

  for (const p of targetProjects) {
    const pid = p.id || p.identifier || p.projectId || p; 
    console.log(`\nProject ${pid} - ${p.name || p.identifier}`);
    // Hybrid data
    const hybrid = await callTool('hybrid.getProjectData', { projectId: pid });
    console.log('Hybrid data keys:', Object.keys(hybrid || {}).slice(0,10));
    // Variables
    const vars = await callTool('variables.getProjectVariables', { projectId: pid });
    console.log('Variables snapshot: laborRate=', vars.standardLaborRate, 'evmMethod=', vars.evmMethod);
    // EVM
    const evm = await callTool('reports.earnedValue', { projectId: pid, reportDate: today, costCurrency: 'USD' });
    console.log('EVM CPI/SPI:', evm.costPerformanceIndex, evm.schedulePerformanceIndex, 'EAC:', evm.estimateAtCompletion);
    if (typeof evm.costPerformanceIndex !== 'number') throw new Error('Invalid CPI');
  }
  // Metrics snapshot (best-effort; ignore failures)
  try {
    const metrics = await callTool('system.getMetrics', {});
    const toolMetricsKeys = Object.keys(metrics?.counters || {}).filter(k => k.startsWith('tool_calls_total')); 
    console.log('Metrics tool call counters (sample):', toolMetricsKeys.slice(0,5));
  } catch (e) {
    console.log('Metrics retrieval skipped:', e.message);
  }

  console.log('\nAll validations completed successfully.');
})().catch(e => { console.error('Live validation failed:', e); process.exit(1); });
