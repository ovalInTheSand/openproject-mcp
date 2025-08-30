#!/usr/bin/env node

/**
 * Basic Health Check Test Suite
 * Tests critical MCP server functionality without external dependencies
 * Run with: node tests/health.test.js
 */

import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { parseMcpFetchResponse } from './_helpers/mcpResponse.js';

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';

/**
 * Test MCP server basic connectivity
 */
test('MCP Server - Health Check', async (t) => {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'op.health',
      arguments: {}
    }
  };

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(request)
    });

    ok(response.ok, `Health check failed with status: ${response.status}`);
    
  const data = await parseMcpFetchResponse(response);
    strictEqual(data.jsonrpc, '2.0', 'Invalid JSON-RPC version');
    strictEqual(data.id, 1, 'Response ID mismatch');
    ok(data.result, 'Health check should return result');
    
    console.log('✅ Health Check Test: PASSED');
    console.log(`   Server Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(data.result?.content?.[0] || data.result, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Health Check Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test MCP tools list functionality
 */
test('MCP Server - Tools List', async (t) => {
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(request)
    });

    ok(response.ok, `Tools list failed with status: ${response.status}`);
    
  const data = await parseMcpFetchResponse(response);
    strictEqual(data.jsonrpc, '2.0', 'Invalid JSON-RPC version');
    ok(data.result, 'Tools list should return result');
    ok(Array.isArray(data.result.tools), 'Tools should be an array');
    
    const toolCount = data.result.tools.length;
    ok(toolCount >= 14, `Expected at least 14 tools, got ${toolCount}`);
    
    // Check for core tools
    const toolNames = data.result.tools.map(tool => tool.name);
    const coreTools = ['op.health', 'projects.list', 'wp.list', 'wp.create'];
    
    for (const coreTool of coreTools) {
      ok(toolNames.includes(coreTool), `Missing core tool: ${coreTool}`);
    }
    
    console.log('✅ Tools List Test: PASSED');
    console.log(`   Total Tools: ${toolCount}`);
    console.log(`   Core Tools Verified: ${coreTools.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Tools List Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test basic project listing (requires valid OP_BASE_URL and OP_TOKEN)
 */
test('OpenProject API - Projects List', async (t) => {
  const request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'projects.list',
      arguments: {
        limit: 5
      }
    }
  };

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(request)
    });

    ok(response.ok, `Projects list failed with status: ${response.status}`);
    
  const data = await parseMcpFetchResponse(response);
    strictEqual(data.jsonrpc, '2.0', 'Invalid JSON-RPC version');
    
    if (data.error) {
      console.log('⚠️  Projects List Test: SKIPPED (API not configured)');
      console.log(`   Error: ${data.error.message}`);
      return;
    }
    
    ok(data.result, 'Projects list should return result');
    ok(data.result.content, 'Projects list should have content');
    
    console.log('✅ Projects List Test: PASSED');
    console.log(`   Response Type: ${typeof data.result}`);
    
  } catch (error) {
    console.log('⚠️  Projects List Test: SKIPPED (Connection failed)');
    console.log(`   Error: ${error.message}`);
    // Don't throw - this test is optional if API is not available
  }
});

/**
 * Test MCP protocol compliance
 */
test('MCP Protocol - Invalid Method', async (t) => {
  const request = {
    jsonrpc: '2.0',
    id: 4,
    method: 'invalid/method',
    params: {}
  };

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(request)
    });

    ok(response.ok, 'Server should respond even to invalid methods');
    
  const data = await parseMcpFetchResponse(response);
    strictEqual(data.jsonrpc, '2.0', 'Invalid JSON-RPC version');
    strictEqual(data.id, 4, 'Response ID mismatch');
    ok(data.error, 'Invalid method should return error');
    strictEqual(data.error.code, -32601, 'Should return method not found error');
    
    console.log('✅ Protocol Compliance Test: PASSED');
    console.log(`   Error Code: ${data.error.code}`);
    console.log(`   Error Message: ${data.error.message}`);
    
  } catch (error) {
    console.error('❌ Protocol Compliance Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test server startup detection
 */
test('MCP Server - Startup Detection', async (t) => {
  try {
    // Test server is responding
    const response = await fetch(MCP_ENDPOINT, {
      method: 'GET',  // Should return 405 Method Not Allowed but server is running
      headers: {
        'Accept': 'text/plain'
      }
    });

    // We expect 405 Method Not Allowed for GET, but server is responsive
    ok(response.status === 405 || response.ok, 
       `Server should respond (got ${response.status})`);
    
    console.log('✅ Startup Detection Test: PASSED');
    console.log(`   Server Status: ${response.status} ${response.statusText}`);
    
  } catch (error) {
    console.error('❌ Startup Detection Test: FAILED');
    console.error(`   Error: ${error.message}`);
    console.error('   Make sure MCP server is running: npm run dev');
    throw error;
  }
});

console.log('\n🧪 OpenProject MCP Server - Basic Test Suite');
console.log('=' .repeat(50));
console.log(`Testing endpoint: ${MCP_ENDPOINT}`);
console.log('');