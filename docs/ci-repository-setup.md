# CI Repository Setup Guide

This guide covers setting up GitHub repository settings to work with the CTRL FreaQ CI pipeline, including branch protection rules and required status checks.

## Overview

The CTRL FreaQ CI pipeline requires specific GitHub repository settings to enforce quality gates and maintain code quality. This includes:

- Branch protection rules for the main branch
- Required status checks that must pass before merging
- Pull request review requirements
- Automated dependency management via Dependabot

## Branch Protection Configuration

### Required Status Checks

The following status checks must be configured as **required** for the main branch:

- `lint` - ESLint validation across all packages
- `typecheck` - TypeScript compilation validation
- `build` - Build process validation
- `test` - Test suite execution
- `workspace-validation` - Monorepo workspace integrity

### Manual Configuration (GitHub Web Interface)

1. **Navigate to Repository Settings**:
   - Go to your repository on GitHub
   - Click on **Settings** tab
   - Select **Branches** from the left sidebar

2. **Add Branch Protection Rule**:
   - Click **Add rule**
   - Branch name pattern: `main`
   - Enable the following options:

3. **Required Settings**:
   - ✅ **Require a pull request before merging**
     - Required approving reviews: `1`
     - ✅ Dismiss stale reviews when new commits are pushed
     - ✅ Require review from CODEOWNERS (if applicable)

   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - **Add the following status checks**:
       - `lint`
       - `typecheck`
       - `build`
       - `test`
       - `workspace-validation`

   - ✅ **Require conversation resolution before merging**
   - ✅ **Include administrators** (recommended)

4. **Save Changes**:
   - Click **Create** to apply the branch protection rule

### Automated Configuration (GitHub CLI)

You can also configure branch protection using the GitHub CLI:

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Other: https://cli.github.com/

# Authenticate with GitHub
gh auth login

# Configure branch protection with required status checks
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{
    "strict": true,
    "contexts": [
      "lint",
      "typecheck",
      "build",
      "test",
      "workspace-validation"
    ]
  }' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  }' \
  --field restrictions=null \
  --field required_conversation_resolution=true

# Verify the configuration
gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts'
```

### Configuration Script

For convenience, you can use the provided script to check and configure branch protection:

```bash
# Check current branch protection status
./scripts/ci/check-protection.sh

# The script will provide specific commands to fix any issues
```

## Dependabot Configuration

Dependabot is already configured via `.github/dependabot.yml` to:

- Update npm dependencies weekly on Mondays
- Update GitHub Actions weekly
- Group related dependencies (TypeScript, testing, linting, React)
- Create PRs with proper commit message prefixes

### Dependabot Settings

1. **Enable Dependabot**:
   - Go to repository **Settings** → **Security & analysis**
   - Enable **Dependabot alerts**
   - Enable **Dependabot security updates**

2. **Configure Notifications**:
   - Go to **Settings** → **Notifications**
   - Configure how you want to be notified about Dependabot PRs

## Webhooks and Integrations

### GitHub Actions Integration

The CI pipeline automatically integrates with:

- **Pull Request Events**: Triggers on open, synchronize, reopen
- **Push Events**: Triggers on pushes to main/development branches
- **Workflow Dispatch**: Allows manual triggering

### Status Check Integration

GitHub automatically tracks the status of each CI job:

- ✅ **Passing**: All checks completed successfully
- ❌ **Failed**: One or more checks failed
- 🟡 **Pending**: Checks are currently running
- ⚪ **Expected**: Checks are queued but not started

## Troubleshooting

### Common Issues

#### Status Checks Not Appearing

**Problem**: Required status checks don't appear in PR
**Solution**:
1. Ensure the CI workflow has run at least once on the branch
2. Check that job names in `.github/workflows/ci.yml` match required check names
3. Verify the workflow triggers include `pull_request` events

#### Branch Protection Not Enforcing

**Problem**: PRs can be merged despite failing checks
**Solution**:
1. Verify branch protection rule is active for the correct branch pattern
2. Check that "Require status checks to pass before merging" is enabled
3. Ensure administrators are included in restrictions (if desired)

#### Missing Status Checks

**Problem**: Some required checks are missing from the list
**Solution**:
```bash
# List available status checks (after CI has run)
gh api repos/:owner/:repo/commits/main/status --jq '.statuses[].context'

# Update branch protection with correct check names
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint","typecheck","build","test","workspace-validation"]}'
```

### Verification Commands

```bash
# Check branch protection status
gh api repos/:owner/:repo/branches/main/protection

# List current status checks
gh api repos/:owner/:repo/commits/main/status

# View recent workflow runs
gh run list --workflow=ci.yml --limit=5

# Test branch protection
git checkout -b test-protection
echo "test" >> README.md
git add README.md
git commit -m "test: branch protection"
git push origin test-protection
gh pr create --title "Test PR" --body "Testing branch protection"
```

## Maintenance

### Regular Tasks

1. **Review Dependabot PRs**: Weekly review and merge dependency updates
2. **Monitor CI Performance**: Check workflow duration trends in Actions tab
3. **Update Status Checks**: Add new checks when workflow changes
4. **Review Protection Rules**: Ensure rules match current workflow requirements

### When Adding New CI Jobs

1. **Update Required Status Checks**: Add new job names to branch protection
2. **Test on Feature Branch**: Verify new checks work before requiring them
3. **Document Changes**: Update this guide with new requirements
4. **Notify Team**: Inform team members of new requirements

## Security Considerations

### Branch Protection Best Practices

- **Never disable branch protection** on main/production branches
- **Require administrator compliance** to ensure consistency
- **Regular audit**: Review protection settings monthly
- **Monitor bypass events**: Check for any protection rule bypasses

### Access Control

- **Limit repository admin access** to essential personnel only
- **Use teams for permissions** rather than individual user access
- **Regular access review**: Audit repository access quarterly
- **Enable audit logging** for compliance tracking

## References

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub CLI Branch Protection Reference](https://cli.github.com/manual/gh_api)
- [GitHub Actions Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)