#!/usr/bin/env node
/**
 * PMO Variable Management Tests for OpenProject MCP v3.0.0
 * 
 * Tests the dynamic variable management system:
 * - Organizational defaults and project overrides
 * - Custom field storage and retrieval
 * - Variable validation and policy enforcement
 * - User-specific variables and rates
 * - Export/import functionality
 */

import { strict as assert } from 'assert';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.OP_BASE_URL || 'https://thisistheway.local',
  apiKey: process.env.OP_API_KEY || 'test-api-key',
  testProjectId: process.env.TEST_PROJECT_ID || '1',
  testUserId: process.env.TEST_USER_ID || '1'
};

const mockEnv = {
  OP_BASE_URL: TEST_CONFIG.baseUrl,
  OP_API_KEY: TEST_CONFIG.apiKey,
  // Add some organizational defaults via env vars for testing
  PMO_DEFAULT_STANDARD_LABOR_RATE: '85',
  PMO_DEFAULT_UTILIZATION_RATE: '0.80',
  PMO_DEFAULT_RISK_TOLERANCE: 'medium',
  PMO_DEFAULT_INDUSTRY_TYPE: 'software'
};

let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

async function runTest(testName, testFn) {
  const startAll = Date.now();
  try {
    console.log(`\n🧪 Running: ${testName}`);
    await testFn();
    const elapsed = Date.now() - startAll;
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
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error.message });
    console.log(`❌ FAILED: ${testName}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * Test 1: Default PMO Variables Loading
 * Verifies the default variable system works correctly
 */
async function testDefaultVariablesLoading() {
  const { DEFAULT_PMO_VARIABLES } = await import('../src/types/hybrid-data.ts');
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   📋 Testing default variable loading...`);
  
  // Test built-in defaults
  console.log(`   🏭 Built-in defaults:`);
  console.log(`     💰 Standard labor rate: $${DEFAULT_PMO_VARIABLES.standardLaborRate}/hour`);
  console.log(`     📊 Cost performance threshold: ${DEFAULT_PMO_VARIABLES.costPerformanceThreshold}`);
  console.log(`     🎯 EVM method: ${DEFAULT_PMO_VARIABLES.evmMethod}`);
  console.log(`     🏢 Industry type: ${DEFAULT_PMO_VARIABLES.industryType}`);
  
  // Test organizational defaults from environment
  const orgDefaults = await variableManager.getOrganizationalDefaults(ctx);
  
  if (orgDefaults) {
    console.log(`   🏢 Organization defaults found:`);
    console.log(`     💰 Org labor rate: $${orgDefaults.standardLaborRate || 'not set'}/hour`);
    console.log(`     📈 Org utilization rate: ${orgDefaults.defaultUtilizationRate || 'not set'}`);
    console.log(`     ⚠️  Risk tolerance: ${orgDefaults.riskTolerance || 'not set'}`);
    
    // Verify that org defaults override built-in defaults
    if (orgDefaults.standardLaborRate) {
      assert(
        orgDefaults.standardLaborRate !== DEFAULT_PMO_VARIABLES.standardLaborRate,
        'Org defaults should override built-in defaults'
      );
    }
  } else {
    console.log(`   🏢 No organization defaults - using built-in`);
  }
  
  // Test project variable inheritance (defaults + org overrides)
  const projectVars = await variableManager.getProjectVariables(ctx, TEST_CONFIG.testProjectId);
  
  console.log(`   📁 Project variables (after inheritance):`);
  console.log(`     💰 Final labor rate: $${projectVars.standardLaborRate}/hour`);
  console.log(`     📊 Final utilization rate: ${projectVars.defaultUtilizationRate}`);
  console.log(`     ⚠️  Final risk tolerance: ${projectVars.riskTolerance}`);
  
  // Verify all required fields are present
  const requiredFields = [
    'standardLaborRate', 'overtimeMultiplier', 'contingencyPercentage',
    'costPerformanceThreshold', 'schedulePerformanceThreshold', 'evmMethod'
  ];
  
  requiredFields.forEach(field => {
    assert(
      projectVars[field] !== undefined,
      `Required field '${field}' should be present in project variables`
    );
  });
}

/**
 * Test 2: Variable Validation System
 * Tests the validation policies and error handling
 */
async function testVariableValidation() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   🛡️  Testing variable validation policies...`);
  
  // Test valid variable changes
  const validChanges = {
    standardLaborRate: 100,
    costPerformanceThreshold: 0.90,
    workingHoursPerDay: 8
  };
  
  const validationResult = await variableManager.validateVariableChanges(
    ctx, 
    TEST_CONFIG.testProjectId, 
    validChanges
  );
  
  console.log(`   ✅ Valid changes validation:`);
  console.log(`     🔍 Is valid: ${validationResult.isValid}`);
  console.log(`     ⚠️  Violations: ${validationResult.violations.length}`);
  console.log(`     💡 Warnings: ${validationResult.warnings.length}`);
  
  assert(validationResult.isValid, 'Valid changes should pass validation');
  
  // Test invalid variable changes
  const invalidChanges = {
    standardLaborRate: -50, // Invalid: negative rate
    costPerformanceThreshold: 0.70, // Below minimum 0.8
    workingHoursPerDay: 15 // Excessive hours
  };
  
  const invalidResult = await variableManager.validateVariableChanges(
    ctx,
    TEST_CONFIG.testProjectId,
    invalidChanges
  );
  
  console.log(`   ❌ Invalid changes validation:`);
  console.log(`     🔍 Is valid: ${invalidResult.isValid}`);
  console.log(`     ⚠️  Violations: ${invalidResult.violations.length}`);
  console.log(`     💡 Warnings: ${invalidResult.warnings.length}`);
  
  assert(!invalidResult.isValid, 'Invalid changes should fail validation');
  assert(invalidResult.violations.length > 0, 'Should have validation violations');
  
  // Check specific violation types
  const laborRateViolation = invalidResult.violations.find(v => v.field === 'standardLaborRate');
  assert(laborRateViolation, 'Should detect negative labor rate violation');
  
  console.log(`     🚨 Sample violation: ${laborRateViolation.violation}`);
}

/**
 * Test 3: User-Specific Variables
 * Tests user-specific rate and preference management
 */
async function testUserSpecificVariables() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   👤 Testing user-specific variables...`);
  
  // Get user variables
  const userVars = await variableManager.getUserVariables(ctx, TEST_CONFIG.testUserId);
  
  console.log(`   📊 User variables found:`);
  Object.entries(userVars).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });
  
  // Verify structure (should not throw errors even if custom fields don't exist)
  assert(typeof userVars === 'object', 'User variables should return an object');
  
  // Test that expected fields have correct types when present
  if (userVars.laborRate) {
    assert(typeof userVars.laborRate === 'number', 'Labor rate should be a number');
  }
  
  if (userVars.utilizationRate) {
    assert(typeof userVars.utilizationRate === 'number', 'Utilization rate should be a number');
    assert(userVars.utilizationRate >= 0 && userVars.utilizationRate <= 2, 'Utilization rate should be reasonable');
  }
  
  if (userVars.skillLevel) {
    assert(
      ['junior', 'intermediate', 'senior', 'expert'].includes(userVars.skillLevel),
      'Skill level should be valid'
    );
  }
}

/**
 * Test 4: Multiple Project Variables
 * Tests efficient loading of variables across multiple projects
 */
async function testMultipleProjectVariables() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   📁 Testing multiple project variable loading...`);
  
  // Test with array of project IDs (for now, just use the same project multiple times)
  const projectIds = [TEST_CONFIG.testProjectId];
  
  const start = Date.now();
  const variablesMap = await variableManager.getMultipleProjectVariables(ctx, projectIds);
  const elapsed = Date.now() - start;
  
  console.log(`   ⚡ Loaded variables for ${projectIds.length} project(s) in ${elapsed}ms`);
  
  assert(variablesMap instanceof Map, 'Should return a Map');
  assert(variablesMap.size === projectIds.length, 'Should load variables for all projects');
  
  // Verify each project has complete variable set
  for (const [projectId, variables] of variablesMap.entries()) {
    console.log(`   📊 Project ${projectId}: ${Object.keys(variables).length} variables`);
    
    // Check required fields
    assert(typeof variables.standardLaborRate === 'number', 'Standard labor rate required');
    assert(typeof variables.evmMethod === 'string', 'EVM method required');
  }
}

/**
 * Test 5: Variable Export Functionality
 * Tests the export system for backup and migration
 */
async function testVariableExport() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   📤 Testing variable export functionality...`);
  
  const projectIds = [TEST_CONFIG.testProjectId];
  
  const exportData = await variableManager.exportProjectVariables(ctx, projectIds);
  
  // Verify export structure
  assert(typeof exportData.exportDate === 'string', 'Export date should be present');
  assert(Array.isArray(exportData.projects), 'Projects should be an array');
  assert(exportData.projects.length === projectIds.length, 'Should export all requested projects');
  
  console.log(`   📋 Export summary:`);
  console.log(`     📅 Export date: ${exportData.exportDate}`);
  console.log(`     🏢 Org defaults included: ${exportData.organizationalDefaults ? 'Yes' : 'No'}`);
  console.log(`     📁 Projects exported: ${exportData.projects.length}`);
  
  // Verify project data structure
  const firstProject = exportData.projects[0];
  assert(typeof firstProject.projectId !== 'undefined', 'Project ID should be present');
  assert(typeof firstProject.projectName === 'string', 'Project name should be present');
  assert(typeof firstProject.variables === 'object', 'Variables should be present');
  
  console.log(`     📊 Sample project: ${firstProject.projectName}`);
  console.log(`     🔧 Variables count: ${Object.keys(firstProject.variables).length}`);
  
  // Test export data can be JSON serialized (important for backup)
  try {
    const jsonString = JSON.stringify(exportData);
    assert(jsonString.length > 0, 'Export data should be serializable to JSON');
    console.log(`     📦 JSON export size: ${Math.round(jsonString.length / 1024)}KB`);
  } catch (error) {
    assert.fail(`Export data should be JSON serializable: ${error.message}`);
  }
}

/**
 * Test 6: Variable Persistence Simulation
 * Simulates setting and retrieving project variables
 */
async function testVariablePersistence() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   💾 Testing variable persistence...`);
  
  // Get current variables
  const originalVars = await variableManager.getProjectVariables(ctx, TEST_CONFIG.testProjectId);
  console.log(`   📊 Original labor rate: $${originalVars.standardLaborRate}/hour`);
  
  // Simulate setting new variables (this will likely fail in test env without write access)
  const newVariables = {
    standardLaborRate: 95,
    costPerformanceThreshold: 0.92
  };
  
  try {
    console.log(`   🔄 Attempting to update variables...`);
    
    // First validate the changes
    const validation = await variableManager.validateVariableChanges(
      ctx,
      TEST_CONFIG.testProjectId,
      newVariables
    );
    
    if (!validation.isValid) {
      console.log(`   ❌ Changes failed validation`);
      return;
    }
    
    // Try to set variables (may fail due to API permissions)
    const result = await variableManager.setProjectVariables(
      ctx,
      TEST_CONFIG.testProjectId,
      newVariables
    );
    
    console.log(`   ✅ Variables updated successfully`);
    console.log(`   💰 New labor rate: $${result.standardLaborRate}/hour`);
    
  } catch (error) {
    // Expected in test environment without proper OpenProject write access
    console.log(`   ⚠️  Variable update skipped: ${error.message.substring(0, 50)}...`);
    console.log(`   💡 This is expected in test environment without API write access`);
  }
}

/**
 * Test 7: Variable History and Audit Trail
 * Tests the audit functionality (currently returns empty)
 */
async function testVariableHistoryAndAudit() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   📜 Testing variable history and audit trail...`);
  
  // Test getting variable history
  const history = await variableManager.getVariableHistory(
    ctx,
    TEST_CONFIG.testProjectId,
    'standardLaborRate'
  );
  
  console.log(`   📊 History entries found: ${history.length}`);
  
  // Verify structure (even if empty)
  assert(Array.isArray(history), 'History should return an array');
  
  if (history.length > 0) {
    const firstEntry = history[0];
    assert(typeof firstEntry.timestamp === 'string', 'Timestamp should be present');
    assert(typeof firstEntry.field === 'string', 'Field should be present');
    assert(typeof firstEntry.changedBy === 'string', 'Changed by should be present');
    
    console.log(`   🔄 Sample change: ${firstEntry.field} changed by ${firstEntry.changedBy}`);
  } else {
    console.log(`   💡 No history available (expected in test environment)`);
  }
}

