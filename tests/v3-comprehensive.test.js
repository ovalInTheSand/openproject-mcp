#!/usr/bin/env node
/**
 * Comprehensive Test Suite for OpenProject MCP v3.0.0
 * 
 * Runs all hybrid system tests in the correct order:
 * 1. Hybrid System Integration Tests
 * 2. Variable Management Tests  
 * 3. Cache Performance Tests
 * 4. Hybrid MCP Tools Tests
 * 
 * Provides comprehensive reporting and validation for the new v3.0.0 features.
 */

import { strict as assert } from 'assert';

// Test modules
const testModules = [
  { name: 'Hybrid System Integration', file: './hybrid-system.test.js' },
  { name: 'Variable Management', file: './variable-management.test.js' },
  { name: 'Cache Performance', file: './cache-performance.test.js' },
  { name: 'Hybrid MCP Tools', file: './hybrid-tools.test.js' }
];

// Global test configuration
const GLOBAL_CONFIG = {
  baseUrl: process.env.OP_BASE_URL || 'https://thisistheway.local',
  apiKey: process.env.OP_API_KEY || 'test-api-key',
  testProjectId: process.env.TEST_PROJECT_ID || '1',
  testUserId: process.env.TEST_USER_ID || '1',
  runIntegrationTests: process.env.RUN_INTEGRATION_TESTS !== 'false',
  verbose: process.env.VERBOSE === 'true'
};

// Global results tracking
let globalResults = {
  totalSuites: 0,
  passedSuites: 0,
  failedSuites: 0,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  startTime: Date.now(),
  suiteResults: [],
  errors: []
};

/**
 * Run a single test suite
 */
async function runTestSuite(suiteName, testFile) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 Running Test Suite: ${suiteName}`);
  console.log(`${'='.repeat(80)}`);
  
  const startTime = Date.now();
  
  try {
    // Import and run the test module
    const testModule = await import(testFile);
    
    if (typeof testModule.runAllTests !== 'function') {
      throw new Error(`Test module ${testFile} does not export runAllTests function`);
    }
    
    const success = await testModule.runAllTests();
    const duration = Date.now() - startTime;
    
    // Get results from the test module
    const testResults = testModule.testResults || { passed: 0, failed: 0, skipped: 0, errors: [] };
    
    const suiteResult = {
      name: suiteName,
      file: testFile,
      success,
      duration,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      errors: testResults.errors
    };
    
    globalResults.suiteResults.push(suiteResult);
    globalResults.totalSuites++;
    globalResults.totalTests += (testResults.passed + testResults.failed + testResults.skipped);
    globalResults.passedTests += testResults.passed;
    globalResults.failedTests += testResults.failed;
    globalResults.skippedTests += testResults.skipped;
    
    if (success) {
      globalResults.passedSuites++;
      console.log(`\n✅ SUITE PASSED: ${suiteName} (${duration}ms)`);
    } else {
      globalResults.failedSuites++;
      globalResults.errors.push(...testResults.errors);
      console.log(`\n❌ SUITE FAILED: ${suiteName} (${duration}ms)`);
    }
    
    return suiteResult;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    const suiteResult = {
      name: suiteName,
      file: testFile,
      success: false,
      duration,
      passed: 0,
      failed: 1,
      skipped: 0,
      errors: [{ test: 'Suite Execution', error: error.message }]
    };
    
    globalResults.suiteResults.push(suiteResult);
    globalResults.totalSuites++;
    globalResults.failedSuites++;
    globalResults.failedTests++;
    globalResults.errors.push({ test: `${suiteName} - Suite Execution`, error: error.message });
    
    console.log(`\n❌ SUITE ERROR: ${suiteName} - ${error.message}`);
    
    return suiteResult;
  }
}

/**
 * Validate environment and prerequisites
 */
function validateEnvironment() {
  console.log(`📋 Environment Validation:`);
  console.log(`   Base URL: ${GLOBAL_CONFIG.baseUrl}`);
  console.log(`   API Key: ${GLOBAL_CONFIG.apiKey ? '[CONFIGURED]' : '[NOT SET]'}`);
  console.log(`   Test Project ID: ${GLOBAL_CONFIG.testProjectId}`);
  console.log(`   Test User ID: ${GLOBAL_CONFIG.testUserId}`);
  console.log(`   Integration Tests: ${GLOBAL_CONFIG.runIntegrationTests ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   Verbose Mode: ${GLOBAL_CONFIG.verbose ? 'ON' : 'OFF'}`);
  
  const warnings = [];
  
  if (!GLOBAL_CONFIG.apiKey || GLOBAL_CONFIG.apiKey === 'test-api-key') {
    warnings.push('No real API key provided - tests will have limited functionality');
  }
  
  if (GLOBAL_CONFIG.baseUrl === 'https://thisistheway.local') {
    warnings.push('Using default base URL - ensure OpenProject is accessible');
  }
  
  if (!GLOBAL_CONFIG.runIntegrationTests) {
    warnings.push('Integration tests are disabled - full validation will be limited');
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Environment Warnings:`);
    warnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });
  }
  
  return warnings;
}

