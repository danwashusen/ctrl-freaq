#!/bin/bash

# Branch protection validation script for CTRL FreaQ
# Validates that required status checks and branch protection are properly configured
# MUST FAIL initially as per TDD requirements

set -e

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

echo "🛡️  Validating branch protection settings..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to log results
log_check_start() {
    echo -e "\n${BLUE}🔍 Checking: $1${NC}"
}

log_check_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

log_check_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   Reason: $2${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Change to repository root
cd "$REPO_ROOT"

echo "=========================================="
echo "🛡️  Branch Protection Validation"
echo "=========================================="

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
log_info "Current branch: $CURRENT_BRANCH"

# Get remote origin URL
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "no-remote")
log_info "Remote URL: $REMOTE_URL"

# Check if we have GitHub CLI available
log_check_start "GitHub CLI availability"
if command -v gh &> /dev/null; then
    GH_VERSION=$(gh --version | head -1)
    log_check_pass "GitHub CLI available ($GH_VERSION)"
    HAS_GH_CLI=true
else
    log_check_fail "GitHub CLI" "gh command not found - install GitHub CLI for full validation"
    HAS_GH_CLI=false
fi

# Check if we can authenticate with GitHub
log_check_start "GitHub authentication"
if [ "$HAS_GH_CLI" = true ]; then
    if gh auth status &>/dev/null; then
        GH_USER=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        log_check_pass "GitHub authentication (user: $GH_USER)"
        HAS_GH_AUTH=true
    else
        log_check_fail "GitHub authentication" "Not authenticated with GitHub - run 'gh auth login'"
        HAS_GH_AUTH=false
    fi
else
    HAS_GH_AUTH=false
fi

# Define required status checks for CI pipeline
REQUIRED_CHECKS=(
    "lint"
    "typecheck"
    "build"
    "test"
    "workspace-validation"
)

# Check branch protection rules (if we have GitHub access)
log_check_start "Branch protection rules"
if [ "$HAS_GH_CLI" = true ] && [ "$HAS_GH_AUTH" = true ]; then
    # Try to get branch protection for main branch
    PROTECTION_DATA=$(gh api "repos/:owner/:repo/branches/main/protection" 2>/dev/null || echo "null")

    if [ "$PROTECTION_DATA" != "null" ]; then
        log_check_pass "Branch protection enabled for main branch"

        # Check required status checks
        log_check_start "Required status checks configuration"
        STATUS_CHECKS=$(echo "$PROTECTION_DATA" | jq -r '.required_status_checks.contexts[]' 2>/dev/null || echo "")

        if [ -n "$STATUS_CHECKS" ]; then
            log_info "Current required status checks:"
            echo "$STATUS_CHECKS" | sed 's/^/    - /'

            # Validate each required check
            for check in "${REQUIRED_CHECKS[@]}"; do
                if echo "$STATUS_CHECKS" | grep -q "^$check$"; then
                    log_check_pass "Required status check: $check"
                else
                    log_check_fail "Required status check: $check" "Not configured as required"
                fi
            done
        else
            log_check_fail "Required status checks" "No status checks configured"
        fi

        # Check other protection settings
        REQUIRE_REVIEWS=$(echo "$PROTECTION_DATA" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0' 2>/dev/null || echo "0")
        if ! [[ "$REQUIRE_REVIEWS" =~ ^[0-9]+$ ]]; then
            REQUIRE_REVIEWS=0
        fi
        if [ "$REQUIRE_REVIEWS" -gt 0 ]; then
            log_check_pass "Pull request reviews required ($REQUIRE_REVIEWS)"
        else
            log_warning "Pull request reviews not required"
        fi

        DISMISS_STALE=$(echo "$PROTECTION_DATA" | jq -r '.required_pull_request_reviews.dismiss_stale_reviews // false' 2>/dev/null || echo "false")
        case "$DISMISS_STALE" in
            true|false) ;;
            *) DISMISS_STALE="false" ;;
        esac
        if [ "$DISMISS_STALE" = "true" ]; then
            log_check_pass "Dismiss stale reviews enabled"
        else
            log_warning "Dismiss stale reviews not enabled"
        fi

    else
        log_check_fail "Branch protection" "No branch protection configured for main branch"
    fi
else
    log_warning "Cannot validate branch protection - GitHub CLI not available or not authenticated"
    echo "         To enable validation:"
    echo "         1. Install GitHub CLI: https://cli.github.com/"
    echo "         2. Run: gh auth login"
    echo "         3. Run this script again"
fi

# Check workflow files exist
log_check_start "CI workflow files"
WORKFLOW_DIR="$REPO_ROOT/.github/workflows"
if [ -d "$WORKFLOW_DIR" ]; then
    if [ -f "$WORKFLOW_DIR/ci.yml" ]; then
        log_check_pass "Main CI workflow exists (ci.yml)"
    else
        log_check_fail "Main CI workflow" "ci.yml not found"
    fi

    if [ -f "$WORKFLOW_DIR/pr-validation.yml" ]; then
        log_check_pass "PR validation workflow exists (pr-validation.yml)"
    else
        log_check_fail "PR validation workflow" "pr-validation.yml not found"
    fi
else
    log_check_fail "Workflows directory" ".github/workflows directory not found"
fi

# Validate workflow job names match required status checks
log_check_start "Workflow job configuration"
if [ -f "$WORKFLOW_DIR/ci.yml" ]; then
    for check in "${REQUIRED_CHECKS[@]}"; do
        if grep -q "$check:" "$WORKFLOW_DIR/ci.yml"; then
            log_check_pass "Workflow job defined: $check"
        else
            log_check_fail "Workflow job: $check" "Job not found in ci.yml"
        fi
    done
else
    log_warning "Cannot validate workflow jobs - ci.yml not found"
fi

# Generate configuration recommendations
echo ""
echo "=========================================="
echo "📝 Configuration Recommendations"
echo "=========================================="

if [ $CHECKS_FAILED -gt 0 ]; then
    echo "To configure branch protection:"
    echo ""
    echo "1. Enable branch protection for main branch:"
    echo "   gh api repos/:owner/:repo/branches/main/protection \\"
    echo "     --method PUT \\"
    echo "     --field required_status_checks='{\"strict\":true,\"contexts\":[\"lint\",\"typecheck\",\"build\",\"test\",\"workspace-validation\"]}' \\"
    echo "     --field enforce_admins=true \\"
    echo "     --field required_pull_request_reviews='{\"required_approving_review_count\":1,\"dismiss_stale_reviews\":true}'"
    echo ""
    echo "2. Or configure via GitHub web interface:"
    echo "   - Go to repository Settings → Branches"
    echo "   - Add rule for main branch"
    echo "   - Enable: Require status checks, Require pull request reviews"
    echo "   - Add status checks: $(printf "%s, " "${REQUIRED_CHECKS[@]}" | sed 's/, $//')"
    echo ""
fi

# Summary
echo "=========================================="
echo "📊 Branch Protection Summary"
echo "=========================================="
echo "Checks passed: $CHECKS_PASSED"
echo "Checks failed: $CHECKS_FAILED"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Branch protection is properly configured!${NC}"
    exit 0
else
    echo -e "${RED}💥 Branch protection needs attention.${NC}"
    echo ""
    echo "Required actions:"
    echo "  1. Create CI workflow files (ci.yml, pr-validation.yml)"
    echo "  2. Configure required status checks in GitHub"
    echo "  3. Enable branch protection for main branch"
    echo "  4. Run this script again to validate"
    exit 1
fi