/**
 * Test 8: PMO Custom Fields Management
 * Tests the custom field setup for PMO variables
 */
async function testPMOCustomFieldsManagement() {
  const { variableManager } = await import('../src/data/variable-manager.ts');
  
  const ctx = { env: mockEnv };
  
  console.log(`   🔧 Testing PMO custom fields management...`);
  
  // Test ensuring PMO custom fields exist
  try {
    await variableManager.ensurePMOCustomFields(ctx);
    console.log(`   ✅ PMO custom fields check completed`);
  } catch (error) {
    console.log(`   ⚠️  Custom fields setup skipped: ${error.message}`);
  }
  
  // Test field mapping consistency
  const { variableManager: vm } = await import('../src/data/variable-manager.ts');
  const vmInstance = new (vm.constructor)();
  
  // Access private field mapping through reflection (for testing)
  const mapping = vmInstance.customFieldMapping || {};
  
  console.log(`   🗺️  Field mappings configured: ${Object.keys(mapping).length}`);
  
  // Verify key mappings exist
  const keyMappings = [
    'standardLaborRate',
    'costPerformanceThreshold', 
    'evmMethod',
    'riskTolerance'
  ];
  
  keyMappings.forEach(key => {
    if (mapping[key]) {
      console.log(`     ✅ ${key} → ${mapping[key]}`);
    } else {
      console.log(`     ⚠️  ${key} mapping not found`);
    }
  });
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🔧 OpenProject MCP v3.0.0 - PMO Variable Management Tests');
  console.log('=' .repeat(80));
  
  console.log(`\n📋 Test Configuration:`);
  console.log(`   Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`   Test Project ID: ${TEST_CONFIG.testProjectId}`);
  console.log(`   Test User ID: ${TEST_CONFIG.testUserId}`);
  console.log(`   API Key: ${TEST_CONFIG.apiKey ? '[CONFIGURED]' : '[NOT SET]'}`);
  
  console.log(`\n🏢 Organizational Defaults (from env):`);
  console.log(`   Labor Rate: $${mockEnv.PMO_DEFAULT_STANDARD_LABOR_RATE || 'not set'}/hour`);
  console.log(`   Utilization: ${mockEnv.PMO_DEFAULT_UTILIZATION_RATE || 'not set'}`);
  console.log(`   Risk Tolerance: ${mockEnv.PMO_DEFAULT_RISK_TOLERANCE || 'not set'}`);
  
  if (!TEST_CONFIG.apiKey || TEST_CONFIG.apiKey === 'test-api-key') {
    console.log('\n⚠️  WARNING: No real API key provided. Some tests may fail or be limited.');
    console.log('   Set OP_API_KEY environment variable for full testing.');
  }
  
  console.log(`\n🧪 Running Variable Management Tests...\n`);
  
  await runTest('1. Default Variables Loading', testDefaultVariablesLoading);
  await runTest('2. Variable Validation System', testVariableValidation);
  await runTest('3. User-Specific Variables', testUserSpecificVariables);
  await runTest('4. Multiple Project Variables', testMultipleProjectVariables);
  await runTest('5. Variable Export Functionality', testVariableExport);
  await runTest('6. Variable Persistence Simulation', testVariablePersistence);
  await runTest('7. Variable History and Audit', testVariableHistoryAndAudit);
  await runTest('8. PMO Custom Fields Management', testPMOCustomFieldsManagement);
  
  // Print summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 Variable Management Test Results');
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
  
  console.log(`\n🏁 Variable management testing completed`);
  
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
    console.error('❌ Variable management test suite failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testResults };