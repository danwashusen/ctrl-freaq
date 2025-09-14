#!/bin/bash

# Local CI testing script for CTRL FreaQ pipeline
# Tests CI jobs locally before pushing to GitHub
# MUST FAIL initially as per TDD requirements

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load NVM and use the correct Node version
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"

    if [ -f "$REPO_ROOT/.nvmrc" ]; then
        echo "📋 Loading Node.js version from .nvmrc..."
        cd "$REPO_ROOT" && nvm use
    fi
elif [ -f "$REPO_ROOT/.nvmrc" ]; then
    REQUIRED_NODE=$(cat "$REPO_ROOT/.nvmrc")
    echo "⚠️  NVM not found. Please ensure you're using Node.js v$REQUIRED_NODE"
    echo "   Install NVM: https://github.com/nvm-sh/nvm"
fi

echo "🧪 Testing CI pipeline locally..."
echo "Repository root: $REPO_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# Function to log test results
log_test_start() {
    echo -e "\n${BLUE}🔄 Running: $1${NC}"
}

log_test_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_test_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   Error: $2${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Change to repository root
cd "$REPO_ROOT"

echo "=========================================="
echo "🚀 CTRL FreaQ CI Pipeline Local Test"
echo "=========================================="

# Test 1: Check project structure
log_test_start "Project structure validation"
if [ -f "package.json" ] && [ -f "pnpm-workspace.yaml" ]; then
    log_test_pass "Project structure (package.json, pnpm-workspace.yaml)"
else
    log_test_fail "Project structure" "Missing package.json or pnpm-workspace.yaml"
fi

# Test 2: Check Node.js version
log_test_start "Node.js version check"
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" =~ ^v22\. ]]; then
    log_test_pass "Node.js version ($NODE_VERSION)"
else
    log_test_fail "Node.js version" "Expected Node.js 22.x, found: $NODE_VERSION"
fi

# Test 3: Check pnpm installation
log_test_start "pnpm installation check"
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    log_test_pass "pnpm installation (v$PNPM_VERSION)"
else
    log_test_fail "pnpm installation" "pnpm not found in PATH"
fi

# Test 4: Dependencies installation
log_test_start "Dependencies installation"
if pnpm install --frozen-lockfile 2>/dev/null; then
    log_test_pass "Dependencies installation"
else
    log_test_fail "Dependencies installation" "pnpm install failed"
fi

# Test 5: Lint check (equivalent to CI lint job)
log_test_start "Lint check"
if pnpm lint 2>/dev/null; then
    log_test_pass "Lint check"
else
    log_test_fail "Lint check" "ESLint found issues"
fi

# Test 6: TypeScript check (equivalent to CI typecheck job)
log_test_start "TypeScript check"
if pnpm typecheck 2>/dev/null; then
    log_test_pass "TypeScript check"
else
    log_test_fail "TypeScript check" "TypeScript compilation errors"
fi

# Test 7: Build process (equivalent to CI build job)
log_test_start "Build process"
if pnpm build 2>/dev/null; then
    log_test_pass "Build process"
else
    log_test_fail "Build process" "Build failed"
fi

# Test 8: Test suite (equivalent to CI test job)
log_test_start "Test suite"
if pnpm test 2>/dev/null; then
    log_test_pass "Test suite"
else
    log_test_fail "Test suite" "Tests failed"
fi

# Test 9: Workspace validation
log_test_start "Workspace validation"
WORKSPACE_VALID=true

# Check if all workspace packages are properly configured
if [ -f "pnpm-workspace.yaml" ]; then
    # This will fail initially because workspace validation logic doesn't exist yet
    if [ -f "scripts/ci/check-dependencies.sh" ] && bash scripts/ci/check-dependencies.sh 2>/dev/null; then
        log_test_pass "Workspace validation"
    else
        log_test_fail "Workspace validation" "Dependency validation script not implemented"
        WORKSPACE_VALID=false
    fi
else
    log_test_fail "Workspace validation" "pnpm-workspace.yaml not found"
    WORKSPACE_VALID=false
fi

# Test 10: GitHub Actions workflows validation
log_test_start "Workflows validation"
if [ -f "scripts/ci/validate-workflows.sh" ] && bash scripts/ci/validate-workflows.sh 2>/dev/null; then
    log_test_pass "Workflows validation"
else
    log_test_fail "Workflows validation" "Workflow validation failed (expected - no workflows exist yet)"
fi

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo "=========================================="
echo "📊 Local CI Test Summary"
echo "=========================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"
echo "Duration: ${DURATION}s"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Ready to push to CI.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. git add ."
    echo "  2. git commit -m 'feat: implement CI pipeline'"
    echo "  3. git push origin $(git branch --show-current)"
    exit 0
else
    echo -e "${RED}💥 $TESTS_FAILED tests failed. Fix issues before pushing.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Run 'pnpm lint:fix' for linting issues"
    echo "  - Run 'pnpm typecheck' for TypeScript errors"
    echo "  - Ensure all tests pass with 'pnpm test'"
    echo "  - Check workspace configuration"
    exit 1
fi