/**
 * Print comprehensive test results
 */
function printComprehensiveResults() {
  const totalDuration = Date.now() - globalResults.startTime;
  
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📊 COMPREHENSIVE TEST RESULTS - OpenProject MCP v3.0.0`);
  console.log(`${'='.repeat(100)}`);
  
  // Overall summary
  console.log(`\n🎯 Overall Results:`);
  console.log(`   📦 Test Suites: ${globalResults.passedSuites}/${globalResults.totalSuites} passed`);
  console.log(`   🧪 Individual Tests: ${globalResults.passedTests}/${globalResults.totalTests} passed`);
  console.log(`   ⏭️  Skipped Tests: ${globalResults.skippedTests}`);
  console.log(`   ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`   🎯 Success Rate: ${Math.round((globalResults.passedTests / (globalResults.passedTests + globalResults.failedTests)) * 100)}%`);
  
  // Suite-by-suite breakdown
  console.log(`\n📊 Suite-by-Suite Results:`);
  globalResults.suiteResults.forEach((suite, index) => {
    const status = suite.success ? '✅' : '❌';
    const durationSeconds = (suite.duration / 1000).toFixed(1);
    const successRate = suite.passed + suite.failed > 0 
      ? Math.round((suite.passed / (suite.passed + suite.failed)) * 100)
      : 0;
    
    console.log(`   ${status} ${index + 1}. ${suite.name}`);
    console.log(`      Duration: ${durationSeconds}s | Tests: ${suite.passed}/${suite.passed + suite.failed} | Rate: ${successRate}%`);
    
    if (!suite.success && suite.errors.length > 0) {
      console.log(`      Errors: ${suite.errors.length} (see details below)`);
    }
  });
  
  // V3.0.0 Feature Validation Summary
  console.log(`\n🚀 OpenProject MCP v3.0.0 Feature Validation:`);
  
  const hybridSystemSuite = globalResults.suiteResults.find(s => s.name === 'Hybrid System Integration');
  const variableMgmtSuite = globalResults.suiteResults.find(s => s.name === 'Variable Management');
  const cachePerfSuite = globalResults.suiteResults.find(s => s.name === 'Cache Performance');
  const toolsSuite = globalResults.suiteResults.find(s => s.name === 'Hybrid MCP Tools');
  
  console.log(`   🔄 Hybrid Data Architecture: ${hybridSystemSuite?.success ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`   🔧 PMO Variable Management: ${variableMgmtSuite?.success ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`   🗄️  Intelligent Caching: ${cachePerfSuite?.success ? '✅ WORKING' : '❌ ISSUES'}`);
  console.log(`   🧰 22 New MCP Tools: ${toolsSuite?.success ? '✅ WORKING' : '❌ ISSUES'}`);
  
  // Production readiness assessment
  const criticalSuitesWorking = [hybridSystemSuite, variableMgmtSuite, cachePerfSuite, toolsSuite]
    .every(suite => suite?.success);
  
  console.log(`\n🎯 Production Readiness Assessment:`);
  if (criticalSuitesWorking) {
    console.log(`   ✅ READY FOR PRODUCTION`);
    console.log(`      - All core v3.0.0 features working`);
    console.log(`      - Hybrid architecture validated`);
    console.log(`      - Dynamic PMO variables functional`);
    console.log(`      - Intelligent caching performing well`);
    console.log(`      - All 22 new MCP tools operational`);
  } else {
    console.log(`   ⚠️  NOT READY FOR PRODUCTION`);
    console.log(`      - Critical issues found in core features`);
    console.log(`      - Review failed test suites before deployment`);
    console.log(`      - Fix identified issues and re-test`);
  }
  
  // Performance metrics (if available)
  if (cachePerfSuite?.success) {
    console.log(`\n⚡ Performance Highlights:`);
    console.log(`   🗄️  Caching system validated with TTL expiration`);
    console.log(`   🚀 Cache warming and invalidation functional`);
    console.log(`   📊 Performance monitoring and health checks working`);
  }
  
  // Error summary
  if (globalResults.errors.length > 0) {
    console.log(`\n❌ Error Summary (${globalResults.errors.length} total):`);
    const errorGroups = {};
    
    globalResults.errors.forEach(error => {
      const suite = error.test.split(' - ')[0] || 'Unknown';
      if (!errorGroups[suite]) {
        errorGroups[suite] = [];
      }
      errorGroups[suite].push(error);
    });
    
    Object.entries(errorGroups).forEach(([suite, errors]) => {
      console.log(`   📦 ${suite}: ${errors.length} errors`);
      if (GLOBAL_CONFIG.verbose) {
        errors.slice(0, 3).forEach(error => { // Show first 3 errors
          console.log(`      • ${error.test}: ${error.error.substring(0, 80)}...`);
        });
        if (errors.length > 3) {
          console.log(`      • ... and ${errors.length - 3} more errors`);
        }
      }
    });
    
    if (!GLOBAL_CONFIG.verbose) {
      console.log(`\n💡 Run with VERBOSE=true for detailed error information`);
    }
  }
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  
  if (criticalSuitesWorking) {
    console.log(`   ✅ v3.0.0 implementation is excellent!`);
    console.log(`   📚 Update documentation to reflect new capabilities`);
    console.log(`   🚀 Consider deployment to staging environment`);
    console.log(`   📊 Monitor performance metrics in production`);
  } else {
    console.log(`   🔧 Fix failing test suites before deployment`);
    console.log(`   🧪 Re-run tests after fixes to ensure stability`);
    console.log(`   📋 Review error messages for specific issues`);
    console.log(`   🆘 Consider rolling back to v2.0.0 if critical issues persist`);
  }
  
  console.log(`\n${'='.repeat(100)}`);
}

