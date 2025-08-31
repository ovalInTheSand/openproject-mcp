#!/bin/bash
# ============================================================================
# OpenProject MCP Server - Docker Run Script
# ============================================================================
# Convenient script to run the OpenProject MCP Server with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="openproject-mcp:latest"
CONTAINER_NAME="openproject-mcp-server"
DEFAULT_ENV_FILE=".env.docker"

echo -e "${BLUE}🐳 OpenProject MCP Server - Docker Runner${NC}"
echo "=============================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Parse command line arguments
MODE="production"
ENV_FILE="${DEFAULT_ENV_FILE}"
DETACHED=false
BUILD_FIRST=false
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|--development)
            MODE="development"
            ENV_FILE=".env.dev"
            echo -e "${YELLOW}🔧 Running in development mode${NC}"
            shift
            ;;
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --detached|-d)
            DETACHED=true
            shift
            ;;
        --build)
            BUILD_FIRST=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --dev, --development  Run in development mode"
            echo "  --env-file FILE      Use specific environment file"
            echo "  --detached, -d       Run in detached mode"
            echo "  --build              Build image before running"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Run in production mode"
            echo "  $0 --dev            # Run in development mode"
            echo "  $0 --build --dev    # Build and run in development"
            echo "  $0 -d               # Run detached"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if environment file exists
if [[ ! -f "${ENV_FILE}" ]]; then
    echo -e "${RED}❌ Environment file not found: ${ENV_FILE}${NC}"
    echo -e "${YELLOW}💡 Copy and customize from .env.example:${NC}"
    echo "   cp .env.example ${ENV_FILE}"
    exit 1
fi

# Build first if requested
if [[ "${BUILD_FIRST}" == true ]]; then
    echo -e "${BLUE}🔨 Building image first...${NC}"
    if [[ "${MODE}" == "development" ]]; then
        ./docker-build.sh --dev
        IMAGE_NAME="openproject-mcp:dev"
    else
        ./docker-build.sh
    fi
    echo ""
fi

# Stop existing container if running
if docker ps -q -f name="${CONTAINER_NAME}" | grep -q .; then
    echo -e "${YELLOW}🛑 Stopping existing container...${NC}"
    docker stop "${CONTAINER_NAME}" > /dev/null
fi

# Remove existing container if exists
if docker ps -aq -f name="${CONTAINER_NAME}" | grep -q .; then
    echo -e "${YELLOW}🗑️  Removing existing container...${NC}"
    docker rm "${CONTAINER_NAME}" > /dev/null
fi

echo -e "${BLUE}📋 Run Configuration${NC}"
echo "  Mode: ${MODE}"
echo "  Image: ${IMAGE_NAME}"
echo "  Container: ${CONTAINER_NAME}"
echo "  Environment: ${ENV_FILE}"
echo "  Detached: ${DETACHED}"
echo ""

# Prepare run command
DOCKER_CMD="docker run"
DOCKER_CMD+=" --name ${CONTAINER_NAME}"
DOCKER_CMD+=" --env-file ${ENV_FILE}"
DOCKER_CMD+=" -p 8788:8788"

if [[ "${DETACHED}" == true ]]; then
    DOCKER_CMD+=" -d"
    EXTRA_ARGS+=" --restart unless-stopped"
else
    DOCKER_CMD+=" -it --rm"
fi

# Add development-specific mounts
if [[ "${MODE}" == "development" ]]; then
    if [[ "${DETACHED}" == false ]]; then
        DOCKER_CMD+=" -v $(pwd)/src:/app/src:cached"
        DOCKER_CMD+=" -v $(pwd)/.dev.vars:/app/.dev.vars:ro"
        DOCKER_CMD+=" -v $(pwd)/caddy-root.crt:/app/caddy-root.crt:ro"
    fi
    IMAGE_NAME="openproject-mcp:dev"
fi

DOCKER_CMD+=" ${EXTRA_ARGS} ${IMAGE_NAME}"

# Run the container
echo -e "${BLUE}🚀 Starting OpenProject MCP Server...${NC}"
echo "Command: ${DOCKER_CMD}"
echo ""

if eval "${DOCKER_CMD}"; then
    if [[ "${DETACHED}" == true ]]; then
        echo ""
        echo -e "${GREEN}✅ Container started successfully!${NC}"
        echo -e "${GREEN}🌐 MCP Server: http://localhost:8788/mcp${NC}"
        echo ""
        echo -e "${BLUE}📋 Useful commands:${NC}"
        echo "  docker logs ${CONTAINER_NAME}              # View logs"
        echo "  docker logs -f ${CONTAINER_NAME}           # Follow logs"
        echo "  docker exec -it ${CONTAINER_NAME} sh       # Shell access"
        echo "  docker stop ${CONTAINER_NAME}              # Stop container"
        echo ""
        echo -e "${BLUE}🩺 Health check:${NC}"
        echo "  curl -X POST http://localhost:8788/mcp \\"
        echo "    -H 'Content-Type: application/json' \\"
        echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'"
    else
        echo -e "${GREEN}✅ Container finished${NC}"
    fi
else
    echo ""
    echo -e "${RED}❌ Failed to start container!${NC}"
    exit 1
fi