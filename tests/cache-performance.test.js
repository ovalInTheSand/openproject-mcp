#!/usr/bin/env node
/**
 * Cache Performance Tests for OpenProject MCP v3.0.0
 * 
 * Tests the intelligent caching system:
 * - TTL-based expiration and cleanup
 * - Cache hit/miss patterns and performance
 * - Cache warming strategies
 * - Memory usage and efficiency
 * - Concurrent access patterns
 * - Cache invalidation scenarios
 */

import { strict as assert } from 'assert';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.OP_BASE_URL || 'https://thisistheway.local',
  apiKey: process.env.OP_API_KEY || 'test-api-key',
  testProjectId: process.env.TEST_PROJECT_ID || '1',
  testProjectIds: ['1', '2', '3'], // Multiple projects for testing
  performanceIterations: 10,
  concurrencyLevel: 5
};

const mockEnv = {
  OP_BASE_URL: TEST_CONFIG.baseUrl,
  OP_API_KEY: TEST_CONFIG.apiKey
};

let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  metrics: {}
};

async function runTest(testName, testFn) {
  const startAll = Date.now();
  try {
    console.log(`\n🧪 Running: ${testName}`);
    const result = await testFn();
    const elapsed = Date.now() - startAll;
    // Offline stub performance guard when using placeholder token
    if (TEST_CONFIG.apiKey === 'test-api-key') {
      if (elapsed > 2000) {
        throw new Error(`offline_stub_slow: ${elapsed}ms > 2000ms for ${testName}`);
      }
      if (!/^https?:\/\//.test(TEST_CONFIG.baseUrl)) {
        throw new Error(`invalid_base_url: ${TEST_CONFIG.baseUrl}`);
      }
    }
    testResults.passed++;
    console.log(`✅ PASSED: ${testName} (${elapsed}ms)`);
    return result;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
    throw error;
  }
}

/**
 * Performance measurement utility
 */
function measureTime(label, fn) {
  return async (...args) => {
    const start = process.hrtime.bigint();
    const result = await fn(...args);
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    
    if (!testResults.metrics[label]) {
      testResults.metrics[label] = [];
    }
    testResults.metrics[label].push(durationMs);
    
    return { result, duration: durationMs };
  };
}

/**
 * Sleep utility for testing TTL expiration
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Basic Cache Operations
 * Tests fundamental cache set/get operations
 */
async function testBasicCacheOperations() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🗄️  Testing basic cache operations...`);
  
  // Clear cache to start fresh
  await cacheManager.clearAll();
  
  // Test basic set/get
  const testKey = 'test-data';
  const testData = { message: 'Hello Cache', timestamp: Date.now() };
  
  // Set data with custom TTL
  await cacheManager.set(testKey, testData, 'global', 5); // 5 seconds TTL
  
  // Get data back
  const retrievedData = await cacheManager.get(testKey, 'global');
  
  assert.deepEqual(retrievedData, testData, 'Retrieved data should match stored data');
  console.log(`   ✅ Basic set/get operations working`);
  
  // Test cache statistics
  const stats = cacheManager.getCacheStatistics();
  
  assert(typeof stats.totalEntries === 'number', 'Total entries should be a number');
  assert(stats.totalEntries >= 1, 'Should have at least one cache entry');
  
  console.log(`   📊 Cache statistics:`);
  console.log(`     📦 Total entries: ${stats.totalEntries}`);
  console.log(`     💾 Memory usage: ${stats.memoryUsage}`);
  console.log(`     🎯 Hit rate: ${stats.hitRate}`);
  
  return { stats, testData };
}

/**
 * Test 2: TTL Expiration and Cleanup
 * Tests that cache entries expire properly
 */
async function testTTLExpirationAndCleanup() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   ⏰ Testing TTL expiration and cleanup...`);
  
  // Clear cache
  await cacheManager.clearAll();
  
  // Set data with short TTL
  const shortTTLKey = 'short-ttl-data';
  const shortTTLData = { expires: 'quickly', created: Date.now() };
  
  await cacheManager.set(shortTTLKey, shortTTLData, 'test-project', 1); // 1 second TTL
  
  // Verify data is initially available
  let data = await cacheManager.get(shortTTLKey, 'test-project');
  assert(data !== null, 'Data should be available immediately after set');
  console.log(`   ✅ Data available immediately after set`);
  
  // Wait for TTL expiration
  console.log(`   ⏳ Waiting for TTL expiration (1.5s)...`);
  await sleep(1500);
  
  // Verify data has expired
  data = await cacheManager.get(shortTTLKey, 'test-project');
  assert(data === null, 'Data should be null after TTL expiration');
  console.log(`   ✅ Data expired after TTL`);
  
  // Test session-based caching (TTL = 0, no expiration)
  const sessionKey = 'session-data';
  const sessionData = { persistent: true, created: Date.now() };
  
  await cacheManager.set(sessionKey, sessionData, 'test-project', 0); // No TTL
  
  // Wait same amount of time
  await sleep(1000);
  
  // Should still be available
  data = await cacheManager.get(sessionKey, 'test-project');
  assert(data !== null, 'Session data should not expire');
  console.log(`   ✅ Session data persists beyond TTL test duration`);
  
  return { expiredCorrectly: true, sessionPersists: true };
}

