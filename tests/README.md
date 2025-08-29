# OpenProject MCP Server - Test Suite

Basic test suite for critical MCP server functionality using Node.js built-in testing.

## Test Files

- **`health.test.js`** - Basic connectivity and health checks
- **`integration.test.js`** - Full workflow integration tests
- **`enterprise.test.js`** - Enterprise tool availability and validation tests
- **`enterprise-math.test.js`** - **NEW**: Mathematical accuracy validation for enterprise features
- **`edge-cases.test.js`** - Security vulnerabilities and edge case validation
- **`run-tests.js`** - Test runner and summary reporter

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites  
npm run test:health
npm run test:integration
npm run test:enterprise
npm run test:edge-cases

# Run mathematical validation tests (standalone)
node tests/enterprise-math.test.js

# Run tests with custom endpoint
MCP_ENDPOINT=http://localhost:8789/mcp npm test

# Validate deployment readiness
npm run validate
```

## Test Requirements

**For Basic Tests:**
- MCP server running (default: `http://localhost:8788/mcp`)
- Server responding to health checks

**For Integration Tests:** 
- Valid `OP_BASE_URL` and `OP_TOKEN` in `.dev.vars`
- OpenProject instance accessible
- API enabled in OpenProject settings

## Test Coverage

### Core Functionality ✅
- MCP server connectivity
- JSON-RPC protocol compliance
- Tools list endpoint
- Basic error handling
- Response time validation

### Mathematical Accuracy ✅ **NEW**
- **EVM Formula Validation** - PMBOK standard calculations (SPI, CPI, EAC, ETC, VAC, TCPI)
- **Critical Path Analysis** - Forward/backward pass algorithms with accurate float calculations
- **Predictive Analytics** - Heuristic, pattern matching, and decision tree model validation
- **Portfolio Resource Balancing** - Mathematical accuracy of utilization and rebalancing
- **Risk Assessment** - PERT estimation, standard deviation, and confidence intervals

### OpenProject Integration ⚠️
- Health check tool
- Projects list (requires API access)
- Work package operations (requires API access)
- Enterprise tools availability

### Expected Results

**All Tests Pass**: Core MCP server functionality working
**Mathematical Tests Pass**: All enterprise calculations are mathematically accurate (no shortcuts)
**Integration Tests Skip**: Normal if OpenProject API not configured
**Integration Tests Fail**: Check OP_BASE_URL, OP_TOKEN, and certificate trust

## Usage Examples

```bash
# Quick health check
npm run test:health

# Mathematical accuracy validation (standalone)
node tests/enterprise-math.test.js

# Full integration testing (requires OpenProject access)
npm run test:integration

# Complete test suite with summary
npm test
```

## Troubleshooting

**Server Not Responding:**
```bash
npm run dev  # Start server first
```

**TLS Certificate Errors:**
```bash
export NODE_EXTRA_CA_CERTS=./caddy-root.crt
npm test
```

**API Authentication Errors:**
- Verify OP_TOKEN in `.dev.vars`
- Check OpenProject API is enabled
- Confirm thisistheway.local accessibility