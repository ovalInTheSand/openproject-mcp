#!/bin/bash
# ============================================================================
# OpenProject MCP Server - Docker Compose Helper Script
# ============================================================================
# Convenient wrapper for docker-compose commands

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 OpenProject MCP Server - Docker Compose${NC}"
echo "=============================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Parse command line arguments
MODE="production"
DETACHED=false
BUILD=false
ACTION="up"

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|--development)
            MODE="development"
            echo -e "${YELLOW}🔧 Using development configuration${NC}"
            shift
            ;;
        --detached|-d)
            DETACHED=true
            shift
            ;;
        --build)
            BUILD=true
            shift
            ;;
        up|down|restart|logs|stop|start|ps)
            ACTION="$1"
            shift
            ;;
        --help)
            echo "Usage: $0 [options] [action]"
            echo ""
            echo "Actions:"
            echo "  up       Start services (default)"
            echo "  down     Stop and remove services"
            echo "  restart  Restart services"
            echo "  logs     Show service logs"
            echo "  stop     Stop services"
            echo "  start    Start stopped services"
            echo "  ps       Show running services"
            echo ""
            echo "Options:"
            echo "  --dev, --development  Use development configuration"
            echo "  --detached, -d       Run in detached mode (for 'up')"
            echo "  --build              Build images before starting"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   # Start in production mode"
            echo "  $0 --dev            # Start in development mode"
            echo "  $0 --build --dev    # Build and start in development"
            echo "  $0 -d               # Start detached"
            echo "  $0 logs             # View logs"
            echo "  $0 down             # Stop everything"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check environment file
if [[ "${MODE}" == "development" ]]; then
    ENV_FILE=".env.dev"
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
else
    ENV_FILE=".env.docker"
    COMPOSE_FILES="-f docker-compose.yml"
fi

if [[ ! -f "${ENV_FILE}" && ("${ACTION}" == "up" || "${ACTION}" == "restart" || "${ACTION}" == "start") ]]; then
    echo -e "${RED}❌ Environment file not found: ${ENV_FILE}${NC}"
    echo -e "${YELLOW}💡 Copy and customize from .env.example:${NC}"
    echo "   cp .env.example ${ENV_FILE}"
    exit 1
fi

# Build compose command
COMPOSE_CMD="docker-compose ${COMPOSE_FILES}"

case "${ACTION}" in
    up)
        echo -e "${BLUE}🚀 Starting OpenProject MCP Server...${NC}"
        if [[ "${BUILD}" == true ]]; then
            COMPOSE_CMD+=" up --build"
        else
            COMPOSE_CMD+=" up"
        fi
        
        if [[ "${DETACHED}" == true ]]; then
            COMPOSE_CMD+=" -d"
        fi
        ;;
    down)
        echo -e "${YELLOW}🛑 Stopping and removing services...${NC}"
        COMPOSE_CMD+=" down"
        ;;
    restart)
        echo -e "${YELLOW}🔄 Restarting services...${NC}"
        COMPOSE_CMD+=" restart"
        ;;
    logs)
        echo -e "${BLUE}📋 Showing logs...${NC}"
        COMPOSE_CMD+=" logs -f"
        ;;
    stop)
        echo -e "${YELLOW}🛑 Stopping services...${NC}"
        COMPOSE_CMD+=" stop"
        ;;
    start)
        echo -e "${GREEN}▶️  Starting services...${NC}"
        COMPOSE_CMD+=" start"
        ;;
    ps)
        echo -e "${BLUE}📋 Service status:${NC}"
        COMPOSE_CMD+=" ps"
        ;;
esac

echo -e "${BLUE}📋 Configuration${NC}"
echo "  Mode: ${MODE}"
echo "  Action: ${ACTION}"
echo "  Environment: ${ENV_FILE}"
if [[ "${ACTION}" == "up" ]]; then
    echo "  Detached: ${DETACHED}"
    echo "  Build: ${BUILD}"
fi
echo "  Command: ${COMPOSE_CMD}"
echo ""

# Execute the command
if eval "${COMPOSE_CMD}"; then
    if [[ "${ACTION}" == "up" ]]; then
        echo ""
        if [[ "${DETACHED}" == true ]]; then
            echo -e "${GREEN}✅ Services started successfully!${NC}"
        else
            echo -e "${GREEN}✅ Services stopped${NC}"
        fi
        echo -e "${GREEN}🌐 MCP Server: http://localhost:8788/mcp${NC}"
        
        if [[ "${MODE}" == "development" ]]; then
            echo -e "${GREEN}🌐 SSE Endpoint: http://localhost:8788/sse${NC}"
        fi
        
        echo ""
        echo -e "${BLUE}🩺 Health check:${NC}"
        echo "  curl -X POST http://localhost:8788/mcp \\"
        echo "    -H 'Content-Type: application/json' \\"
        echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'"
        
        if [[ "${DETACHED}" == true ]]; then
            echo ""
            echo -e "${BLUE}📋 Useful commands:${NC}"
            echo "  $0 logs             # View logs"
            echo "  $0 ps               # Service status"
            echo "  $0 restart          # Restart services"
            echo "  $0 down             # Stop and remove"
        fi
    fi
else
    echo ""
    echo -e "${RED}❌ Command failed!${NC}"
    exit 1
fi