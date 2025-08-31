# syntax=docker/dockerfile:1.7

# ============================================================================
# Multi-stage build for production OpenProject MCP Server
# ============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Type check and validate build
RUN npm run typecheck

# ============================================================================
# Production stage
FROM node:20-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S openproject -u 1001

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=openproject:nodejs /app/src ./src
COPY --from=builder --chown=openproject:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=openproject:nodejs /app/wrangler.jsonc ./

# Copy certificate if present (for custom CAs)
COPY --chown=openproject:nodejs caddy-root.crt* ./

# Switch to non-root user
USER openproject

# Expose MCP HTTP port
EXPOSE 8788

# Environment variables (production defaults)
ENV PORT=8788 \
    NODE_ENV=production \
    SSE_ENABLED=false \
    NODE_OPTIONS="--max_old_space_size=512"

# Health check with proper error handling
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS -X POST http://localhost:8788/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":"health","method":"tools/list","params":{}}' || exit 1

# Labels for container metadata
LABEL \
  org.opencontainers.image.title="OpenProject MCP Server" \
  org.opencontainers.image.description="Advanced MCP server with hybrid OpenProject API integration" \
    org.opencontainers.image.version="3.4.0" \
  org.opencontainers.image.vendor="Adam Sandoval" \
  org.opencontainers.image.licenses="MIT"

# Production command
CMD ["npm", "run", "start"]
