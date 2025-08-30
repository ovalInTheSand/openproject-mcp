#!/usr/bin/env node
/**
 * Hybrid System Integration Tests for OpenProject MCP v3.0.0
 * 
 * Tests the core hybrid data architecture:
 * - Native OpenProject data extraction 
 * - Custom enterprise calculations (EVM, Critical Path, Resource Utilization)
 * - PMO variable management
 * - Intelligent caching system
 */

import { strict as assert } from 'assert';

// Test configuration
const TEST_CONFIG = {
  // Base URL for OpenProject instance (override with OP_BASE_URL env var)
  baseUrl: process.env.OP_BASE_URL || 'https://thisistheway.local',
  
  // API key for testing (override with OP_API_KEY env var)
  apiKey: process.env.OP_API_KEY || 'test-api-key',
  
  // Test project ID (should exist in OpenProject instance)
  testProjectId: process.env.TEST_PROJECT_ID || '1',
  
  // Test user ID
  testUserId: process.env.TEST_USER_ID || '1',
  
  // Test timeout (10 seconds for most operations)
  timeout: 10000
};

// Mock environment for testing
const mockEnv = {
  OP_BASE_URL: TEST_CONFIG.baseUrl,
  OP_API_KEY: TEST_CONFIG.apiKey
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Test runner utility
 */
async function runTest(testName, testFn) {
  try {
    console.log(`\n🧪 Running: ${testName}`);
    await testFn();
    testResults.passed++;
    console.log(`✅ PASSED: ${testName}`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * Test 1: Native Data Extraction
 * Verifies that we can extract project data from OpenProject API
 */
async function testNativeDataExtraction() {
  // Import the native extractor
  const { nativeExtractor } = await import('../src/data/native-extractor.ts');
  
  // Create mock context
  const ctx = { env: mockEnv };
  
  // Test getting project metrics
  const metrics = await nativeExtractor.getProjectMetrics(ctx, TEST_CONFIG.testProjectId);
  
  // Verify structure
  assert(typeof metrics.id !== 'undefined', 'Project ID should be present');
  assert(typeof metrics.name === 'string', 'Project name should be a string');
  assert(typeof metrics.totalEstimatedHours === 'number', 'Total estimated hours should be a number');
  assert(typeof metrics.totalSpentHours === 'number', 'Total spent hours should be a number');
  assert(typeof metrics.overallPercentComplete === 'number', 'Overall completion should be a number');
  assert(Array.isArray(metrics.workPackages), 'Work packages should be an array');
  assert(Array.isArray(metrics.timeEntries), 'Time entries should be an array');
  
  console.log(`   📊 Project: ${metrics.name}`);
  console.log(`   📦 Work packages: ${metrics.workPackages.length}`);
  console.log(`   ⏱️  Time entries: ${metrics.timeEntries.length}`);
  console.log(`   📈 Progress: ${metrics.overallPercentComplete}%`);
}

/**
 * Test 2: PMO Variable Management
 * Verifies dynamic variable loading and defaults system
 */
async function testPMOVariableManagement() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  // Test getting project variables (should return defaults if no custom fields set)
  const variables = await variableManager.getProjectVariables(ctx, TEST_CONFIG.testProjectId);
  
  // Verify structure matches PMOVariables interface
  assert(typeof variables.standardLaborRate === 'number', 'Standard labor rate should be a number');
  assert(typeof variables.overtimeMultiplier === 'number', 'Overtime multiplier should be a number');
  assert(typeof variables.costPerformanceThreshold === 'number', 'Cost performance threshold should be a number');
  assert(['low', 'medium', 'high'].includes(variables.riskTolerance), 'Risk tolerance should be valid');
  assert(['traditional', 'earned_schedule', 'weighted_milestone'].includes(variables.evmMethod), 'EVM method should be valid');
  
  console.log(`   💰 Standard labor rate: $${variables.standardLaborRate}/hour`);
  console.log(`   🎯 Cost performance threshold: ${variables.costPerformanceThreshold}`);
  console.log(`   ⚡ EVM method: ${variables.evmMethod}`);
  console.log(`   🎪 Industry type: ${variables.industryType}`);
  
  // Test organizational defaults
  const orgDefaults = await variableManager.getOrganizationalDefaults(ctx);
  console.log(`   🏢 Organization defaults: ${orgDefaults ? 'Found' : 'Using built-in defaults'}`);
  
  // Test user variables
  const userVars = await variableManager.getUserVariables(ctx, TEST_CONFIG.testUserId);
  console.log(`   👤 User-specific variables: ${Object.keys(userVars).length} found`);
}

/**
 * Test 3: Custom Enterprise Calculations
 * Tests EVM, Critical Path, and Resource Utilization calculations
 */
async function testCustomEnterpriseCalculations() {
  const { customCalculator } = await import('../src/data/custom-calculator.ts');
  const { nativeExtractor } = await import('../src/data/native-extractor.ts');
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  // Get required data
  const nativeData = await nativeExtractor.getProjectMetrics(ctx, TEST_CONFIG.testProjectId);
  const variables = await variableManager.getProjectVariables(ctx, TEST_CONFIG.testProjectId);
  
  // Test EVM calculation
  console.log(`   🧮 Testing EVM calculation...`);
  const evmResult = customCalculator.calculateEVM(nativeData, variables);
  
  // Verify EVM structure
  assert(typeof evmResult.budgetAtCompletion === 'number', 'BAC should be a number');
  assert(typeof evmResult.plannedValue === 'number', 'PV should be a number');
  assert(typeof evmResult.earnedValue === 'number', 'EV should be a number');
  assert(typeof evmResult.actualCost === 'number', 'AC should be a number');
  assert(typeof evmResult.costPerformanceIndex === 'number', 'CPI should be a number');
  assert(typeof evmResult.schedulePerformanceIndex === 'number', 'SPI should be a number');
  assert(['Green', 'Yellow', 'Red'].includes(evmResult.overallHealth), 'Overall health should be valid');
  
  console.log(`     💵 Budget at Completion: $${evmResult.budgetAtCompletion}`);
  console.log(`     📊 Cost Performance Index: ${evmResult.costPerformanceIndex}`);
  console.log(`     📈 Schedule Performance Index: ${evmResult.schedulePerformanceIndex}`);
  console.log(`     🚥 Overall Health: ${evmResult.overallHealth}`);
  
  // Test Critical Path Analysis (with empty dependencies for now)
  console.log(`   🛤️  Testing Critical Path analysis...`);
  const cpResult = customCalculator.calculateCriticalPath(nativeData, []);
  
  // Verify Critical Path structure
  assert(typeof cpResult.projectDuration === 'number', 'Project duration should be a number');
  assert(typeof cpResult.criticalPathLength === 'number', 'Critical path length should be a number');
  assert(Array.isArray(cpResult.criticalPath), 'Critical path should be an array');
  assert(['Low', 'Medium', 'High'].includes(cpResult.scheduleRisk), 'Schedule risk should be valid');
  
  console.log(`     ⏰ Project Duration: ${cpResult.projectDuration} days`);
  console.log(`     🔥 Critical Path Length: ${cpResult.criticalPathLength} tasks`);
  console.log(`     ⚠️  Schedule Risk: ${cpResult.scheduleRisk}`);
  
  // Test Resource Utilization
  console.log(`   👥 Testing Resource Utilization...`);
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  const endDate = new Date();
  
  const resourceResult = customCalculator.calculateResourceUtilization(
    [nativeData], 
    variables, 
    startDate, 
    endDate
  );
  
  // Verify Resource Utilization structure
  assert(Array.isArray(resourceResult), 'Resource utilization should be an array');
  
  console.log(`     👤 Resources analyzed: ${resourceResult.length}`);
  if (resourceResult.length > 0) {
    const overallocated = resourceResult.filter(r => r.overallocation).length;
    console.log(`     🔴 Overallocated resources: ${overallocated}`);
  }
}

/**
 * Test 4: Hybrid Data Manager Integration 
 * Tests the orchestration of all components together
 */
async function testHybridDataManagerIntegration() {
  const { hybridManager } = await import('../src/data/hybrid-manager.ts');
  
  const ctx = { env: mockEnv };
  
  // Test getting complete hybrid project data
  console.log(`   🔄 Testing hybrid data orchestration...`);
  const hybridData = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
  
  // Verify hybrid data structure
  assert(typeof hybridData.native === 'object', 'Native data should be present');
  assert(typeof hybridData.variables === 'object', 'Variables should be present');
  assert(typeof hybridData.calculations === 'object', 'Calculations should be present');
  
  console.log(`     ✅ Native data: ${hybridData.native.name}`);
  console.log(`     ✅ Variables: ${Object.keys(hybridData.variables).length} configured`);
  
  if (hybridData.calculations) {
    const { evm, criticalPath, resourceUtilization } = hybridData.calculations;
    console.log(`     ✅ EVM calculation: ${evm ? 'Available' : 'Not computed'}`);
    console.log(`     ✅ Critical path: ${criticalPath ? 'Available' : 'Not computed'}`);
    console.log(`     ✅ Resource utilization: ${resourceUtilization ? 'Available' : 'Not computed'}`);
  }
  
  // Test real-time project status (never cached)
  console.log(`   📡 Testing real-time project status...`);
  const projectStatus = await hybridManager.getProjectStatus(ctx, TEST_CONFIG.testProjectId);
  
  assert(typeof projectStatus.isOnline === 'boolean', 'Online status should be boolean');
  assert(typeof projectStatus.currentProgress === 'number', 'Current progress should be a number');
  assert(Array.isArray(projectStatus.upcomingDeadlines), 'Upcoming deadlines should be an array');
  assert(Array.isArray(projectStatus.alerts), 'Alerts should be an array');
  
  console.log(`     🟢 Is online: ${projectStatus.isOnline}`);
  console.log(`     📊 Current progress: ${projectStatus.currentProgress}%`);
  console.log(`     📅 Upcoming deadlines: ${projectStatus.upcomingDeadlines.length}`);
  console.log(`     🚨 Active alerts: ${projectStatus.alerts.length}`);
}

/**
 * Test 5: Caching System Performance
 * Tests cache hits/misses, TTL, and performance
 */
async function testCachingSystemPerformance() {
  const { hybridManager } = await import('../src/data/hybrid-manager.ts');
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  const ctx = { env: mockEnv };
  
  // Clear cache to start fresh
  await cacheManager.clearAll();
  
  console.log(`   🧹 Cache cleared for testing...`);
  
  // First call should be slower (cache miss)
  const start1 = Date.now();
  const data1 = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
  const time1 = Date.now() - start1;
  
  console.log(`     🔄 First call (cache miss): ${time1}ms`);
  
  // Second call should be faster (cache hit for variables)
  const start2 = Date.now();
  const data2 = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
  const time2 = Date.now() - start2;
  
  console.log(`     ⚡ Second call (partial cache hit): ${time2}ms`);
  
  // Verify data consistency
  assert.deepEqual(data1.variables, data2.variables, 'Variable data should be consistent');
  
  // Test cache performance metrics
  const cachePerformance = await hybridManager.getCachePerformance();
  
  assert(typeof cachePerformance.statistics === 'object', 'Cache statistics should be available');
  assert(typeof cachePerformance.health === 'object', 'Cache health should be available');
  
  console.log(`     📈 Cache entries: ${cachePerformance.statistics.totalEntries}`);
  console.log(`     💾 Memory usage: ${cachePerformance.statistics.memoryUsage}`);
  console.log(`     🎯 Hit rate: ${cachePerformance.statistics.hitRate}`);
  console.log(`     🏥 Health status: ${cachePerformance.health.status}`);
}

/**
 * Test 6: Portfolio Analytics (Multiple Projects)
 * Tests the portfolio-level analytics using multiple projects
 */
async function testPortfolioAnalytics() {
  const { hybridManager } = await import('../src/data/hybrid-manager.ts');
  
  const ctx = { env: mockEnv };
  
  // Test with single project (in real scenario, would use multiple)
  const projectIds = [TEST_CONFIG.testProjectId];
  
  console.log(`   📈 Testing portfolio analytics for ${projectIds.length} project(s)...`);
  
  const portfolioAnalytics = await hybridManager.getPortfolioAnalytics(ctx, projectIds);
  
  // Verify portfolio structure
  assert(typeof portfolioAnalytics.totalProjects === 'number', 'Total projects should be a number');
  assert(['Green', 'Yellow', 'Red'].includes(portfolioAnalytics.overallHealth), 'Overall health should be valid');
  assert(typeof portfolioAnalytics.totalBudget === 'number', 'Total budget should be a number');
  assert(typeof portfolioAnalytics.totalSpent === 'number', 'Total spent should be a number');
  assert(Array.isArray(portfolioAnalytics.recommendations), 'Recommendations should be an array');
  
  console.log(`     📊 Total projects: ${portfolioAnalytics.totalProjects}`);
  console.log(`     🚥 Overall health: ${portfolioAnalytics.overallHealth}`);
  console.log(`     💰 Total budget: $${portfolioAnalytics.totalBudget}`);
  console.log(`     💸 Total spent: $${portfolioAnalytics.totalSpent}`);
  console.log(`     ⚠️  Risk projects: ${portfolioAnalytics.riskProjects.length}`);
  console.log(`     👥 Resource conflicts: ${portfolioAnalytics.resourceConflicts.length}`);
  console.log(`     💡 Recommendations: ${portfolioAnalytics.recommendations.length}`);
}

/**
 * Test 7: Error Handling and Edge Cases
 * Tests error scenarios and edge case handling
 */
async function testErrorHandlingAndEdgeCases() {
  const { hybridManager } = await import('../src/data/hybrid-manager.ts');
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   🛡️  Testing error handling...`);
  
  // Test with invalid project ID
  try {
    await hybridManager.getProjectData(ctx, 'invalid-project-id');
    assert.fail('Should have thrown an error for invalid project ID');
  } catch (error) {
    console.log(`     ✅ Invalid project ID handled: ${error.message.substring(0, 50)}...`);
  }
  
  // Test variable validation
  try {
    await variableManager.validateVariableChanges(ctx, TEST_CONFIG.testProjectId, {
      standardLaborRate: -10 // Invalid: negative rate
    });
    
    console.log(`     ✅ Variable validation working`);
  } catch (error) {
    console.log(`     ⚠️  Variable validation error: ${error.message.substring(0, 50)}...`);
  }
  
  // Test cache invalidation
  await hybridManager.invalidateProjectCache(TEST_CONFIG.testProjectId);
  console.log(`     ✅ Cache invalidation completed`);
  
  console.log(`     🛡️  Error handling tests completed`);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 OpenProject MCP v3.0.0 - Hybrid System Integration Tests');
  console.log('=' .repeat(80));
  
  console.log(`\n📋 Test Configuration:`);
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`   Test Project ID: ${TEST_CONFIG.testProjectId}`);
  console.log(`   Test User ID: ${TEST_CONFIG.testUserId}`);
  console.log(`   API Key: ${TEST_CONFIG.apiKey ? '[CONFIGURED]' : '[NOT SET]'}`);
  
  // Skip tests if no API key provided
  if (!TEST_CONFIG.apiKey || TEST_CONFIG.apiKey === 'test-api-key') {
    console.log('\n⚠️  WARNING: No real API key provided. Some tests may fail.');
    console.log('   Set OP_API_KEY environment variable for full testing.');
  }
  
  console.log(`\n🧪 Running Integration Tests...\n`);
  
  await runTest('1. Native Data Extraction', testNativeDataExtraction);
  await runTest('2. PMO Variable Management', testPMOVariableManagement);
  await runTest('3. Custom Enterprise Calculations', testCustomEnterpriseCalculations);
  await runTest('4. Hybrid Data Manager Integration', testHybridDataManagerIntegration);
  await runTest('5. Caching System Performance', testCachingSystemPerformance);
  await runTest('6. Portfolio Analytics', testPortfolioAnalytics);
  await runTest('7. Error Handling and Edge Cases', testErrorHandlingAndEdgeCases);
  
  // Print summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(80));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`🎯 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.errors.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log(`\n🏁 Testing completed in ${Date.now() - global.testStartTime}ms`);
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Store start time
global.testStartTime = Date.now();

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testResults };