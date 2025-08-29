# How to Use the OpenProject MCP Server

## 🎯 Usage Scenarios

### 1. Local Development (You as the Developer)

You have several ways to use the server you built:

#### Option A: Claude Code + Local Server
```bash
# Terminal 1: Start your MCP server
npm run dev
# Server runs on http://localhost:8788/mcp
```

Create `.claude/settings.json` (gitignored):
```json
{
  "mcp": {
    "servers": {
      "openproject-local": {
        "command": "node",
        "args": ["-e", "
          const { spawn } = require('child_process');
          const proc = spawn('npm', ['run', 'dev'], { 
            cwd: process.cwd(),
            stdio: 'inherit' 
          });
          process.on('SIGTERM', () => proc.kill());
        "]
      }
    }
  }
}
```

**OR use HTTP transport directly:**
```json
{
  "mcp": {
    "servers": {
      "openproject-http": {
        "transport": "http",
        "url": "http://localhost:8788/mcp"
      }
    }
  }
}
```

#### Option B: MCP Inspector for Testing
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Use MCP Inspector
npm run inspect
# Opens inspector UI to test tools interactively
```

#### Option C: Direct HTTP Testing
```bash
# Test individual tools
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "projects.list",
      "arguments": {}
    }
  }'
```

### 2. Deployed for Personal Use

Deploy to Cloudflare Workers for your own use:

```bash
# 1. Deploy to Cloudflare Workers
npm run deploy

# 2. Configure secrets
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN

# 3. Get your deployment URL
# e.g., https://openproject-mcp.your-subdomain.workers.dev

# 4. Configure Claude Code for deployed version
```

**Note**: The deployed version includes both endpoints:
- `/mcp` - Primary MCP protocol endpoint
- `/sse` - Server-Sent Events endpoint (disabled by default, set `SSE_ENABLED=true` to enable)

`.claude/settings.json` for deployed version:
```json
{
  "mcp": {
    "servers": {
      "openproject-prod": {
        "transport": "http", 
        "url": "https://openproject-mcp.your-subdomain.workers.dev/mcp"
      }
    }
  }
}
```

### 3. Share with Others

For others to use your MCP server, they need either:

#### Option A: They Deploy Their Own
```bash
# They clone your repo
git clone <your-repo>
cd openproject-mcp

# They configure their environment
cp .env.example .dev.vars
# Edit .dev.vars with their OpenProject details

# They deploy to their Cloudflare account
npm run deploy
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN
```

#### Option B: You Host a Public Instance
```bash
# You deploy a shared instance
npm run deploy

# Configure for multi-tenant (if needed)
# Others connect to: https://your-public-deployment.workers.dev/mcp
```

## 🔧 Practical Development Workflow

### Daily Usage Pattern
```bash
# 1. Start development environment
npm run dev

# 2. Open Claude Code in project directory
# (automatically uses .claude/settings.json)

# 3. In Claude Code conversation:
```

**Example conversation in Claude Code:**
```
You: List my OpenProject projects
# Claude uses your tools.list tool automatically

You: Create a new work package for project 5 about "Fix login bug"
# Claude uses wp.create tool

You: Who are the developers I can assign this to?
# Claude uses users.search tool
```

### Tool Usage Examples

**Project Discovery:**
```json
// Get all projects
{"method": "tools/call", "params": {"name": "projects.list"}}

// Find specific project
{"method": "tools/call", "params": {"name": "projects.list", "arguments": {"q": "website"}}}
```

**Work Package Management:**
```json
// List work packages
{"method": "tools/call", "params": {"name": "wp.list", "arguments": {"projectId": 1}}}

// Create work package
{"method": "tools/call", "params": {
  "name": "wp.create", 
  "arguments": {
    "projectId": 1,
    "typeId": 1, 
    "subject": "Fix authentication bug",
    "description": "Users can't login with special characters"
  }
}}

// Update work package  
{"method": "tools/call", "params": {
  "name": "wp.update",
  "arguments": {
    "id": 123,
    "lockVersion": 5,
    "statusId": 7
  }
}}
```

**User and Resource Discovery:**
```json
// Find team members
{"method": "tools/call", "params": {"name": "users.search", "arguments": {"q": "john"}}}

// Get work package statuses
{"method": "tools/call", "params": {"name": "statuses.list", "arguments": {"projectId": 1}}}

// Get project versions
{"method": "tools/call", "params": {"name": "versions.list", "arguments": {"projectId": 1}}}
```

## 🌍 Distribution Scenarios

### For Personal Use Only
- Run locally during development
- Deploy to your own Cloudflare Workers account
- Configure Claude Code to use your deployment

### For Team Use
- Deploy to shared Cloudflare Workers account
- Team members configure Claude Code to use shared endpoint
- Manage access through OpenProject user permissions

### For Public Use
- Publish to npm as an MCP server package
- Users install and run locally: `npx openproject-mcp`
- Or provide hosted service with authentication

## ⚡ Quick Start Checklist

**For immediate use:**
- [ ] Copy `.env.example` to `.dev.vars`
- [ ] Add your OpenProject URL and token to `.dev.vars`
- [ ] Add your certificate as `caddy-root.crt` (if needed)
- [ ] Run `npm run dev`
- [ ] Configure Claude Code with local server
- [ ] Test: Ask Claude to "list my OpenProject projects"

**For production use:**
- [ ] Deploy to Cloudflare Workers: `npm run deploy`
- [ ] Configure secrets: `npx wrangler secret put OP_BASE_URL`
- [ ] Update Claude Code config to use deployed URL
- [ ] Test tools work from deployed instance

## 🔍 Testing Your Setup

### MCP Endpoint Testing
```bash
# 1. Health check
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"op.health","arguments":{}}}'

# 2. List tools
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 3. Test project listing
curl -X POST http://localhost:8788/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"projects.list","arguments":{}}}'
```

### SSE Endpoint Testing (Optional)
```bash
# 1. Check if SSE is enabled (should return 404 if disabled)
curl -X GET http://localhost:8788/sse

# 2. Enable SSE in your environment
# Set SSE_ENABLED=true in .dev.vars, then restart server

# 3. Test SSE connection with filters
curl -X GET "http://localhost:8788/sse?projectId=1&eventType=project_update" \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache"

# 4. JavaScript client example
const eventSource = new EventSource('/sse?projectId=1');
eventSource.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

Your MCP server bridges the gap between Claude and OpenProject - making project management conversational and AI-assisted!