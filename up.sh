#!/bin/bash
# Simple up command
set -e

docker-compose up -d "$@"
echo "✅ Server started! MCP endpoint: http://localhost:8788/mcp"