# Personal Setup Guide - OpenProject MCP Server v3.2.0

> **Your Private Use Configuration Guide**  
> This guide is tailored for your specific OpenProject setup at `thisistheway.local`

## Quick Start Checklist

- [ ] Copy `.env.example` to `.dev.vars`
- [ ] Update OpenProject URL and API token
- [ ] Test connection with health check
- [ ] Configure Claude Code integration
- [ ] Deploy to Cloudflare Workers (optional)

## Initial Setup

### 1. Environment Configuration

```bash
# Copy the environment template
cp .env.example .dev.vars

# Edit with your actual values
nano .dev.vars
```

**Required Configuration:**
```bash
# Your OpenProject instance
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=your_actual_api_token_here

# Claude Code integration
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
```

### 2. API Token Setup

1. Log in to your OpenProject instance at `thisistheway.local`
2. Go to: **User menu** → **My account** → **Access tokens**
3. Click **Generate API key**
4. Copy the token and add it to your `.dev.vars` file
5. Ensure the token has appropriate permissions for project management

### 3. TLS Certificate (if needed)

If using custom/self-signed certificates:
```bash
# Place your CA certificate in the project root
cp /path/to/your/ca-cert.pem ./caddy-root.crt
```

The development scripts automatically use `NODE_EXTRA_CA_CERTS=./caddy-root.crt`

## Development Workflow

### Starting the Server

```bash
# Standard development server
npm run dev

# Clean start (clears cache)
npm run dev:clean

# Remote development (not local mode)
npm run dev:remote
```

### Testing Your Setup

```bash
# Quick health check
npm run health

# Manual health check
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"op.health","arguments":{}}}'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{"type": "text", "text": "..."}],
    "_meta": {
      "structuredContent": {
        "status": "ok",
        "statusCode": 200,
        "instanceName": "OpenProject",
        "version": "..."
      }
    }
  }
}
```

### MCP Inspector Integration

```bash
# Launch MCP Inspector for debugging
npm run inspect

# Launch with auto-open browser
npm run inspect:open
```

## Claude Code Integration

### Configuration in Claude Code

1. Open Claude Code settings
2. Add MCP server configuration:
   ```json
   {
     "mcpServers": {
       "openproject": {
         "command": "http",
         "args": ["http://localhost:8788/mcp"]
       }
     }
   }
   ```

### Common Tool Usage

**Health Check:**
```
Use the op.health tool to check OpenProject connectivity
```

**List Projects:**
```
Use projects.list to see all available projects
```

**Create Work Package:**
```
Use wp.create with projectId=1, typeId=1, subject="Your task"
```

**Search Users:**
```
Use users.search with q="john" to find team members
```

## Your Typical Workflows

### Daily Project Management

1. **Morning Status Check:**
   - Use `projects.list` to see project overview
   - Use `wp.list` with filters for today's tasks
   - Use `users.me` to check your assignments

2. **Creating Tasks:**
   - Use `wp.create` for new work packages
   - Use `wp.attach` to add documentation
   - Use `wp.update` to modify existing tasks

3. **Team Collaboration:**
   - Use `users.search` to find team members
   - Use `wp.update` to assign tasks
   - Use time tracking tools for logging hours

### Weekly Planning

1. **Portfolio Review:**
   - Use enterprise portfolio tools
   - Check milestone progress
   - Review risk assessments

2. **Resource Planning:**
   - Use time tracking reports
   - Review capacity planning
   - Update project schedules

## Troubleshooting

### Common Issues

**Connection Refused:**
- Check if OpenProject is running
- Verify `OP_BASE_URL` is correct
- Test direct API access: `curl -u "apikey:$OP_TOKEN" https://thisistheway.local/api/v3/`

**Authentication Errors:**
- Verify API token is correct
- Check token hasn't expired
- Ensure token has sufficient permissions

**TLS/SSL Issues:**
- Verify `caddy-root.crt` is present
- Check certificate chain is complete
- Try with `OP_ALLOW_INSECURE_HTTP=true` for testing (development only)

**CORS Errors:**
- Add your client origin to `ALLOWED_ORIGINS`
- Check MCP client headers are correct
- Verify Accept header includes `application/json`

### Debug Mode

Enable verbose logging:
```bash
# In .dev.vars
LOG_LEVEL=debug
DEBUG_API_REQUESTS=true
```

### Performance Issues

Monitor request timing:
```bash
# In .dev.vars  
ENABLE_PERFORMANCE_MONITORING=true
```

## Deployment Options

### Cloudflare Workers (Recommended)

```bash
# Test build first
npm run build

# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging
```

**Set production secrets:**
```bash
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN
# Enter your values when prompted
```

### Docker (Alternative)

See `docs/docker-guide.md` for containerized deployment.

## Backup & Maintenance

### Configuration Backup

```bash
# Backup your configuration (without secrets)
cp .env.example .env.backup
cp wrangler.jsonc wrangler.backup.jsonc

# Your API tokens are in Cloudflare Workers secrets (safe)
```

### Updates

```bash
# Update dependencies
npm run update-deps

# Check for security issues
npm audit
```

### Monitoring

Set up basic monitoring:
```bash
# In .dev.vars
HEALTH_CHECK_URL=https://your-monitoring-service.com/webhook
```

## Tips for Your Setup

1. **Use Project Templates:** Set up common project structures in OpenProject
2. **Custom Fields:** Configure enterprise custom fields for your workflow
3. **Automation:** Use the MCP server with Claude Code for automated project creation
4. **Reporting:** Leverage enterprise reporting tools for stakeholder updates
5. **Compliance:** Use audit trails and governance features for enterprise requirements

## Support & Updates

- Check `CHANGELOG.md` for version updates
- Monitor GitHub issues for community fixes
- Update dependencies monthly
- Backup configurations before major updates

---

**Version:** 2.0.0  
**Last Updated:** August 2025  
**Your Setup:** thisistheway.local