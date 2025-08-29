# OpenProject MCP Server

A Model Context Protocol (MCP) server that provides comprehensive access to OpenProject APIs for project management workflows. Built for [Claude Code](https://claude.ai/code) and other MCP-compatible clients.

## Features

### 🎯 **Core Project Management Tools (14 Basic Tools)**
- **Projects**: List and filter projects by name/identifier
- **Work Packages**: Create, update, list, and attach files (forms-first validation)  
- **Types**: Get available work package types per project
- **Queries**: List and run saved queries with custom filters/sorting
- **Attachments**: Upload files to work packages via multipart/form-data

### 🔧 **Workflow Support Tools**
- **Statuses**: List work package statuses (global or per-project)
- **Priorities**: List work package priorities (global or per-project)
- **Versions**: List project versions/milestones with pagination
- **Users**: Search users by name/login, get current user info
- **Health**: Check OpenProject connectivity and authentication

### 🏢 **Enterprise Project Management Suite (23 Advanced Tools)**
- **Enterprise Projects**: Create, update, archive with full PMBOK governance
- **Advanced Work Packages**: Complete scheduling, resources, dependencies
- **Enterprise Time Tracking**: Cost accounting, billing rates, resource allocation
- **Milestone & Phase Gates**: Approval workflows, governance, audit trails
- **Dependency Management**: Critical path analysis, lead/lag times, risk assessment
- **Enterprise Reporting**: EVM analysis, dashboard KPIs, utilization metrics

### 🏗️ **Enterprise Architecture**
- **Forms-first Validation**: All create/update operations use OpenProject's validation API
- **Modular Design**: Domain-specific modules with enterprise feature separation
- **Comprehensive Error Handling**: Structured error envelopes with validation details
- **Dual Transport**: MCP-compatible streamable HTTP (primary) + optional SSE real-time events
- **Enterprise Schema Support**: 30+ custom fields per entity for organizational customization
- **TLS & Security**: Complete certificate trust with CORS and authentication safeguards
- **Mathematical Validation**: Comprehensive test suite for PMBOK-compliant EVM and critical path calculations

## Quick Start

### Prerequisites
- Node.js 18+ 
- OpenProject instance with API access
- API key from your OpenProject user account

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd openproject-mcp

# Install dependencies
npm install

# Copy environment template
cp .env.example .dev.vars
```

### Configuration

Edit `.dev.vars` with your OpenProject details:

```bash
# Required
OP_BASE_URL=https://your-openproject.example.com
OP_TOKEN=your_api_token_here

# Optional
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
SENTRY_DSN=
SSE_ENABLED=false
```

### Development

```bash
# Start development server
npm run dev

# The server will be available at:
# - http://localhost:8788/mcp (primary MCP endpoint)
# - http://localhost:8788/sse (optional real-time events, disabled by default)
```

### Testing with Claude Code

1. Configure Claude Code to use your MCP server endpoint
2. Test basic connectivity:
   ```bash
   curl -X POST http://localhost:8788/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

## Available Tools (54 Total)

### Core Operations
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `op.health` | Check connectivity and auth | None |
| `projects.list` | List projects with optional filtering | None |
| `types.list` | Get work package types for project | None (global) or `projectId` |

### Work Package Management  
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `wp.list` | List work packages with filtering | `projectId` (optional) |
| `wp.create` | Create work package (forms-first) | `projectId`, `typeId`, `subject` |
| `wp.update` | Update work package (forms-first) | `id`, `lockVersion` |
| `wp.attach` | Attach file to work package | `workPackageId`, `fileName`, `dataBase64` |

### Workflow Support
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `queries.list` | List saved queries | None |
| `queries.run` | Execute saved query | `id` |
| `statuses.list` | List work package statuses | None (global) or `projectId` |
| `priorities.list` | List work package priorities | None (global) or `projectId` |
| `versions.list` | List project versions | `projectId` |
| `users.search` | Search users by name/login | None (all users) or `q` |
| `users.me` | Get current user information | None |

### Enterprise Project Management
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `projects.create` | Create project with full enterprise schema | `name`, `identifier` |
| `projects.update` | Update project with enterprise metadata | `id`, `lockVersion` |
| `projects.archive` | Archive project with reason tracking | `id`, `reason` |
| `projects.listEnterprise` | List with hierarchy and custom fields | None |
| `wp.createEnterprise` | Create with scheduling and resources | `projectId`, `typeId`, `subject` |
| `wp.updateEnterprise` | Update with complete scheduling control | `id`, `lockVersion` |
| `wp.listEnterprise` | List with analytics and schedule metrics | None |

### Enterprise Time & Resource Management
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `time.logEnterprise` | Log with cost accounting and billing | `workPackageId`, `hours` |
| `time.updateEnterprise` | Update with enterprise cost features | `id`, `lockVersion` |
| `time.generateTimesheet` | Generate comprehensive timesheets | `userId`, `startDate`, `endDate` |
| `resources.allocate` | Allocate with capacity planning | `projectId`, `userId` |
| `resources.utilization` | Generate utilization reports | `startDate`, `endDate` |

### Enterprise Milestone & Phase Management
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `milestones.createEnterprise` | Create with phase gates and governance | `projectId`, `name`, `date` |
| `milestones.updateEnterprise` | Update with enterprise features | `id`, `lockVersion` |
| `milestones.processPhaseGate` | Process approvals with audit trail | `milestoneId`, `decision` |
| `milestones.progress` | Get progress with analytics | `milestoneId` |

### Enterprise Dependency Management
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `dependencies.create` | Create with lead/lag and risk management | `fromId`, `toId` |
| `dependencies.update` | Update with enterprise metadata | `id`, `lockVersion` |
| `dependencies.analyze` | Analyze with critical path calculation | `projectId` |
| `dependencies.remove` | Remove with audit trail and impact | `id` |

### Enterprise Reporting & Analytics
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `reports.earnedValue` | Generate EVM reports (PMBOK standard) | `projectId`, `reportDate` |
| `reports.criticalPath` | Generate critical path analysis | `projectId` |
| `reports.projectDashboard` | Generate comprehensive KPI dashboard | `projectId` |

### Portfolio Management (Phase 2)
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `portfolio.create` | Create enterprise portfolio with strategic objectives | `name`, `identifier` |
| `portfolio.listProjects` | List projects with hierarchy and custom fields | None |
| `portfolio.balanceResources` | Balance resources across portfolio projects | `portfolioId` |
| `portfolio.generateHealthDashboard` | Generate portfolio health dashboard with KPIs | `portfolioId` |
| `portfolio.trackBenefits` | Track benefits realization across portfolio | `portfolioId` |

### Risk Management (Phase 2)
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `risk.createRegister` | Create comprehensive risk register | `projectId` |
| `risk.performQuantitativeAnalysis` | Perform quantitative risk analysis (Monte Carlo, etc.) | `projectId` |
| `risk.trackMitigation` | Track risk mitigation progress and effectiveness | `projectId` |
| `risk.generateBurndown` | Generate risk burndown charts and trends | `projectId` |

### Predictive Analytics (Phase 2)
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `analytics.predictSuccess` | Predict project success using ML and patterns | `projectId` |
| `analytics.recommendActions` | Recommend actions using AI analysis | `projectId`, `currentHealth` |
| `analytics.benchmarkPerformance` | Benchmark against industry standards | `projectId` |

### Program Management (Phase 2)
| Tool | Description | Required Parameters |
|------|-------------|-------------------|
| `program.create` | Create enterprise program with governance | `name`, `identifier`, `projects` |
| `program.coordinateDeliveries` | Coordinate deliveries across program projects | `programId` |
| `program.trackBenefits` | Track program-level benefits realization | `programId` |
| `program.manageStakeholders` | Manage program stakeholders and engagement | `programId` |

## Examples

### Create a Work Package
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "wp.create",
    "arguments": {
      "projectId": 1,
      "typeId": 1,
      "subject": "Fix user authentication bug",
      "description": "Users can't login with special characters",
      "dryRun": false
    }
  }
}
```

### Update Work Package Status
```json
{
  "jsonrpc": "2.0", 
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "wp.update",
    "arguments": {
      "id": 123,
      "lockVersion": 5,
      "statusId": 7,
      "subject": "Updated: Fix user authentication bug"
    }
  }
}
```

### Search for Team Members
```json
{
  "jsonrpc": "2.0",
  "id": 3, 
  "method": "tools/call",
  "params": {
    "name": "users.search",
    "arguments": {
      "q": "john",
      "pageSize": 10
    }
  }
}
```

## Deployment

### Cloudflare Workers

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Set production environment variables
npx wrangler secret put OP_BASE_URL
npx wrangler secret put OP_TOKEN
```

