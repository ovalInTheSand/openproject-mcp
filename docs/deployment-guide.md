# Deployment Guide - OpenProject MCP Server v2.0.0

> **Professional Deployment for Your Private Use**  
> Cloudflare Workers + Docker options optimized for thisistheway.local

## Overview

This guide covers deploying your professional MCP server for daily use, with options for:
- **Cloudflare Workers** (Recommended) - Scalable, serverless
- **Docker** - Consistent environments, local or cloud
- **Local Development** - Your current setup

## Prerequisites

- ✅ Working local development environment
- ✅ OpenProject instance at thisistheway.local
- ✅ Valid API token with permissions
- ✅ Clean TypeScript compilation (core tools)

## Cloudflare Workers Deployment (Recommended)

### Initial Setup

```bash
# 1. Verify build works locally
npm run build

# 2. Test deployment validation
wrangler deploy --dry-run

# 3. Authenticate with Cloudflare
wrangler auth login
wrangler auth whoami
```

### Environment Configuration

```bash
# Set production secrets (required)
npx wrangler secret put OP_BASE_URL
# Enter: https://thisistheway.local

npx wrangler secret put OP_TOKEN  
# Enter: your_actual_api_token

npx wrangler secret put ALLOWED_ORIGINS
# Enter: https://claude.ai,https://app.claude.ai

# Optional secrets
npx wrangler secret put SENTRY_DSN
# Enter: your_sentry_dsn_if_needed
```

### Deploy to Production

```bash
# Production deployment
npm run deploy

# Check deployment status
wrangler deployments list

# Test deployed endpoint
curl https://openproject-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
```

### Staging Environment

```bash
# Create staging configuration
cp wrangler.jsonc wrangler.staging.jsonc

# Edit staging config
cat > wrangler.staging.jsonc << 'EOF'
{
  "name": "openproject-mcp-staging",
  "main": "src/index.ts",
  "compatibility_date": "2025-08-15",
  "compatibility_flags": ["nodejs_als"],
  
  "vars": {
    "ALLOWED_ORIGINS": "http://localhost:7000,http://localhost:7001",
    "SENTRY_TRACES_SAMPLE_RATE": "1.0"
  }
}
EOF

# Deploy to staging
npm run deploy:staging
```

### Custom Domain (Optional)

```bash
# Add custom route in wrangler.jsonc
{
  "routes": [
    { 
      "pattern": "mcp.yourdomain.com/*", 
      "zone_name": "yourdomain.com" 
    }
  ]
}

# Deploy with custom domain
wrangler deploy
```

### Monitoring Production

```bash
# View logs
wrangler tail

# Monitor with filters
wrangler tail --format=pretty --status=error

# Check metrics
wrangler deployments list --verbose
```

## Docker Deployment

### Basic Docker Setup

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY wrangler.jsonc ./

# Copy certificates if needed
COPY caddy-root.crt* ./

# Build application
RUN npm run build

# Expose port
EXPOSE 8788

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8788/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"op.health","arguments":{}}}' || exit 1

# Start server
CMD ["npm", "run", "start"]
EOF

# Create .dockerignore
cat > .dockerignore << 'EOF'
node_modules
.wrangler
dist
.git
.env*
!.env.example
docs
*.md
.claude
.mcp.json
LESSONS.yaml
CLAUDE.md
EOF
```

### Docker Compose for Development

```bash
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  openproject-mcp:
    build: .
    ports:
      - "8788:8788"
    environment:
      - OP_BASE_URL=${OP_BASE_URL}
      - OP_TOKEN=${OP_TOKEN}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - NODE_EXTRA_CA_CERTS=./caddy-root.crt
    volumes:
      - ./caddy-root.crt:/app/caddy-root.crt:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8788/mcp"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Optional: Include OpenProject for local testing
  # openproject:
  #   image: openproject/community:12
  #   ports:
  #     - "8080:80"
  #   environment:
  #     - SECRET_KEY_BASE=your_secret_key
EOF

# Create docker environment file
cat > .env.docker << 'EOF'
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=your_token_here
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
EOF

# Deploy with Docker Compose
docker-compose --env-file .env.docker up -d

# Check status
docker-compose ps
docker-compose logs -f openproject-mcp
```

### Production Docker Deployment

```bash
# Build production image
docker build -t openproject-mcp:2.0.0 .

# Run in production
docker run -d \
  --name openproject-mcp-prod \
  --restart unless-stopped \
  -p 8788:8788 \
  -e OP_BASE_URL=https://thisistheway.local \
  -e OP_TOKEN=your_token_here \
  -e ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai \
  -v $(pwd)/caddy-root.crt:/app/caddy-root.crt:ro \
  openproject-mcp:2.0.0

# Check logs
docker logs -f openproject-mcp-prod

