# 🐳 Docker Setup Guide

This guide covers containerizing and running the OpenProject MCP Server with Docker Desktop.

## Prerequisites

- Docker Desktop installed and running
- OpenProject instance with API access
- API token from your OpenProject account

## Quick Start (3 steps)

### 1. Configure Environment
```bash
# Copy and edit environment file
cp .env.example .env.docker

# Edit .env.docker with your settings:
# - OP_BASE_URL: Your OpenProject URL
# - OP_TOKEN: Your API token
# - ALLOWED_ORIGINS: Your client applications
```

### 2. Start the Server
```bash
# Using the convenient script
./docker-compose-up.sh

# Or manually with Docker Compose
docker-compose up -d
```

### 3. Verify It's Working
```bash
# Health check
curl -X POST http://localhost:8788/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"test","method":"tools/list"}'
```

✅ You should see a JSON response with available MCP tools!

## Development Mode

For development with hot reload and debug features:

```bash
# Copy development environment
cp .env.example .env.dev
# Edit .env.dev as needed

# Start in development mode
./docker-compose-up.sh --dev
```

## Manual Docker Commands

### Build Images
```bash
# Production image
docker build -t openproject-mcp:latest .

# Development image
docker build --target builder -t openproject-mcp:dev .
```

### Run Containers
```bash
# Production
docker run -p 8788:8788 --env-file .env.docker openproject-mcp:latest

# Development with volume mounts
docker run -p 8788:8788 --env-file .env.dev \
  -v $(pwd)/src:/app/src:cached \
  openproject-mcp:dev
```

## Docker Compose Files

| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Base production configuration | `docker-compose up` |
| `docker-compose.dev.yml` | Development overrides | `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up` |

## Environment Files

| File | Purpose | Usage |
|------|---------|-------|
| `.env.docker` | Production settings | Used by `docker-compose.yml` |
| `.env.dev` | Development settings | Used by `docker-compose.dev.yml` |

## Helpful Scripts

All scripts include `--help` for detailed usage:

```bash
# Build Docker images
./docker-build.sh --help

# Run single containers
./docker-run.sh --help

# Docker Compose wrapper
./docker-compose-up.sh --help
```

## Troubleshooting

### Container Won't Start
1. Check Docker Desktop is running
2. Verify environment file exists and has required variables
3. Check logs: `docker-compose logs openproject-mcp`

### Can't Connect to OpenProject
1. Verify `OP_BASE_URL` is correct (no trailing slash)
2. Test API token: `curl -u "apikey:$OP_TOKEN" $OP_BASE_URL/api/v3/`
3. Check network connectivity from container

### TLS Certificate Issues
1. Add your CA certificate as `caddy-root.crt` in project root
2. It will be automatically mounted in the container

### Permission Issues
- Production container runs as non-root user `openproject:nodejs`
- Development containers may need volume mount permissions

## Container Details

### Production Image Features
- ✅ Multi-stage build for smaller size
- ✅ Non-root user for security
- ✅ Health checks included
- ✅ Resource limits configured
- ✅ Log rotation enabled

### Security
- Runs as `openproject:nodejs` user (non-root)
- No development dependencies in production image
- Environment variables for secrets
- Resource limits prevent container abuse

### Performance
- Default: 1GB RAM, 0.5 CPU limits
- Configurable in `docker-compose.yml`
- SQLite caching for fast responses
- JSON log rotation (10MB max, 3 files)

## Integration with Claude Code

Once running, configure Claude Code to use your MCP server:

1. Server URL: `http://localhost:8788/mcp`
2. Method: POST
3. Headers: `Content-Type: application/json`

Test with:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

## Production Deployment

For production deployment:

1. Use production environment file
2. Configure proper `ALLOWED_ORIGINS`
3. Set up HTTPS reverse proxy (nginx, Caddy)
4. Consider Redis for enhanced caching
5. Monitor with health checks
6. Set up log aggregation

## Next Steps

- ✅ Server running → Test with Claude Code
- ✅ Basic tests passing → Configure your projects
- ✅ Production ready → Set up monitoring and backups

For more details, see the main [README.md](README.md) and [API Reference](docs/api-reference.md).