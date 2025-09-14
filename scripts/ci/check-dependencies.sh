#!/bin/bash

# Workspace dependency check script for CTRL FreaQ monorepo
# Validates dependency consistency across all packages in the workspace
# Ensures monorepo integrity and prevents version conflicts

set -e

# Exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_VALIDATION_FAILURE=1
readonly EXIT_SETUP_ERROR=2

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
        rm -f "$TEMP_FILE" 2>/dev/null || true
    fi
    exit $exit_code
}

# Error handler
handle_error() {
    local exit_code=$?
    local line_number=$1
    echo "❌ Error occurred in script at line $line_number (exit code: $exit_code)" >&2
    cleanup
}

# Set up error handling
trap 'handle_error $LINENO' ERR
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load NVM and use the correct Node version
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"

    if [ -f "$REPO_ROOT/.nvmrc" ]; then
        cd "$REPO_ROOT" && nvm use > /dev/null 2>&1
    fi
elif [ -f "$REPO_ROOT/.nvmrc" ]; then
    REQUIRED_NODE=$(cat "$REPO_ROOT/.nvmrc")
    echo "⚠️  NVM not found. Please ensure you're using Node.js v$REQUIRED_NODE"
fi

echo "🔍 Checking workspace dependency consistency..."
echo "Repository root: $REPO_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Function to log results
log_check_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

