# Troubleshooting Guide - OpenProject MCP Server v2.0.0

> **Based on real development experience with thisistheway.local**  
> Solutions derived from LESSONS.yaml and actual deployment challenges

## Quick Diagnostic Commands

```bash
# Health check
npm run health

# Manual MCP test
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"op.health","arguments":{}}}'

# Environment verification
npm run version
```

## Common Issues & Solutions

### 1. TLS Certificate Errors

**Symptoms:**
- `CERT_UNTRUSTED` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
- Connection refused to `https://thisistheway.local`
- SSL handshake failures

**Root Cause (from LESSONS.yaml):**
```yaml
id: "caddy-tls-trust"
root_cause: "Node doesn't trust Caddy local CA by default"
```

**Solution:**
```bash
# 1. Locate your Caddy root certificate
# Linux/WSL
export NODE_EXTRA_CA_CERTS=~/.local/share/caddy/pki/authorities/local/root.crt

# Windows
$env:NODE_EXTRA_CA_CERTS='C:\Users\<you>\AppData\Local\Caddy\pki\authorities\local\root.crt'

# 2. Copy to project root for npm scripts
cp $NODE_EXTRA_CA_CERTS ./caddy-root.crt

# 3. Test certificate format
openssl x509 -in caddy-root.crt -text -noout | head -5

# 4. Restart development server
npm run dev
```

**Alternative for Testing Only:**
```bash
# In .dev.vars (NEVER in production)
OP_BASE_URL=http://thisistheway.local  # Use HTTP instead of HTTPS
```

### 2. OpenProject API Authentication

**Symptoms:**
- `401 Unauthorized` responses
- "Invalid API key" errors
- Authentication loops

**Root Cause (from LESSONS.yaml):**
```yaml
id: "op-basic-auth"  
fix: "Authorization: Basic base64('apikey:<token>')"
```

**Solution:**
```bash
# 1. Verify API is enabled in OpenProject
# Navigate to: Administration → API & webhooks → Enable API

# 2. Test API key manually
curl -i -u apikey:<YOUR_TOKEN> \
  -H 'accept: application/hal+json' \
  https://thisistheway.local/api/v3/

# Expected: 200 OK with OpenProject root document

# 3. Verify token permissions
# User menu → My account → Access tokens → Check permissions

# 4. Check .dev.vars format
OP_TOKEN=your_actual_token_here  # No quotes, no extra spaces
```

### 3. Development Server Issues

**Symptoms:**
- Port conflicts (address already in use)
- Server won't start
- Hot reload not working

**Solutions:**
```bash
# Kill existing servers
pkill -f wrangler || true
pkill -f node || true

# Clean restart
npm run clean && npm run dev

# Use different port
wrangler dev --port=8789

# Check what's using the port
lsof -i :8788  # macOS/Linux
netstat -ano | findstr :8788  # Windows
```

### 4. MCP Inspector Connection

**Symptoms:**
- Inspector can't connect to server
- Tools not appearing in Inspector UI
- MCP protocol errors

**Solutions:**
```bash
# 1. Verify MCP endpoint is running
curl http://localhost:8788/mcp -H "Accept: text/plain"
# Should return: Method not allowed (but server is responsive)

# 2. Start Inspector
npm run inspect

# 3. Check CORS settings in .dev.vars
ALLOWED_ORIGINS=http://localhost:7000,http://localhost:7001

# 4. Verify Inspector configuration
cat > .mcp.json << EOF
{
  "mcpServers": {
    "openproject-mcp": {
      "command": "npm",
      "args": ["run", "dev"],
      "env": {
        "OP_BASE_URL": "https://thisistheway.local",
        "OP_TOKEN": "your_token_here"
      }
    }
  }
}
EOF
```

### 5. Claude Code Integration

**Symptoms:**
- Claude Code can't see tools
- Connection timeout errors
- Invalid MCP server configuration

**Solutions:**
```bash
# 1. Verify server is accessible
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 2. Check Claude Code configuration
# In .claude/settings.json:
{
  "mcp": {
    "servers": {
      "openproject": {
        "command": "node",
        "args": ["/absolute/path/to/your/project/dist/index.js"],
        "env": {
          "OP_BASE_URL": "https://thisistheway.local",
          "OP_TOKEN": "your-token"
        }
      }
    }
  }
}

# 3. Build and test
npm run build
node dist/index.js  # Should not error
```

### 6. TypeScript Compilation Errors

**Symptoms:**
- `tsc --noEmit` fails
- Cannot find module errors
- Type mismatches in enterprise tools