/**
 * Test 3: Cache Performance Under Load
 * Tests cache performance with multiple rapid operations
 */
async function testCachePerformanceUnderLoad() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🚀 Testing cache performance under load...`);
  
  // Clear cache
  await cacheManager.clearAll();
  
  const iterations = TEST_CONFIG.performanceIterations;
  const projectIds = TEST_CONFIG.testProjectIds;
  
  // Measure bulk set operations
  const setBenchmark = measureTime('bulk-set', async (count) => {
    const promises = [];
    for (let i = 0; i < count; i++) {
      const key = `load-test-${i}`;
      const data = {
        iteration: i,
        timestamp: Date.now(),
        randomData: Math.random().toString(36)
      };
      promises.push(cacheManager.set(key, data, projectIds[i % projectIds.length], 3600));
    }
    await Promise.all(promises);
  });
  
  const { result: setResult, duration: setDuration } = await setBenchmark(iterations);
  console.log(`   ⚡ Bulk SET: ${iterations} operations in ${setDuration.toFixed(2)}ms`);
  console.log(`     📈 Rate: ${(iterations / setDuration * 1000).toFixed(0)} ops/second`);
  
  // Measure bulk get operations
  const getBenchmark = measureTime('bulk-get', async (count) => {
    const promises = [];
    for (let i = 0; i < count; i++) {
      const key = `load-test-${i}`;
      promises.push(cacheManager.get(key, projectIds[i % projectIds.length]));
    }
    const results = await Promise.all(promises);
    return results.filter(r => r !== null).length; // Count hits
  });
  
  const { result: hitCount, duration: getDuration } = await getBenchmark(iterations);
  console.log(`   ⚡ Bulk GET: ${iterations} operations in ${getDuration.toFixed(2)}ms`);
  console.log(`     📈 Rate: ${(iterations / getDuration * 1000).toFixed(0)} ops/second`);
  console.log(`     🎯 Hit rate: ${((hitCount / iterations) * 100).toFixed(1)}%`);
  
  // Verify performance is reasonable (under 1ms per operation on average)
  assert(setDuration / iterations < 10, 'SET operations should be under 10ms per operation');
  assert(getDuration / iterations < 5, 'GET operations should be under 5ms per operation');
  
  return {
    setDuration,
    getDuration,
    hitCount,
    setRate: iterations / setDuration * 1000,
    getRate: iterations / getDuration * 1000
  };
}

/**
 * Test 4: Concurrent Access Patterns
 * Tests cache behavior under concurrent access
 */
async function testConcurrentAccessPatterns() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🔄 Testing concurrent access patterns...`);
  
  await cacheManager.clearAll();
  
  const concurrency = TEST_CONFIG.concurrencyLevel;
  const operationsPerWorker = 5;
  
  // Create concurrent workers
  const workers = Array.from({ length: concurrency }, (_, workerId) => {
    return async () => {
      const operations = [];
      
      for (let i = 0; i < operationsPerWorker; i++) {
        const key = `worker-${workerId}-op-${i}`;
        const data = {
          workerId,
          operation: i,
          timestamp: Date.now(),
          thread: 'concurrent'
        };
        
        // Set operation
        operations.push(cacheManager.set(key, data, `worker-${workerId}`, 10));
        
        // Get operation
        operations.push(
          cacheManager.get(key, `worker-${workerId}`).then(result => {
            assert(result !== null || i === 0, 'Should get data back for operations after first');
            return result;
          })
        );
      }
      
      await Promise.all(operations);
      return workerId;
    };
  });
  
  // Run all workers concurrently
  const start = Date.now();
  const workerPromises = workers.map(worker => worker());
  const workerResults = await Promise.all(workerPromises);
  const duration = Date.now() - start;
  
  console.log(`   ✅ Concurrent access completed:`);
  console.log(`     👥 Workers: ${concurrency}`);
  console.log(`     ⚡ Operations per worker: ${operationsPerWorker * 2} (set + get)`);
  console.log(`     ⏱️  Total duration: ${duration}ms`);
  console.log(`     📊 Total operations: ${concurrency * operationsPerWorker * 2}`);
  
  // Verify cache integrity after concurrent operations
  const finalStats = cacheManager.getCacheStatistics();
  console.log(`     🗄️  Final cache entries: ${finalStats.totalEntries}`);
  
  // Should have entries from all workers
  assert(
    finalStats.totalEntries >= concurrency * operationsPerWorker,
    'Should have entries from all workers'
  );
  
  return { duration, workerResults, finalStats };
}