/**
 * Main test runner
 */
async function runComprehensiveTests() {
  console.log('🚀 OpenProject MCP v3.0.0 - Comprehensive Test Suite');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(100)}`);
  
  // Validate environment
  const envWarnings = validateEnvironment();
  
  if (!GLOBAL_CONFIG.runIntegrationTests) {
    console.log(`\n⏭️  Integration tests are disabled. Set RUN_INTEGRATION_TESTS=true for full testing.`);
  }
  
  console.log(`\n🧪 Running ${testModules.length} test suites sequentially...\n`);
  
  // Run each test suite
  for (const testModule of testModules) {
    if (!GLOBAL_CONFIG.runIntegrationTests && testModule.name.includes('Integration')) {
      console.log(`\n⏭️  Skipping ${testModule.name} (integration tests disabled)`);
      continue;
    }
    
    await runTestSuite(testModule.name, testModule.file);
    
    // Brief pause between suites to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print comprehensive results
  printComprehensiveResults();
  
  // Exit with appropriate code
  const success = globalResults.failedSuites === 0 && globalResults.failedTests === 0;
  process.exit(success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection in test suite:', error);
  globalResults.errors.push({ test: 'Unhandled Rejection', error: error.message });
  printComprehensiveResults();
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in test suite:', error);
  globalResults.errors.push({ test: 'Uncaught Exception', error: error.message });
  printComprehensiveResults();
  process.exit(1);
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(error => {
    console.error('❌ Comprehensive test suite failed:', error);
    globalResults.errors.push({ test: 'Test Suite Execution', error: error.message });
    printComprehensiveResults();
    process.exit(1);
  });
}

export { runComprehensiveTests, globalResults };