**Solutions:**
```bash
# 1. Check TypeScript configuration
npm run typecheck

# 2. For enterprise tools (expected ~20 warnings)
# These are non-blocking for core functionality

# 3. Clean build
rm -rf dist .wrangler node_modules
npm install
npm run build

# 4. If imports fail, check module extensions
# Use .js extensions in imports (not .ts) for ES modules
```

### 7. Environment Variable Loading

**Symptoms:**
- Variables not available in handlers
- `OP_BASE_URL not configured` errors
- Development vs production mismatch

**Solutions:**
```bash
# 1. Verify .dev.vars format (no export, no quotes)
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=abc123

# 2. Restart Wrangler after changes
pkill -f wrangler && npm run dev

# 3. Debug environment availability
# Add temporary logging in src/tools/health.ts
console.log("ENV check:", { 
  hasBaseUrl: !!env.OP_BASE_URL,
  hasToken: !!env.OP_TOKEN 
});

# 4. For production deployment
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN
```

### 8. Performance Issues

**Symptoms:**
- Slow response times
- Timeout errors
- High memory usage

**Solutions:**
```bash
# 1. Enable performance monitoring
# In .dev.vars
ENABLE_PERFORMANCE_MONITORING=true

# 2. Optimize queries with pagination
# Use pageSize: 20 instead of large limits

# 3. Check OpenProject server load
curl -w "@timing.txt" https://thisistheway.local/api/v3/

# 4. Monitor Wrangler dev logs
npm run dev | tee debug.log
```

### 9. Deployment Issues

**Symptoms:**
- Wrangler deployment fails
- Secret configuration errors
- Route configuration problems

**Solutions:**
```bash
# 1. Verify authentication
wrangler auth whoami

# 2. Test deployment with --dry-run
wrangler deploy --dry-run

# 3. Check resource limits in wrangler.toml
# Ensure cpu_ms is adequate for your usage

# 4. Set secrets individually
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN
npx wrangler secret put ALLOWED_ORIGINS

# 5. Test deployed endpoint
curl https://your-worker.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Enterprise Tools Specific Issues

### Advanced PM Features
The enterprise tools (39 advanced features) may have TypeScript warnings but remain functional:

**Expected Behavior:**
- Core 14 tools: ✅ Full TypeScript compliance
- Enterprise 39 tools: ⚠️ TypeScript warnings, runtime functional

**When to Use:**
- **Daily PM work:** Use core tools (reliable)
- **Advanced features:** Use enterprise tools (functional with warnings)

**Fix Timeline:**
```yaml
immediate: "Core tools ready for production use"
phase_2: "Enterprise tool TypeScript refinement"
```

## Development Environment

### WSL Specific Issues
```bash
# File system performance
# Use Windows filesystem for better performance
cd /mnt/c/dev/openproject-mcp

# Certificate paths
cp /mnt/c/path/to/cert.crt ./caddy-root.crt
```

### macOS Specific Issues
```bash
# Keychain certificate issues
security find-certificate -a -c "Caddy Local CA"

# Port binding issues
sudo lsof -i :8788
```

## Monitoring & Observability

### Health Monitoring
```bash
# Create health check script
echo '#!/bin/bash
curl -f http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"op.health\",\"arguments\":{}}}" \
  && echo "✅ MCP Server healthy" \
  || echo "❌ MCP Server unhealthy"' > health-check.sh
chmod +x health-check.sh
```

### Log Analysis
```bash
# Analyze Wrangler logs
npm run dev 2>&1 | grep -E "(error|Error|ERROR|fail|timeout)"

# Check OpenProject logs
tail -f /path/to/openproject/log/production.log | grep API
```

## Getting Help

1. **Check LESSONS.yaml** - Contains proven solutions to common issues
2. **Review CLAUDE.md** - Your project-specific configurations
3. **Test with curl** - Verify API endpoints directly
4. **Use MCP Inspector** - Debug MCP protocol issues
5. **Check OpenProject logs** - Server-side debugging

## Emergency Fixes

### Quick Server Restart
```bash
pkill -f wrangler && npm run clean && npm run dev
```

### Reset to Known Good State
```bash
git stash
npm run clean
npm install
cp .env.example .dev.vars
# Edit .dev.vars with your actual values
npm run dev
```

### Validate Core Functionality
```bash
npm run health && echo "✅ Core functionality working"
```

---

**Last Updated:** August 2025  
**Based on:** LESSONS.yaml v2.0 and real deployment experience  
**Your Environment:** thisistheway.local with Caddy TLS