log_check_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   Issue: $2${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    echo -e "${YELLOW}   Details: $2${NC}"
    WARNINGS=$((WARNINGS + 1))
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Change to repository root
cd "$REPO_ROOT"

echo "=========================================="
echo "🔍 CTRL FreaQ Workspace Dependency Check"
echo "=========================================="

# 1. Check workspace configuration
echo ""
log_info "Checking workspace configuration..."

if [ -f "pnpm-workspace.yaml" ]; then
    log_check_pass "pnpm-workspace.yaml exists"

    # Validate workspace packages are accessible
    PACKAGES=$(pnpm list --depth=0 --parseable 2>/dev/null | wc -l || echo "0")
    if [ "$PACKAGES" -gt 1 ]; then
        log_check_pass "Workspace packages detected ($PACKAGES packages)"
    else
        log_check_fail "Workspace packages" "No packages found - workspace may be misconfigured"
    fi
else
    log_check_fail "Workspace configuration" "pnpm-workspace.yaml not found"
fi

# 2. Check for lockfile integrity
echo ""
log_info "Checking lockfile integrity..."

if [ -f "pnpm-lock.yaml" ]; then
    log_check_pass "pnpm-lock.yaml exists"

    # Check if lockfile is up to date
    if pnpm install --frozen-lockfile --dry-run > /dev/null 2>&1; then
        log_check_pass "Lockfile is up to date"
    else
        log_check_fail "Lockfile integrity" "Lockfile is out of sync - run 'pnpm install'"
    fi
else
    log_check_fail "Lockfile" "pnpm-lock.yaml not found"
fi

# 3. Check Node.js version consistency
echo ""
log_info "Checking Node.js version requirements..."

# Find all package.json files
PACKAGE_FILES=$(find . -name "package.json" -not -path "./node_modules/*" -not -path "*/node_modules/*")

NODE_VERSIONS=()
while IFS= read -r package_file; do
    if [ -f "$package_file" ]; then
        NODE_VERSION=$(jq -r '.engines.node // empty' "$package_file" 2>/dev/null || echo "")
        if [ -n "$NODE_VERSION" ] && [ "$NODE_VERSION" != "null" ]; then
            NODE_VERSIONS+=("$NODE_VERSION")
        fi
    fi
done <<< "$PACKAGE_FILES"

# Check for consistency
if [ ${#NODE_VERSIONS[@]} -gt 0 ]; then
    UNIQUE_VERSIONS=($(printf "%s\n" "${NODE_VERSIONS[@]}" | sort -u))
    if [ ${#UNIQUE_VERSIONS[@]} -eq 1 ]; then
        log_check_pass "Node.js version consistency (${UNIQUE_VERSIONS[0]})"
    else
        log_check_fail "Node.js version consistency" "Multiple versions found: ${UNIQUE_VERSIONS[*]}"
    fi
else
    log_warning "Node.js version" "No engine requirements found in package.json files"
fi

# 4. Check TypeScript version consistency
echo ""
log_info "Checking TypeScript version consistency..."

TS_VERSIONS=()
while IFS= read -r package_file; do
    if [ -f "$package_file" ]; then
        # Check both dependencies and devDependencies
        TS_VERSION=$(jq -r '(.dependencies.typescript // .devDependencies.typescript) // empty' "$package_file" 2>/dev/null || echo "")
        if [ -n "$TS_VERSION" ] && [ "$TS_VERSION" != "null" ]; then
            TS_VERSIONS+=("$TS_VERSION:$(dirname "$package_file")")
        fi
    fi
done <<< "$PACKAGE_FILES"

if [ ${#TS_VERSIONS[@]} -gt 0 ]; then
    # Extract just the version numbers for comparison
    UNIQUE_TS_VERSIONS=($(printf "%s\n" "${TS_VERSIONS[@]}" | cut -d: -f1 | sort -u))
    if [ ${#UNIQUE_TS_VERSIONS[@]} -eq 1 ]; then
        log_check_pass "TypeScript version consistency (${UNIQUE_TS_VERSIONS[0]})"
    else
        log_check_fail "TypeScript version consistency" "Multiple versions found"
        for version_info in "${TS_VERSIONS[@]}"; do
            version=$(echo "$version_info" | cut -d: -f1)
            path=$(echo "$version_info" | cut -d: -f2)
            echo "    $version in $path"
        done
    fi
else
    log_warning "TypeScript version" "No TypeScript dependencies found"
fi

# 5. Check @types/node version consistency
echo ""
log_info "Checking @types/node version consistency..."

TYPES_NODE_VERSIONS=()
while IFS= read -r package_file; do
    if [ -f "$package_file" ]; then
        TYPES_VERSION=$(jq -r '(.dependencies["@types/node"] // .devDependencies["@types/node"]) // empty' "$package_file" 2>/dev/null || echo "")
        if [ -n "$TYPES_VERSION" ] && [ "$TYPES_VERSION" != "null" ]; then
            TYPES_NODE_VERSIONS+=("$TYPES_VERSION:$(dirname "$package_file")")
        fi
    fi
done <<< "$PACKAGE_FILES"

if [ ${#TYPES_NODE_VERSIONS[@]} -gt 0 ]; then
    UNIQUE_TYPES_VERSIONS=($(printf "%s\n" "${TYPES_NODE_VERSIONS[@]}" | cut -d: -f1 | sort -u))
    if [ ${#UNIQUE_TYPES_VERSIONS[@]} -eq 1 ]; then
        log_check_pass "@types/node version consistency (${UNIQUE_TYPES_VERSIONS[0]})"
    else
        log_check_fail "@types/node version consistency" "Multiple versions found"
        for version_info in "${TYPES_NODE_VERSIONS[@]}"; do
            version=$(echo "$version_info" | cut -d: -f1)
            path=$(echo "$version_info" | cut -d: -f2)
            echo "    $version in $path"
        done
    fi
else
    log_warning "@types/node version" "No @types/node dependencies found"
fi

# 6. Check for duplicate dependencies
echo ""
log_info "Checking for potential duplicate dependencies..."

# Common packages that should be consistent across workspace
CRITICAL_DEPS=("react" "react-dom" "typescript" "eslint" "prettier" "vitest")

for dep in "${CRITICAL_DEPS[@]}"; do
    DEP_VERSIONS=()
    while IFS= read -r package_file; do
        if [ -f "$package_file" ]; then
            DEP_VERSION=$(jq -r "(.dependencies[\"$dep\"] // .devDependencies[\"$dep\"]) // empty" "$package_file" 2>/dev/null || echo "")
            if [ -n "$DEP_VERSION" ] && [ "$DEP_VERSION" != "null" ]; then
                DEP_VERSIONS+=("$DEP_VERSION:$(dirname "$package_file")")
            fi
        fi
    done <<< "$PACKAGE_FILES"

    if [ ${#DEP_VERSIONS[@]} -gt 1 ]; then
        UNIQUE_DEP_VERSIONS=($(printf "%s\n" "${DEP_VERSIONS[@]}" | cut -d: -f1 | sort -u))
        if [ ${#UNIQUE_DEP_VERSIONS[@]} -eq 1 ]; then
            log_check_pass "$dep version consistency (${UNIQUE_DEP_VERSIONS[0]})"
        else
            log_warning "$dep version inconsistency" "Multiple versions found"
            for version_info in "${DEP_VERSIONS[@]}"; do
                version=$(echo "$version_info" | cut -d: -f1)
                path=$(echo "$version_info" | cut -d: -f2)
                echo "    $version in $path"
            done
        fi
    fi
done

# 7. Check for security vulnerabilities
echo ""
log_info "Checking for security vulnerabilities..."

if command -v pnpm &> /dev/null; then
    if pnpm audit --audit-level moderate --summary > /dev/null 2>&1; then
        log_check_pass "No moderate or high security vulnerabilities"
    else
        AUDIT_RESULT=$(pnpm audit --audit-level moderate --summary 2>&1 || true)
        if echo "$AUDIT_RESULT" | grep -q "vulnerabilities"; then
            log_check_fail "Security vulnerabilities" "Run 'pnpm audit' for details"
        else
            log_warning "Security audit" "Could not run pnpm audit"
        fi
    fi
else
    log_warning "Security audit" "pnpm not available"
fi

# 8. Check for outdated dependencies
echo ""
log_info "Checking for severely outdated dependencies..."

if command -v pnpm &> /dev/null; then
    # Check for packages that are more than 1 major version behind
    OUTDATED=$(pnpm outdated --format json 2>/dev/null | jq -r '.[] | select(.current != .latest and (.latest | split(".")[0] | tonumber) > (.current | split(".")[0] | tonumber) + 1) | .packageName' 2>/dev/null || echo "")

    if [ -n "$OUTDATED" ]; then
        log_warning "Severely outdated dependencies" "Some packages are multiple major versions behind"
        echo "    Run 'pnpm outdated' to see details"
    else
        log_check_pass "No severely outdated dependencies"
    fi
else
    log_warning "Outdated check" "pnpm not available"
fi

# Generate summary
echo ""
echo "=========================================="
echo "📊 Dependency Check Summary"
echo "=========================================="
echo "Checks passed: $CHECKS_PASSED"
echo "Checks failed: $CHECKS_FAILED"
echo "Warnings: $WARNINGS"

# Recommendations
if [ $CHECKS_FAILED -gt 0 ] || [ $WARNINGS -gt 3 ]; then
    echo ""
    echo "🔧 Recommended Actions:"

    if [ $CHECKS_FAILED -gt 0 ]; then
        echo "  1. Fix failing dependency checks:"
        echo "     - Ensure consistent versions across workspace"
        echo "     - Update lockfile with 'pnpm install'"
        echo "     - Address any security vulnerabilities"
    fi

    if [ $WARNINGS -gt 3 ]; then
        echo "  2. Address warnings:"
        echo "     - Consider updating outdated dependencies"
        echo "     - Standardize dependency versions where possible"
        echo "     - Review and update engine requirements"
    fi

    echo ""
    echo "  3. Useful commands:"
    echo "     pnpm install              # Update lockfile"
    echo "     pnpm audit                # Security audit"
    echo "     pnpm outdated             # Check for updates"
    echo "     pnpm update -r            # Update all packages"
fi

# Exit with appropriate code
if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 Workspace dependency validation passed!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Workspace dependency validation failed.${NC}"
    echo "Please fix the issues above before continuing."
    exit 1
fi