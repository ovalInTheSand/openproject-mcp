#!/bin/bash

# ============================================================================
# Pre-Commit Security Check - OpenProject MCP Server
# ============================================================================
# This script performs security validations before allowing commits

set -e

echo "🔐 Running pre-commit security checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=false

# Function to report check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        FAILED=true
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking for accidentally staged sensitive files..."

# Check for common sensitive file patterns in staged files
SENSITIVE_FILES=$(git diff --cached --name-only | grep -E '\.(env|key|pem|p12|pfx|crt|jks|keystore)$|secret|password|token|credential' || true)

if [ -n "$SENSITIVE_FILES" ]; then
    echo -e "${RED}❌ Sensitive files detected in staging area:${NC}"
    echo "$SENSITIVE_FILES"
    FAILED=true
else
    echo -e "${GREEN}✅ No sensitive files in staging area${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking for secrets in code content..."

# Check for potential secrets in staged content
SECRETS_IN_CONTENT=$(git diff --cached | grep -iE '(password|secret|token|api[_-]?key)\s*[=:]\s*["\047][^"\047\s]{8,}["\047]' || true)

if [ -n "$SECRETS_IN_CONTENT" ]; then
    echo -e "${RED}❌ Potential secrets found in staged content:${NC}"
    echo "$SECRETS_IN_CONTENT"
    FAILED=true
else
    echo -e "${GREEN}✅ No secrets detected in staged content${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Validating environment files..."

# Check if .dev.vars or .env files are being committed
ENV_FILES=$(git diff --cached --name-only | grep -E '\.env$|\.dev\.vars$' || true)

if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}❌ Environment files should not be committed:${NC}"
    echo "$ENV_FILES"
    echo -e "${YELLOW}💡 Use .env.example instead${NC}"
    FAILED=true
else
    echo -e "${GREEN}✅ No environment files being committed${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking for proper file permissions..."

# Check for files with overly permissive permissions
EXECUTABLE_FILES=$(git diff --cached --name-only | xargs -I {} find {} -type f -executable 2>/dev/null | grep -v '\.sh$' || true)

if [ -n "$EXECUTABLE_FILES" ]; then
    echo -e "${YELLOW}⚠️  Non-script files with executable permissions:${NC}"
    echo "$EXECUTABLE_FILES"
    echo -e "${YELLOW}💡 Consider removing execute permissions with: chmod -x filename${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Validating TypeScript compilation..."

# Check TypeScript compilation
if command -v tsc &> /dev/null; then
    if tsc --noEmit --skipLibCheck; then
        echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    else
        echo -e "${RED}❌ TypeScript compilation failed${NC}"
        FAILED=true
    fi
else
    echo -e "${YELLOW}⚠️  TypeScript compiler not found, skipping compilation check${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Running ESLint on staged files..."

# Run ESLint on staged TypeScript and JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|tsx|jsx)$' || true)

if [ -n "$STAGED_FILES" ]; then
    if command -v eslint &> /dev/null; then
        if echo "$STAGED_FILES" | xargs eslint --quiet; then
            echo -e "${GREEN}✅ ESLint checks passed${NC}"
        else
            echo -e "${RED}❌ ESLint checks failed${NC}"
            FAILED=true
        fi
    else
        echo -e "${YELLOW}⚠️  ESLint not found, skipping linting${NC}"
    fi
else
    echo -e "${GREEN}✅ No JavaScript/TypeScript files to lint${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Final result
if [ "$FAILED" = true ]; then
    echo -e "${RED}❌ Pre-commit security checks FAILED${NC}"
    echo -e "${RED}Please fix the issues above before committing.${NC}"
    echo ""
    echo -e "${YELLOW}💡 Quick fixes:${NC}"
    echo "• Remove sensitive files: git reset HEAD <filename>"
    echo "• Fix code issues and re-stage: git add <filename>"
    echo "• Update .gitignore if needed"
    echo ""
    exit 1
else
    echo -e "${GREEN}🎉 All pre-commit security checks PASSED!${NC}"
    echo -e "${GREEN}Ready for commit.${NC}"
    exit 0
fi