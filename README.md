# OpenProject MCP Server 🚀

**Advanced MCP server with hybrid OpenProject API integration, real-time webhooks, enhanced notifications, internal comments, negative lag dependencies, dynamic PMO variables, and AI-powered enterprise analytics**

A sophisticated Model Context Protocol (MCP) server that provides comprehensive access to OpenProject APIs with advanced enterprise features. Built for [Claude Code](https://claude.ai/code) and other MCP-compatible clients.

## 🚀 Quick Start

### Prerequisites
- Docker (recommended) or Node.js 18+
- OpenProject instance with API access
- API key from your OpenProject user account

### 30-Second Docker Setup

```bash
# 1. Copy environment configuration
cp .env.example .env.docker
# Edit .env.docker with your OpenProject URL and API token

# 2. Build and start
./build.sh
./up.sh

# 3. Test the server
curl -X POST http://localhost:8788/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Your MCP server is now running at `http://localhost:8788/mcp` 🎉

### Quick Commands
- **Build**: `./build.sh` (shorter than docker-compose build)
- **Start**: `./up.sh` (starts in detached mode)
- **Stop**: `docker-compose down`
- **Logs**: `docker-compose logs -f`
- **Development**: `./up.sh --dev` or use `docker-compose.dev.yml`

---

## 📖 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🎯 Features](#-features)
  - [🔄 Hybrid Data Architecture](#-hybrid-data-architecture)
  - [🔧 Dynamic PMO Variables](#-dynamic-pmo-variables)
  - [🗄️ Intelligent Caching System](#️-intelligent-caching-system)
  - [🔄 Real-time Integration](#-real-time-integration)
  - [⚡ Performance Optimizations](#-performance-optimizations)
  - [🧰 90 MCP Tools](#-90-mcp-tools-core--enterprise--hybrid--real-time)
- [🔧 Installation & Configuration](#-installation--configuration)
- [🐳 Docker Deployment](#-docker-deployment)
- [🔒 Security & Access Control](#-security--access-control)
- [🛠️ Available Tools](#️-available-tools)
  - [🔄 Real-time & Communication Tools](#-real-time--communication-tools)
  - [📊 Core & Hybrid Tools](#-core--hybrid-tools)
  - [🏢 Enterprise Tools](#-enterprise-tools)
- [📋 Examples](#-examples)
- [⚙️ Environment Variables](#️-environment-variables)
- [🔧 Development](#-development)
- [🐛 Troubleshooting](#-troubleshooting)
- [📚 Documentation](#-documentation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Key Features

- **🔄 Hybrid Architecture** - Native OpenProject + Custom PMBOK-compliant EVM analytics
- **🧰 90+ MCP Tools** - Complete project management suite with enterprise features
- **⚡ Real-time Integration** - Webhooks, notifications, and internal comments
- **🗄️ Intelligent Caching** - SQLite-based performance optimization
- **🔒 Enterprise Security** - HMAC signing, RBAC, rate limiting
- **🏗️ Forms-first Validation** - Uses OpenProject's native validation API

### Node.js Setup
```bash
git clone <your-repo-url> && cd openproject-mcp
npm install
cp .env.example .dev.vars  # Edit with your OpenProject URL and API token
npm run dev  # Server available at http://localhost:8788/mcp
```

### Docker Setup (Recommended)
```bash
cp .env.example .env.docker  # Edit with your settings
./build.sh && ./up.sh        # Build and start
```

## 🔒 Security Features

- **Rate Limiting** - 200 requests/minute per IP (configurable)
- **HMAC Signing** - Request signature validation with replay protection
- **RBAC Scopes** - Role-based tool access control
- **Input Validation** - Size limits, depth checks, type validation
- **TLS Support** - Custom CA certificates for internal deployments

## 🛠️ Available Tools (90+)

### 📋 Core Tools
- **Project Management** - `projects.list`, `wp.create/update/list`, `queries.run`
- **Workflow** - `statuses.list`, `priorities.list`, `users.search`, `versions.list`
- **Files** - `wp.attach` with multipart/form-data support

### ⚡ Real-time & Communication
- **Notifications** (5 tools) - Filter by reason, mark read, create reminders
- **Comments** (5 tools) - Internal comments with security validation
- **Webhooks** (7 tools) - Real-time events with delivery monitoring

### 🏢 Enterprise Suite
- **Advanced Projects** - Enterprise creation with PMBOK governance
- **Schedule Management** - Critical path, dependencies, resource allocation
- **Time Tracking** - Cost accounting, billing rates, timesheets
- **Analytics** - EVM reports, dashboard KPIs, utilization metrics
- **Portfolio Management** - Multi-project coordination and benefits tracking

## 📋 Examples

### Basic Work Package Creation
```json
{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": {
    "name": "wp.create",
    "arguments": {
      "projectId": 1, "typeId": 1,
      "subject": "Fix authentication bug",
      "dryRun": false
    }
  }
}
```

### Real-time Webhook Setup
```json
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": {
    "name": "webhooks.create",
    "arguments": {
      "name": "MCP Updates",
      "url": "https://your-server.com/webhook",
      "events": ["work_package:updated", "work_package:commented"],
      "projects": [1, 2, 3]
    }
  }
}
```

## 🐳 Docker Deployment

### Simple Commands
- `./build.sh` - Build image
- `./up.sh` - Start server
- `./up.sh --dev` - Development mode

### Production Deployment
```bash
cp .env.example .env.docker  # Configure your settings
./build.sh && ./up.sh -d     # Build and start detached
```

## ⚙️ Environment Variables

### Required
- `OP_BASE_URL` - Your OpenProject instance URL
- `OP_TOKEN` - OpenProject API key

### Optional
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)
- `MCP_RATE_LIMIT` - Requests per minute (default: 200)
- `MCP_HMAC_SECRET` - Enable HMAC request signing
- `SSE_ENABLED` - Enable Server-Sent Events (default: false)

## 🔧 Development

### Project Structure
- `src/index.ts` - Hono app + MCP transport
- `src/tools/` - Domain-specific tool modules
- `src/util/op.ts` - OpenProject API client

### Adding Tools
1. Create tool module in `src/tools/`
2. Register in `src/server.ts`
3. Follow forms-first validation patterns

## 🐛 Troubleshooting

### Common Issues
- **TLS Errors**: Copy certificate to `./caddy-root.crt`
- **Auth Errors**: Verify `OP_BASE_URL` (no trailing slash) and `OP_TOKEN`
- **CORS Issues**: Update `ALLOWED_ORIGINS` environment variable

### Health Check
```bash
curl -X POST http://localhost:8788/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":"health","method":"tools/list"}'
```

## 📚 Documentation

- **[API Reference](docs/api-reference.md)** - Complete tool documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **[Testing Guide](tests/README.md)** - Test suite information

## 🤝 Contributing

Follows [OpenProject API v3](https://www.openproject.org/docs/api/) and [MCP Protocol](https://modelcontextprotocol.io/) specifications.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.