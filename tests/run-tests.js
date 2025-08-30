#!/usr/bin/env node

/**
 * Test Runner for OpenProject MCP Server
 * Runs all test suites and provides summary
 */

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Running ${testFile}...`);
    console.log('─'.repeat(50));
    
  // Resolve tsx CLI path dynamically (supports ESM). Fallback to global 'npx tsx' semantics if resolution fails.
  const child = spawn('npx', ['-y', 'tsx', join(__dirname, testFile)], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    child.on('close', (code) => {
      resolve({
        file: testFile,
        success: code === 0,
        code
      });
    });
  });
}

async function main() {
  console.log('\n🚀 OpenProject MCP Server - Test Suite Runner');
  console.log('=' .repeat(60));
  
  // Check if server is running
  console.log('\n📡 Checking server availability...');
  const endpoint = process.env.MCP_ENDPOINT || 'http://localhost:8788/mcp';
  
  try {
    const response = await fetch(endpoint, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    console.log(`✅ Server responding at ${endpoint} (${response.status})`);
  } catch (error) {
    console.log(`⚠️  Server not responding at ${endpoint}`);
    console.log('   Make sure to run: npm run dev');
    console.log('   Tests will continue but may fail...');
  }
  
  // Find all test files
  const testFiles = [];
  try {
    const files = await readdir(__dirname);
    for (const file of files) {
      if (file.endsWith('.test.js') && file !== 'run-tests.js') {
        testFiles.push(file);
      }
    }
  } catch (error) {
    console.error('❌ Failed to read test directory:', error.message);
    process.exit(1);
  }
  
  // Optionally include live atomic validation when env flag set
  if (process.env.MCP_LIVE_VALIDATION === 'true') {
    testFiles.push('live-atomic-validation.js');
  }

  if (testFiles.length === 0) {
    console.log('❌ No test files found');
    process.exit(1);
  }
  
  console.log(`\n📋 Found ${testFiles.length} test files:`);
  testFiles.forEach(file => console.log(`   - ${file}`));
  
  // Run tests
  const results = [];
  const startTime = Date.now();
  
  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Duration: ${totalTime}ms`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.file} (exit code: ${r.code})`);
    });
  }
  
  console.log('\n' + (failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed'));
  
  // Environment info
  console.log('\n🔧 Environment Info:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   MCP Endpoint: ${endpoint}`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});