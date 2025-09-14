#!/bin/bash

# Workflow syntax validation script for CTRL FreaQ CI pipeline
# This script validates GitHub Actions workflows before they are committed
# MUST FAIL initially as per TDD requirements

set -e

# Exit codes (T032: Consistent exit codes across scripts)
readonly EXIT_SUCCESS=0
readonly EXIT_VALIDATION_FAILURE=1
readonly EXIT_SETUP_ERROR=2

# Cleanup function
cleanup() {
    local exit_code=$?
    # Clean up any temporary files if needed
    exit $exit_code
}

# Error handler
handle_error() {
    local exit_code=$?
    local line_number=$1
    echo "❌ Error occurred in workflow validation script at line $line_number (exit code: $exit_code)" >&2
    cleanup
}

# Set up error handling
trap 'handle_error $LINENO' ERR
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"

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

# Function to validate main CI workflow
validate_main_ci_workflow() {
    local file="$1"
    log_info "Validating main CI workflow structure..."

    # Check required triggers
    if ! grep -q "push:" "$file"; then
        log_error "Main CI workflow missing push trigger"
    fi

    # Check for required jobs
    local required_jobs=("setup" "lint" "typecheck" "build" "test")
    for job in "${required_jobs[@]}"; do
        if ! grep -q "$job:" "$file"; then
            log_error "Main CI workflow missing required job: $job"
        fi
    done

    # Check for timeout configuration
    if ! grep -q "timeout-minutes:" "$file"; then
        log_warning "Consider adding timeout-minutes to prevent runaway jobs"
    fi
}

# Function to validate PR workflow
validate_pr_workflow() {
    local file="$1"
    log_info "Validating PR workflow structure..."

    # Check for concurrency control
    if ! grep -q "concurrency:" "$file"; then
        log_error "PR workflow missing concurrency control"
    fi

    # Check for pull_request trigger
    if ! grep -q "pull_request:" "$file"; then
        log_error "PR workflow missing pull_request trigger"
    fi
}

echo "🔍 Validating GitHub Actions workflows..."
echo "Workflows directory: $WORKFLOWS_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

# Function to log errors
log_error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
}

# Function to log warnings
log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    VALIDATION_WARNINGS=$((VALIDATION_WARNINGS + 1))
}

# Function to log success
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to log info
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if workflows directory exists
if [ ! -d "$WORKFLOWS_DIR" ]; then
    log_error "Workflows directory does not exist: $WORKFLOWS_DIR"
    exit 1
fi

# Find all YAML workflow files
WORKFLOW_FILES=$(find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" 2>/dev/null || true)

if [ -z "$WORKFLOW_FILES" ]; then
    log_error "No workflow files found in $WORKFLOWS_DIR"
    echo "Expected files: ci.yml, pr-validation.yml"
    exit 1
fi

log_info "Found workflow files:"
echo "$WORKFLOW_FILES" | while read -r file; do
    echo "  - $(basename "$file")"
done

# Validate each workflow file
for workflow_file in $WORKFLOW_FILES; do
    echo ""
    log_info "Validating $(basename "$workflow_file")..."

    # Check if file is readable
    if [ ! -r "$workflow_file" ]; then
        log_error "Cannot read workflow file: $workflow_file"
        continue
    fi

    # Basic YAML syntax check - try multiple methods
    yaml_valid=false

    # Method 1: Try with yamllint if available
    if command -v yamllint &> /dev/null; then
        if yamllint -q "$workflow_file" 2>/dev/null; then
            yaml_valid=true
        fi
    # Method 2: Try with Python if yaml module is available
    elif command -v python3 &> /dev/null; then
        if python3 -c "
import sys
try:
    import yaml
    with open('$workflow_file', 'r') as f:
        yaml.safe_load(f)
    sys.exit(0)
except ImportError:
    sys.exit(2)  # yaml module not available
except Exception as e:
    sys.exit(1)  # yaml syntax error
" 2>/dev/null; then
            yaml_valid=true
        else
            exit_code=$?
            if [ $exit_code -eq 1 ]; then
                log_error "Invalid YAML syntax in $(basename "$workflow_file")"
                continue
            fi
            # exit_code 2 means yaml module not available, continue with basic check
        fi
    fi

    # Method 3: Basic structure check if no YAML parser available
    if [ "$yaml_valid" = false ]; then
        # Simple validation: check for basic YAML structure
        if ! grep -q "^name:" "$workflow_file" || ! grep -q "^\"\\?on\"\\?:" "$workflow_file" || ! grep -q "^jobs:" "$workflow_file"; then
            log_error "Invalid YAML syntax in $(basename "$workflow_file") - missing required sections"
            continue
        fi
        log_warning "Limited YAML validation for $(basename "$workflow_file") - install yamllint or PyYAML for full validation"
    fi

    # Required workflow structure validation
    filename=$(basename "$workflow_file")
    case "$filename" in
        "ci.yml")
            validate_main_ci_workflow "$workflow_file"
            ;;
        "pr-validation.yml")
            validate_pr_workflow "$workflow_file"
            ;;
        *)
            log_warning "Unexpected workflow file: $filename"
            ;;
    esac
done

# Summary
echo ""
echo "=========================================="
echo "📊 Validation Summary"
echo "=========================================="
echo "Files validated: $(echo "$WORKFLOW_FILES" | wc -l)"
echo "Errors: $VALIDATION_ERRORS"
echo "Warnings: $VALIDATION_WARNINGS"

if [ $VALIDATION_ERRORS -eq 0 ] && [ $VALIDATION_WARNINGS -eq 0 ]; then
    log_success "All workflows are valid! 🎉"
    exit 0
elif [ $VALIDATION_ERRORS -eq 0 ]; then
    log_warning "Validation passed with warnings"
    exit 0
else
    log_error "Validation failed with $VALIDATION_ERRORS errors"
    echo ""
    echo "📝 To fix:"
    echo "  1. Create missing workflow files (ci.yml, pr-validation.yml)"
    echo "  2. Ensure proper YAML syntax"
    echo "  3. Include all required jobs and configuration"
    echo "  4. Run this script again to validate"
    exit 1
fi