# Health check
docker exec openproject-mcp-prod npm run health
```

## Local Production Setup

### PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'openproject-mcp',
    script: 'npm',
    args: 'run start',
    cwd: '/path/to/your/project',
    env: {
      NODE_ENV: 'production',
      NODE_EXTRA_CA_CERTS: './caddy-root.crt',
      OP_BASE_URL: 'https://thisistheway.local',
      OP_TOKEN: 'your_token_here',
      ALLOWED_ORIGINS: 'https://claude.ai,https://app.claude.ai'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Start with PM2
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Systemd Service (Linux)

```bash
# Create systemd service
sudo tee /etc/systemd/system/openproject-mcp.service << 'EOF'
[Unit]
Description=OpenProject MCP Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/project
Environment=NODE_ENV=production
Environment=NODE_EXTRA_CA_CERTS=./caddy-root.crt
Environment=OP_BASE_URL=https://thisistheway.local
Environment=OP_TOKEN=your_token_here
Environment=ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable openproject-mcp
sudo systemctl start openproject-mcp
sudo systemctl status openproject-mcp

# View logs
sudo journalctl -u openproject-mcp -f
```

## Configuration Management

### Environment-Specific Configs

```bash
# Development (.dev.vars)
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=dev_token
ALLOWED_ORIGINS=http://localhost:7000,http://localhost:7001

# Staging
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=staging_token  
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
SENTRY_TRACES_SAMPLE_RATE=1.0

# Production  
OP_BASE_URL=https://thisistheway.local
OP_TOKEN=prod_token
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Secret Management

```bash
# Cloudflare Workers (recommended)
npx wrangler secret put OP_TOKEN

# Docker secrets
echo "your_token" | docker secret create op_token -

# Environment file encryption
gpg --symmetric --cipher-algo AES256 .env.production
```

## SSL/TLS Configuration

### Internal Certificates

```bash
# Copy your Caddy certificate to deployment
scp caddy-root.crt user@server:/app/certs/

# Docker volume mount
-v /path/to/cert.crt:/app/caddy-root.crt:ro

# Environment variable
NODE_EXTRA_CA_CERTS=/app/caddy-root.crt
```

### Production HTTPS

```bash
# Cloudflare Workers (automatic HTTPS)
# No additional configuration needed

# Docker with reverse proxy (nginx/caddy)
server {
    listen 443 ssl;
    server_name mcp.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8788;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring & Maintenance

### Health Monitoring

```bash
# Create monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
ENDPOINT="https://your-mcp-server.com/mcp"

if curl -f "$ENDPOINT" -H "Content-Type: application/json" \
   -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"op.health","arguments":{}}}' > /dev/null 2>&1; then
    echo "✅ MCP Server healthy"
else
    echo "❌ MCP Server unhealthy"
    # Add alerting logic here
fi
EOF

chmod +x monitor.sh

# Add to crontab
echo "*/5 * * * * /path/to/monitor.sh" | crontab -
```

### Log Management

```bash
# Rotate logs (logrotate)
sudo tee /etc/logrotate.d/openproject-mcp << 'EOF'
/path/to/your/project/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

# Docker logs
docker logs --since=24h openproject-mcp-prod

# Cloudflare Workers
wrangler tail --format=pretty
```

### Backup & Recovery

```bash
# Backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/openproject-mcp"

mkdir -p "$BACKUP_DIR"

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    .env.* wrangler.jsonc ecosystem.config.js \
    caddy-root.crt docker-compose.yml

# Backup logs
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" logs/

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
EOF
```

## Performance Optimization

### Cloudflare Workers Optimization

```javascript
// In wrangler.jsonc
{
  "limits": {
    "cpu_ms": 10000  // Adjust based on usage
  },
  "compatibility_flags": ["nodejs_als"]
}
```

### Connection Pooling

```javascript
// In src/util/op.ts - already optimized
const DEFAULT_RETRY = [429, 500, 502, 503, 504];
// Automatic retry with exponential backoff
```

### Caching Strategy

```bash
# Add KV namespace for caching (optional)
wrangler kv:namespace create "CACHE"

# In wrangler.jsonc
"kv_namespaces": [
  { "binding": "CACHE", "id": "your-kv-id" }
]
```

## Scaling Considerations

### Cloudflare Workers
- **Automatic scaling** - No configuration needed
- **Global edge deployment** - Low latency worldwide
- **Built-in DDoS protection**

### Docker Scaling
```yaml
# Docker Swarm
version: '3.8'
services:
  openproject-mcp:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
```

### Load Balancing
```bash
# HAProxy configuration
backend openproject_mcp
    balance roundrobin
    server mcp1 localhost:8788 check
    server mcp2 localhost:8789 check
    server mcp3 localhost:8790 check
```

## Security Hardening

### Access Control
```bash
# Restrict CORS origins
ALLOWED_ORIGINS=https://claude.ai,https://app.claude.ai

# API rate limiting (in application)
# Already implemented in your codebase
```

### Network Security
```bash
# Firewall rules (iptables)
sudo iptables -A INPUT -p tcp --dport 8788 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

---

**Deployment Options Summary:**

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| Cloudflare Workers | Daily use | Auto-scale, global, maintenance-free | Vendor lock-in |
| Docker | Consistent environments | Portable, reproducible | Requires container knowledge |
| Local PM2/Systemd | Full control | Complete ownership | Manual maintenance |

**Recommended:** Start with Cloudflare Workers for daily use, keep Docker for development testing.

**Next Steps:**
1. Choose deployment method
2. Follow setup instructions
3. Test with `npm run health`
4. Configure monitoring
5. Document your specific deployment details

---

**Last Updated:** August 2025  
**Your Environment:** thisistheway.local  
**Package Version:** v2.0.0 Professional Private Use