/**
 * Test 5: Cache Warming Strategies
 * Tests pre-warming cache for improved performance
 */
async function testCacheWarmingStrategies() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🔥 Testing cache warming strategies...`);
  
  await cacheManager.clearAll();
  
  const projectIds = TEST_CONFIG.testProjectIds;
  
  // Measure cache warming performance
  const warmStart = Date.now();
  await cacheManager.warmCache(projectIds);
  const warmDuration = Date.now() - warmStart;
  
  console.log(`   ⚡ Cache warming completed:`);
  console.log(`     📁 Projects warmed: ${projectIds.length}`);
  console.log(`     ⏱️  Warming duration: ${warmDuration}ms`);
  
  // Check cache state after warming
  const statsAfterWarming = cacheManager.getCacheStatistics();
  console.log(`     🗄️  Cache entries after warming: ${statsAfterWarming.totalEntries}`);
  
  // Simulate subsequent access (should be faster due to warming)
  const accessStart = Date.now();
  
  // Try to access warmed data
  const accessPromises = projectIds.map(projectId => 
    cacheManager.get('projectVariables', projectId)
  );
  
  const accessResults = await Promise.all(accessPromises);
  const accessDuration = Date.now() - accessStart;
  
  console.log(`   ⚡ Post-warming access:`);
  console.log(`     ⏱️  Access duration: ${accessDuration}ms`);
  console.log(`     📊 Warming markers found: ${accessResults.filter(r => r !== null).length}`);
  
  // Warming should be reasonably fast
  assert(warmDuration < 5000, 'Cache warming should complete within 5 seconds');
  
  return {
    warmDuration,
    accessDuration,
    projectsWarmed: projectIds.length,
    warmingMarkers: accessResults.filter(r => r !== null).length
  };
}

/**
 * Test 6: Cache Invalidation Scenarios
 * Tests various cache invalidation strategies
 */
async function testCacheInvalidationScenarios() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🗑️  Testing cache invalidation scenarios...`);
  
  await cacheManager.clearAll();
  
  // Set up test data across different categories
  const testDataSets = [
    { key: 'evmCalculations', projectId: '1', data: { type: 'evm', value: 1 } },
    { key: 'evmCalculations', projectId: '2', data: { type: 'evm', value: 2 } },
    { key: 'criticalPathAnalysis', projectId: '1', data: { type: 'cpa', value: 1 } },
    { key: 'projectVariables', projectId: '1', data: { type: 'vars', value: 1 } },
    { key: 'portfolioAnalytics', projectId: 'global', data: { type: 'portfolio', value: 1 } }
  ];
  
  // Set all test data
  for (const dataset of testDataSets) {
    await cacheManager.set(dataset.key, dataset.data, dataset.projectId, 3600);
  }
  
  console.log(`   📦 Set ${testDataSets.length} test cache entries`);
  
  // Test pattern-based invalidation
  console.log(`   🎯 Testing pattern-based invalidation...`);
  
  // Invalidate all EVM calculations
  await cacheManager.invalidate('evmCalculations');
  
  // Check what remains
  let remaining = 0;
  for (const dataset of testDataSets) {
    const data = await cacheManager.get(dataset.key, dataset.projectId);
    if (data !== null) remaining++;
  }
  
  console.log(`     🗄️  Entries remaining after EVM invalidation: ${remaining}`);
  
  // Should have invalidated 2 EVM entries, leaving 3
  assert(remaining === 3, 'Should have 3 entries remaining after EVM invalidation');
  
  // Test project-specific invalidation
  console.log(`   📁 Testing project-specific invalidation...`);
  
  await cacheManager.clearProject('1');
  
  // Count remaining
  remaining = 0;
  for (const dataset of testDataSets) {
    const data = await cacheManager.get(dataset.key, dataset.projectId);
    if (data !== null) remaining++;
  }
  
  console.log(`     🗄️  Entries remaining after project-1 clear: ${remaining}`);
  
  // Should have cleared project 1 data (but project 2 EVM was already cleared)
  // Only global portfolio data should remain
  assert(remaining <= 1, 'Should have 1 or fewer entries remaining');
  
  // Test complete cache clear
  await cacheManager.clearAll();
  
  const finalStats = cacheManager.getCacheStatistics();
  console.log(`   🧹 Final cache entries after clearAll: ${finalStats.totalEntries}`);
  
  assert(finalStats.totalEntries === 0, 'Cache should be empty after clearAll');
  
  return {
    patternInvalidationWorked: true,
    projectClearWorked: true,
    clearAllWorked: true
  };
}

/**
 * Test 7: Cache Health Monitoring
 * Tests cache health metrics and monitoring
 */
async function testCacheHealthMonitoring() {
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🏥 Testing cache health monitoring...`);
  
  await cacheManager.clearAll();
  
  // Create various cache scenarios for health testing
  
  // Add some normal entries
  await cacheManager.set('normal-1', { type: 'normal' }, 'project1', 3600);
  await cacheManager.set('normal-2', { type: 'normal' }, 'project2', 3600);
  
  // Add short-lived entries that will expire
  await cacheManager.set('short-1', { type: 'short' }, 'project1', 1);
  await cacheManager.set('short-2', { type: 'short' }, 'project1', 1);
  
  console.log(`   📦 Set up test cache entries`);
  
  // Wait for short-lived entries to expire
  await sleep(1500);
  
  // Get health status
  const health = cacheManager.getHealthStatus();
  const stats = cacheManager.getCacheStatistics();
  
  console.log(`   🏥 Cache health status:`);
  console.log(`     🚥 Status: ${health.status}`);
  console.log(`     ⚠️  Issues: ${health.issues.length}`);
  console.log(`     💡 Recommendations: ${health.recommendations.length}`);
  
  console.log(`   📊 Detailed statistics:`);
  console.log(`     📦 Total entries: ${stats.totalEntries}`);
  console.log(`     💀 Expired entries: ${stats.expiredEntries}`);
  console.log(`     💾 Memory usage: ${stats.memoryUsage}`);
  console.log(`     🎯 Hit rate: ${stats.hitRate}`);
  console.log(`     🏆 Top calculation types: ${stats.topCalculationTypes.map(t => `${t.type}:${t.count}`).join(', ')}`);
  
  // Verify health structure
  assert(['healthy', 'warning', 'critical'].includes(health.status), 'Health status should be valid');
  assert(Array.isArray(health.issues), 'Issues should be an array');
  assert(Array.isArray(health.recommendations), 'Recommendations should be an array');
  
  // Print any health issues
  if (health.issues.length > 0) {
    console.log(`   ⚠️  Health issues detected:`);
    health.issues.forEach((issue, i) => {
      console.log(`     ${i + 1}. ${issue}`);
    });
  }
  
  // Print recommendations
  if (health.recommendations.length > 0) {
    console.log(`   💡 Health recommendations:`);
    health.recommendations.forEach((rec, i) => {
      console.log(`     ${i + 1}. ${rec}`);
    });
  }
  
  return {
    healthStatus: health.status,
    issueCount: health.issues.length,
    recommendationCount: health.recommendations.length,
    totalEntries: stats.totalEntries,
    expiredEntries: stats.expiredEntries
  };
}

/**
 * Test 8: Real-World Cache Usage Patterns
 * Simulates realistic cache usage patterns
 */
async function testRealWorldCacheUsagePatterns() {
  const { hybridManager } = await import('../src/data/hybrid-manager.ts');
  const { cacheManager } = await import('../src/data/cache-manager.ts');
  
  console.log(`   🌍 Testing real-world cache usage patterns...`);
  
  const ctx = { env: mockEnv };
  
  await cacheManager.clearAll();
  
  // Simulate realistic usage pattern
  console.log(`   📊 Simulating realistic cache usage...`);
  
  const operations = [
    // Initial data load (cache misses)
    async () => {
      console.log(`     🔄 Initial project data load (cache miss expected)...`);
      const start = Date.now();
      try {
        const data = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
        const duration = Date.now() - start;
        console.log(`       ⏱️  Duration: ${duration}ms`);
        return { operation: 'initial_load', duration, success: true };
      } catch (error) {
        console.log(`       ❌ Error: ${error.message.substring(0, 50)}...`);
        return { operation: 'initial_load', duration: Date.now() - start, success: false, error: error.message };
      }
    },
    
    // Repeated access (cache hits)
    async () => {
      console.log(`     ⚡ Repeated access (cache hit expected)...`);
      const start = Date.now();
      try {
        const data = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
        const duration = Date.now() - start;
        console.log(`       ⏱️  Duration: ${duration}ms`);
        return { operation: 'repeated_access', duration, success: true };
      } catch (error) {
        console.log(`       ❌ Error: ${error.message.substring(0, 50)}...`);
        return { operation: 'repeated_access', duration: Date.now() - start, success: false, error: error.message };
      }
    },
    
    // Cache invalidation and reload
    async () => {
      console.log(`     🗑️  Cache invalidation and reload...`);
      await hybridManager.invalidateProjectCache(TEST_CONFIG.testProjectId);
      const start = Date.now();
      try {
        const data = await hybridManager.getProjectData(ctx, TEST_CONFIG.testProjectId);
        const duration = Date.now() - start;
        console.log(`       ⏱️  Duration: ${duration}ms`);
        return { operation: 'invalidate_reload', duration, success: true };
      } catch (error) {
        console.log(`       ❌ Error: ${error.message.substring(0, 50)}...`);
        return { operation: 'invalidate_reload', duration: Date.now() - start, success: false, error: error.message };
      }
    }
  ];
  
  // Execute operations sequentially
  const results = [];
  for (const operation of operations) {
    const result = await operation();
    results.push(result);
  }
  
  // Analyze cache performance
  const finalStats = cacheManager.getCacheStatistics();
  const cacheHealth = cacheManager.getHealthStatus();
  
  console.log(`   📈 Real-world usage analysis:`);
  console.log(`     🎯 Operations completed: ${results.filter(r => r.success).length}/${results.length}`);
  console.log(`     🗄️  Final cache entries: ${finalStats.totalEntries}`);
  console.log(`     🏥 Cache health: ${cacheHealth.status}`);
  
  // Look for performance improvements from caching
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length >= 2) {
    const initialLoad = successfulResults.find(r => r.operation === 'initial_load');
    const repeatedAccess = successfulResults.find(r => r.operation === 'repeated_access');
    
    if (initialLoad && repeatedAccess) {
      const improvement = initialLoad.duration - repeatedAccess.duration;
      const improvementPercent = (improvement / initialLoad.duration) * 100;
      
      console.log(`     ⚡ Performance improvement from caching:`);
      console.log(`       Initial load: ${initialLoad.duration}ms`);
      console.log(`       Cached access: ${repeatedAccess.duration}ms`);
      console.log(`       Improvement: ${improvement.toFixed(0)}ms (${improvementPercent.toFixed(1)}%)`);
    }
  }
  
  return {
    results,
    finalStats,
    cacheHealth: cacheHealth.status,
    operationCount: results.length,
    successCount: results.filter(r => r.success).length
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 OpenProject MCP v3.0.0 - Cache Performance Tests');
  console.log('=' .repeat(80));
  
  console.log(`\n📋 Test Configuration:`);
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`   Test Project ID: ${TEST_CONFIG.testProjectId}`);
  console.log(`   Performance iterations: ${TEST_CONFIG.performanceIterations}`);
  console.log(`   Concurrency level: ${TEST_CONFIG.concurrencyLevel}`);
  console.log(`   API Key: ${TEST_CONFIG.apiKey ? '[CONFIGURED]' : '[NOT SET]'}`);
  
  if (!TEST_CONFIG.apiKey || TEST_CONFIG.apiKey === 'test-api-key') {
    console.log('\n⚠️  WARNING: No real API key provided. Cache tests will use mock/limited data.');
    console.log('   Set OP_API_KEY environment variable for full cache testing with real OpenProject data.');
  }
  
  console.log(`\n🧪 Running Cache Performance Tests...\n`);
  
  const testMetrics = {};
  
  testMetrics.basicOps = await runTest('1. Basic Cache Operations', testBasicCacheOperations);
  testMetrics.ttlExpiration = await runTest('2. TTL Expiration and Cleanup', testTTLExpirationAndCleanup);
  testMetrics.performance = await runTest('3. Cache Performance Under Load', testCachePerformanceUnderLoad);
  testMetrics.concurrent = await runTest('4. Concurrent Access Patterns', testConcurrentAccessPatterns);
  testMetrics.warming = await runTest('5. Cache Warming Strategies', testCacheWarmingStrategies);
  testMetrics.invalidation = await runTest('6. Cache Invalidation Scenarios', testCacheInvalidationScenarios);
  testMetrics.health = await runTest('7. Cache Health Monitoring', testCacheHealthMonitoring);
  testMetrics.realWorld = await runTest('8. Real-World Usage Patterns', testRealWorldCacheUsagePatterns);
  
  // Print comprehensive summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 Cache Performance Test Results & Metrics');
  console.log('=' .repeat(80));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`🎯 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  // Performance summary
  if (testMetrics.performance) {
    console.log(`\n⚡ Performance Highlights:`);
    console.log(`   SET operations: ${testMetrics.performance.setRate.toFixed(0)} ops/second`);
    console.log(`   GET operations: ${testMetrics.performance.getRate.toFixed(0)} ops/second`);
  }
  
  if (testMetrics.concurrent) {
    console.log(`   Concurrent operations: ${TEST_CONFIG.concurrencyLevel * TEST_CONFIG.concurrencyLevel * 2} ops in ${testMetrics.concurrent.duration}ms`);
  }
  
  if (testMetrics.warming) {
    console.log(`   Cache warming: ${testMetrics.warming.projectsWarmed} projects in ${testMetrics.warming.warmDuration}ms`);
  }
  
  // Health summary
  if (testMetrics.health) {
    console.log(`\n🏥 Cache Health Summary:`);
    console.log(`   Final health status: ${testMetrics.health.healthStatus}`);
    console.log(`   Issues detected: ${testMetrics.health.issueCount}`);
    console.log(`   Recommendations: ${testMetrics.health.recommendationCount}`);
  }
  
  // Real-world usage
  if (testMetrics.realWorld) {
    console.log(`\n🌍 Real-World Usage:`);
    console.log(`   Operations attempted: ${testMetrics.realWorld.operationCount}`);
    console.log(`   Operations successful: ${testMetrics.realWorld.successCount}`);
    console.log(`   Final cache health: ${testMetrics.realWorld.cacheHealth}`);
  }
  
  if (testResults.errors.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.test}: ${error.error}`);
    });
  }
  
  console.log(`\n🏁 Cache performance testing completed`);
  console.log(`💡 For production deployment, ensure cache hit rates >70% and response times <2s`);
  
  return testResults.failed === 0;
}

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
    console.error('❌ Cache performance test suite failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testResults };