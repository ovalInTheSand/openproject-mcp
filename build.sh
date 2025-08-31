#!/bin/bash
# Simple build command without version numbers
set -e

docker-compose build "$@"
echo "✅ Build complete! Run with: ./up.sh"