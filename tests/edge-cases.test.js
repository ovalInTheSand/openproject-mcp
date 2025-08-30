#!/usr/bin/env node

/**
 * Edge Cases and Security Validation Test Suite
 * Tests potential vulnerabilities, edge cases, and robustness
 * Run with: node tests/edge-cases.test.js
 */

import { test } from 'node:test';
import { strictEqual, ok, throws } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

/**
 * Test package.json for potential security issues
 */
test('Edge Case: Package.json Security Validation', async (t) => {
  console.log('\n🔒 Testing package.json security...');
  
  const packagePath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
  
  // Check for potential security issues
  ok(packageJson.private === true, 'Package should be marked as private');
  ok(!packageJson.scripts?.postinstall, 'No postinstall scripts (security risk)');
  ok(!packageJson.scripts?.preinstall, 'No preinstall scripts (security risk)');
  
  // Check for reasonable version constraints
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const [name, version] of Object.entries(deps)) {
    ok(typeof version === 'string', `Dependency ${name} version should be string`);
    ok(!version.includes('file:'), `No file: dependencies (${name})`);
    ok(!version.includes('git+'), `No git dependencies (${name}) - found git+ reference`);
  }
  
  console.log('   ✅ Package security checks passed');
});

/**
 * Test environment configuration for potential issues
 */
test('Edge Case: Environment Configuration Validation', async (t) => {
  console.log('\n🌐 Testing environment configuration...');
  
  const envPath = join(projectRoot, '.env.example');
  const envContent = await readFile(envPath, 'utf-8');
  
  // Check for potential security issues
  ok(!envContent.includes('password='), 'No hardcoded passwords');
  ok(!envContent.includes('secret='), 'No hardcoded secrets');
  ok(!envContent.includes('key='), 'No hardcoded keys (except explanatory text)');
  
  // Check for proper CORS configuration
  ok(envContent.includes('ALLOWED_ORIGINS'), 'CORS origins configuration present');
  ok(envContent.includes('https://claude.ai'), 'Claude.ai domain in CORS config');
  
  // Check for development security warnings
  ok(envContent.includes('NEVER set this to true in production'), 'Production security warning present');
  
  console.log('   ✅ Environment security checks passed');
});

/**
 * Test TypeScript configuration for edge cases
 */
test('Edge Case: TypeScript Configuration Validation', async (t) => {
  console.log('\n🔍 Testing TypeScript configuration...');
  
  const tsconfigPath = join(projectRoot, 'tsconfig.json');
  const tsconfigContent = JSON.parse(await readFile(tsconfigPath, 'utf-8'));
  
  // Check for security-related TypeScript settings
  ok(tsconfigContent.compilerOptions.target, 'Target specified');
  ok(tsconfigContent.compilerOptions.module, 'Module type specified');
  
  // Check for reasonable settings
  ok(tsconfigContent.compilerOptions.strict !== undefined, 'Strict mode configured');
  ok(tsconfigContent.compilerOptions.skipLibCheck !== undefined, 'skipLibCheck configured');
  
  console.log('   ✅ TypeScript configuration checks passed');
});

/**
 * Test file permissions and structure
 */
test('Edge Case: File Structure and Permissions', async (t) => {
  console.log('\n📁 Testing file structure...');
  
  // Check for essential files
  const essentialFiles = [
    'package.json',
    'README.md',
    'LICENSE',
    'src/index.ts',
    'src/server.ts'
  ];
  
  for (const file of essentialFiles) {
    const filePath = join(projectRoot, file);
    try {
      await readFile(filePath, 'utf-8');
      console.log(`   ✅ ${file} exists`);
    } catch (error) {
      throw new Error(`Essential file missing: ${file}`);
    }
  }
  
  // Check for potentially dangerous files
  const dangerousFiles = [
    '.env',  // Should be .dev.vars for Wrangler
    'npm-debug.log',
    'yarn-error.log',
    '.npmrc',
    '.yarnrc'
  ];
  
  for (const file of dangerousFiles) {
    const filePath = join(projectRoot, file);
    try {
      await readFile(filePath, 'utf-8');
      console.log(`   ⚠️  Potentially sensitive file found: ${file}`);
    } catch {
      // File doesn't exist, which is good
    }
  }
  
  console.log('   ✅ File structure validation passed');
});

/**
 * Test for potential code injection vectors
 */
test('Edge Case: Code Injection Prevention', async (t) => {
  console.log('\n🛡️  Testing code injection prevention...');
  
  const serverPath = join(projectRoot, 'src/server.ts');
  const serverContent = await readFile(serverPath, 'utf-8');
  
  // Check for potential injection vulnerabilities
  ok(!serverContent.includes('eval('), 'No eval() usage');
  ok(!serverContent.includes('Function('), 'No Function() constructor');
  // Allow functional setTimeout/setInterval but disallow string-eval style usage
  ok(!/setTimeout\s*\(\s*['"]/i.test(serverContent), 'No setTimeout with string code');
  ok(!/setInterval\s*\(\s*['"]/i.test(serverContent), 'No setInterval with string code');
  
  // Check for SQL injection prevention (should not have raw SQL)
  ok(!serverContent.includes('SELECT '), 'No raw SQL queries');
  ok(!serverContent.includes('INSERT '), 'No raw SQL inserts');
  ok(!serverContent.includes('UPDATE '), 'No raw SQL updates');
  ok(!serverContent.includes('DELETE '), 'No raw SQL deletes');
  
  console.log('   ✅ Code injection prevention checks passed');
});

/**
 * Test CORS configuration for edge cases
 */
test('Edge Case: CORS Configuration Security', async (t) => {
  console.log('\n🌐 Testing CORS security...');
  
  const indexPath = join(projectRoot, 'src/index.ts');
  const indexContent = await readFile(indexPath, 'utf-8');
  
  // Check for secure CORS implementation
  ok(indexContent.includes('c.env.ALLOWED_ORIGINS'), 'CORS origins from environment');
  ok(!indexContent.includes('origin: "*"'), 'No wildcard CORS origins in code');
  ok(!indexContent.includes('allowHeaders: ["*"]'), 'No wildcard headers');
  
  // Check for proper header handling
  ok(indexContent.includes('allowHeaders:'), 'Explicit allowed headers');
  ok(indexContent.includes('allowMethods:'), 'Explicit allowed methods');
  
  console.log('   ✅ CORS security checks passed');
});

/**
 * Test dependency vulnerabilities (basic check)
 */
test('Edge Case: Dependency Security Check', async (t) => {
  console.log('\n📦 Testing dependency security...');
  
  const packagePath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
  
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Check for known problematic patterns
  for (const [name, version] of Object.entries(allDeps)) {
    // Check for overly permissive version ranges
    if (version.startsWith('^') || version.startsWith('~')) {
      // This is normal, but log for awareness
    }
    
    // Check for exact versions that might be outdated
    if (!version.startsWith('^') && !version.startsWith('~') && !version.includes('-')) {
      console.log(`   ⚠️  Exact version specified for ${name}: ${version}`);
    }
  }
  
  // Check total dependency count (excessive dependencies can increase attack surface)
  const totalDeps = Object.keys(allDeps).length;
  ok(totalDeps < 20, `Reasonable dependency count: ${totalDeps} < 20`);
  
  console.log(`   ✅ Dependency security checks passed (${totalDeps} dependencies)`);
});

/**
 * Test for potential resource exhaustion
 */
test('Edge Case: Resource Exhaustion Prevention', async (t) => {
  console.log('\n⚡ Testing resource exhaustion prevention...');
  
  const serverPath = join(projectRoot, 'src/server.ts');
  const serverContent = await readFile(serverPath, 'utf-8');
  
  // Check for potential infinite loops or recursion
  ok(!serverContent.includes('while(true)'), 'No infinite while loops');
  ok(!serverContent.includes('for(;;)'), 'No infinite for loops');
  
  // Check for proper error handling
  ok(serverContent.includes('try'), 'Error handling present');
  ok(serverContent.includes('catch'), 'Error catching present');
  
  console.log('   ✅ Resource exhaustion prevention checks passed');
});

/**
 * Test edge cases in tool registration
 */
test('Edge Case: Tool Registration Validation', async (t) => {
  console.log('\n🔧 Testing tool registration edge cases...');
  
  const serverPath = join(projectRoot, 'src/server.ts');
  const serverContent = await readFile(serverPath, 'utf-8');
  
  // Count tool registrations
  const toolRegistrations = serverContent.match(/registerToolHelper/g);
  ok(toolRegistrations, 'Tool registrations found');
  ok(toolRegistrations.length >= 50, `Adequate tool count: ${toolRegistrations.length}`);
  
  // Check for consistent naming patterns
  ok(serverContent.includes('"op.health"'), 'Health tool registered');
  ok(serverContent.includes('"projects.list"'), 'Projects list tool registered');
  ok(serverContent.includes('"wp.list"'), 'Work packages list tool registered');
  
  console.log(`   ✅ Tool registration checks passed (${toolRegistrations.length} tools)`);
});

console.log('\n🔍 OpenProject MCP Server - Edge Cases & Security Test Suite');
console.log('=' .repeat(65));
console.log('Testing for security vulnerabilities, edge cases, and robustness');
console.log('');