### Environment Variables

#### Required
- `OP_BASE_URL`: Your OpenProject instance URL (e.g., `https://openproject.example.com`)
- `OP_TOKEN`: OpenProject API key

#### Optional
- `ALLOWED_ORIGINS`: Comma-separated CORS origins (default: `*`)
- `SENTRY_DSN`: Sentry error tracking DSN
- `SENTRY_TRACES_SAMPLE_RATE`: Sentry trace sampling rate (0.0-1.0)
- `SSE_ENABLED`: Enable Server-Sent Events endpoint (default: `false`)

## TLS Configuration

For internal deployments with custom certificates:

```bash
# Add your CA certificate to the project root
cp your-ca-cert.pem ./caddy-root.crt

# The dev script automatically uses NODE_EXTRA_CA_CERTS
npm run dev
```

## Development

### Project Structure
```
src/
├── index.ts          # Hono app + MCP transport + optional SSE
├── server.ts         # MCP server builder + tool registration  
├── sse.ts            # Server-Sent Events implementation (optional)
├── tools.ts          # Main work package tools
├── tools/            # Domain-specific tool modules
│   ├── health.ts     # Connectivity check
│   ├── priorities.ts # Priority management
│   ├── statuses.ts   # Status management
│   ├── users.ts      # User search + profile
│   └── versions.ts   # Version/milestone management
└── util/
    └── op.ts         # OpenProject API client + utilities
```

### Adding New Tools

1. Create a new tool module in `src/tools/`
2. Export input schemas and handler functions
3. Register tools in `src/server.ts` using `registerToolHelper`
4. Follow the established patterns for error handling and validation

### Code Standards

- **KISS principle**: Minimal diffs, no speculative abstractions
- **Forms-first**: Use OpenProject validation API for create/update operations
- **Error envelopes**: Always return `{ content[], structuredContent, isError? }`
- **Modular design**: Keep tool domains in separate files
- **Transport flexibility**: Streamable HTTP primary, SSE optional and disabled by default

## Troubleshooting

### Common Issues

**TLS Certificate Errors**
```bash
# Add your certificate to the project
cp /path/to/cert.crt ./caddy-root.crt
NODE_EXTRA_CA_CERTS=./caddy-root.crt npm run dev
```

**API Authentication Errors**  
- Verify `OP_BASE_URL` ends with no trailing slash
- Check API token has sufficient permissions
- Test direct API access: `curl -u "apikey:$OP_TOKEN" $OP_BASE_URL/api/v3/`

**CORS Issues**
- Update `ALLOWED_ORIGINS` environment variable
- Ensure MCP client sends proper `Accept` headers

**SSE Connection Issues**
- Set `SSE_ENABLED=true` to enable Server-Sent Events endpoint
- Check that client supports `text/event-stream` content type
- Verify CORS headers include `Cache-Control` for SSE

## Documentation

### Setup & Usage
- **[Personal Setup Guide](docs/personal-setup-guide.md)** - Complete setup for your `thisistheway.local` environment
- **[API Reference](docs/api-reference.md)** - All 54 MCP tools with examples and parameters
- **[Troubleshooting Guide](docs/troubleshooting-guide.md)** - Solutions for common issues
- **[Deployment Guide](docs/deployment-guide.md)** - Cloudflare Workers, Docker, and local deployment

### Additional Resources
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and development journey
- **[Usage Guide](docs/USAGE.md)** - Usage scenarios and integration examples
- **[Package Status](docs/PACKAGE-STATUS.md)** - Complete package validation status
- **[Shipping Report](docs/FINAL-SHIPPING-REPORT.md)** - Final validation and quality assessment
- **[Testing Guide](tests/README.md)** - Test suite documentation

## Contributing

This project follows OpenProject API v3 conventions and MCP protocol specifications. See:

- [OpenProject API Documentation](https://www.openproject.org/docs/api/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Forms API Guide](https://www.openproject.org/docs/api/forms/)

## License

MIT License - see [LICENSE](LICENSE) file for details.