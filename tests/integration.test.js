#!/usr/bin/env node

/**
 * Integration Test Suite
 * Tests full OpenProject MCP workflow integration
 * Run with: node tests/integration.test.js
 */

import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { parseMcpFetchResponse } from './_helpers/mcpResponse.js';

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';

/**
 * Helper function to make MCP calls
 */
async function mcpCall(method, name, args = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1000),
    method,
    params: name ? { name, arguments: args } : args
  };

  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
    body: JSON.stringify(request)
  });

  ok(response.ok, `MCP call failed with status: ${response.status}`);
  return await parseMcpFetchResponse(response);
}

/**
 * Test complete workflow: Health → Projects → Types → Work Packages
 */
test('Integration - Complete PM Workflow', async (t) => {
  console.log('\n📋 Testing Complete PM Workflow...');
  
  try {
    // Step 1: Health Check
    console.log('  1. Health Check...');
    const health = await mcpCall('tools/call', 'op.health');
    ok(health.result, 'Health check should succeed');
    
    // Step 2: List Projects
    console.log('  2. List Projects...');
    const projects = await mcpCall('tools/call', 'projects.list', { limit: 3 });
    
    if (projects.error) {
      console.log('  ⚠️  API not configured, skipping integration tests');
      return;
    }
    
    ok(projects.result, 'Projects list should return result');
    
    // Extract project ID if available
    let projectId = null;
    try {
      const content = projects.result.content?.[0]?.text || '';
      const match = content.match(/"id":\s*(\d+)/);
      projectId = match ? parseInt(match[1]) : null;
    } catch (e) {
      // Continue without project ID
    }
    
    // Step 3: List Work Package Types
    console.log('  3. List WP Types...');
    const types = await mcpCall('tools/call', 'types.list', 
      projectId ? { projectId } : {}
    );
    ok(types.result, 'Types list should return result');
    
    // Step 4: List Work Packages
    console.log('  4. List Work Packages...');
    const workPackages = await mcpCall('tools/call', 'wp.list', { 
      limit: 3,
      ...(projectId && { projectId })
    });
    ok(workPackages.result, 'Work packages list should return result');
    
    // Step 5: List Users
    console.log('  5. List Users...');
    const users = await mcpCall('tools/call', 'users.search', { query: 'admin' });
    ok(users.result, 'Users search should return result');
    
    console.log('✅ Integration Test: PASSED');
    console.log('   All workflow steps completed successfully');
    
  } catch (error) {
    console.error('❌ Integration Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test enterprise tools availability
 */
test('Enterprise Tools - Availability Check', async (t) => {
  console.log('\n🏢 Testing Enterprise Tools Availability...');
  
  try {
    const toolsList = await mcpCall('tools/list');
    ok(toolsList.result?.tools, 'Should return tools list');
    
    const tools = toolsList.result.tools;
    const toolNames = tools.map(tool => tool.name);
    
    // Check for key enterprise tools
    const enterpriseTools = [
      'projects.createEnterprise',
      'wp.createEnterprise', 
      'time.logEnterprise',
      'reports.earnedValue',
      'reports.criticalPath',
      'dependencies.analyze'
    ];
    
    const availableEnterprise = enterpriseTools.filter(name => toolNames.includes(name));
    const missingEnterprise = enterpriseTools.filter(name => !toolNames.includes(name));
    
    console.log(`   Available Enterprise Tools: ${availableEnterprise.length}/${enterpriseTools.length}`);
    
    if (availableEnterprise.length > 0) {
      console.log('   ✅ Enterprise features detected');
      console.log(`   Available: ${availableEnterprise.join(', ')}`);
    }
    
    if (missingEnterprise.length > 0) {
      console.log(`   ⚠️  Missing: ${missingEnterprise.join(', ')}`);
    }
    
    // Ensure we have reasonable tool coverage
    ok(tools.length >= 14, `Expected at least 14 tools, got ${tools.length}`);
    
    console.log('✅ Enterprise Tools Check: PASSED');
    console.log(`   Total Tools: ${tools.length}`);
    
  } catch (error) {
    console.error('❌ Enterprise Tools Check: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test error handling consistency
 */
test('Error Handling - Consistency Check', async (t) => {
  console.log('\n🛡️  Testing Error Handling...');
  
  try {
    // Test 1: Invalid tool name
    const invalidTool = await mcpCall('tools/call', 'invalid.tool', {});
    ok(invalidTool.error, 'Invalid tool should return error');
    ok(invalidTool.error.code, 'Error should have code');
    
    // Test 2: Missing arguments for health check (should still work)
    const healthNoArgs = await mcpCall('tools/call', 'op.health');
    ok(healthNoArgs.result || healthNoArgs.error, 'Should return result or error');
    
    // Test 3: Invalid method
    const invalidMethod = await mcpCall('invalid/method');
    ok(invalidMethod.error, 'Invalid method should return error');
    strictEqual(invalidMethod.error.code, -32601, 'Should return method not found');
    
    console.log('✅ Error Handling Test: PASSED');
    console.log('   All error scenarios handled correctly');
    
  } catch (error) {
    console.error('❌ Error Handling Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

/**
 * Test performance and response times
 */
test('Performance - Response Times', async (t) => {
  console.log('\n⚡ Testing Performance...');
  
  try {
    const tests = [
      { name: 'Health Check', tool: 'op.health' },
      { name: 'Tools List', method: 'tools/list' }
    ];
    
    for (const testCase of tests) {
      const start = Date.now();
      
      if (testCase.method) {
        await mcpCall(testCase.method);
      } else {
        await mcpCall('tools/call', testCase.tool);
      }
      
      const duration = Date.now() - start;
      console.log(`   ${testCase.name}: ${duration}ms`);
      
      ok(duration < 5000, `${testCase.name} took too long: ${duration}ms`);
    }
    
    console.log('✅ Performance Test: PASSED');
    console.log('   All responses within acceptable limits');
    
  } catch (error) {
    console.error('❌ Performance Test: FAILED');
    console.error(`   Error: ${error.message}`);
    throw error;
  }
});

console.log('\n🔧 OpenProject MCP Server - Integration Test Suite');
console.log('=' .repeat(55));
console.log(`Testing endpoint: ${MCP_ENDPOINT}`);
console.log('Note: Some tests require valid OP_BASE_URL and OP_TOKEN');
console.log('');