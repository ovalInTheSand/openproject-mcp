#!/bin/bash
# ============================================================================
# OpenProject MCP Server - Docker Build Script
# ============================================================================
# Builds the Docker image for the OpenProject MCP Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="openproject-mcp"
IMAGE_TAG="latest"
DOCKERFILE="Dockerfile"

echo -e "${BLUE}🐳 Building OpenProject MCP Server Docker Image${NC}"
echo "=================================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Parse command line arguments
BUILD_TARGET="production"
BUILD_ARGS=""
CACHE_FROM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev|--development)
            BUILD_TARGET="builder"
            IMAGE_TAG="dev"
            echo -e "${YELLOW}🔧 Building development image${NC}"
            shift
            ;;
        --no-cache)
            BUILD_ARGS="--no-cache"
            echo -e "${YELLOW}🔄 Building without cache${NC}"
            shift
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --dev, --development  Build development image"
            echo "  --no-cache           Build without using cache"
            echo "  --tag TAG            Specify image tag (default: latest)"
            echo "  --help               Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Final image name with tag
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo -e "${BLUE}📋 Build Configuration${NC}"
echo "  Image: ${FULL_IMAGE_NAME}"
echo "  Target: ${BUILD_TARGET}"
echo "  Dockerfile: ${DOCKERFILE}"
echo ""

# Build the image
echo -e "${BLUE}🔨 Building Docker image...${NC}"
if docker build \
    --target "${BUILD_TARGET}" \
    --tag "${FULL_IMAGE_NAME}" \
    --file "${DOCKERFILE}" \
    ${BUILD_ARGS} \
    . ; then
    
    echo ""
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    echo -e "${GREEN}📦 Image: ${FULL_IMAGE_NAME}${NC}"
    
    # Show image size
    SIZE=$(docker images --format "table {{.Size}}" "${FULL_IMAGE_NAME}" | tail -n 1)
    echo -e "${GREEN}📏 Size: ${SIZE}${NC}"
    
    echo ""
    echo -e "${BLUE}🚀 Quick start commands:${NC}"
    if [[ "${BUILD_TARGET}" == "builder" ]]; then
        echo "  Development: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up"
    else
        echo "  Production:  docker-compose up"
    fi
    echo "  Direct run:  docker run -p 8788:8788 --env-file .env.docker ${FULL_IMAGE_NAME}"
    
else
    echo ""
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi