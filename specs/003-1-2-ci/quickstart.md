# CI Pipeline Quick Start Guide

## Overview

This guide helps you work with the CTRL FreaQ CI/CD pipeline powered by GitHub
Actions.

## Prerequisites

- GitHub repository access
- Understanding of pnpm workspaces
- Basic knowledge of GitHub Actions
- Node.js 22.x (use `nvm use` if you have NVM installed)

## Common Tasks

### 1. Trigger CI Manually

```bash
# Push to a branch to trigger CI
git push origin your-branch

# Or create/update a PR
gh pr create --title "Your change" --body "Description"
```

### 2. Debug Failed CI Runs

#### View CI Logs

1. Go to the PR or commit on GitHub
2. Click on the failing check
3. Click "Details" to see the full logs
4. Look for the specific job that failed

#### Common Failure Patterns

**Lint Failures**:

```bash
# Fix locally before pushing
pnpm lint:fix
git add -A
git commit -m "fix: resolve lint issues"
git push
```

**Type Check Failures**:

```bash
# Check types locally
pnpm typecheck

# Fix type errors in your editor
# VSCode: Cmd+Shift+B → "TypeScript: Watch"
```

**Test Failures**:

```bash
# Run tests locally with same command as CI
pnpm test

# Run specific package tests
pnpm --filter @ctrl-freaq/shared-data test

# Debug specific test
pnpm test -- --grep "test name"
```

**Build Failures**:

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### 3. Update CI Configuration

#### Modify Workflow

```bash
# Edit workflow file
code .github/workflows/ci.yml

# Test changes on feature branch
git checkout -b ci-updates
git add .github/workflows/
git commit -m "ci: update workflow configuration"
git push origin ci-updates
```

#### Add New Check

1. Edit `.github/workflows/ci.yml`
2. Add new job under `jobs:` section:

```yaml
new-check:
  name: New Check Name
  runs-on: ubuntu-latest
  needs: setup
  steps:
    - uses: actions/checkout@v4
    - name: Run new check
      run: pnpm run new-check-command
```

3. Update status checks in repository settings if required

### 4. Add New Package to CI

When adding a new package to the monorepo:

1. Ensure package.json has standard scripts:

```json
{
  "scripts": {
    "build": "...",
    "test": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

2. Update turbo.json if needed:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

3. CI will automatically pick up the new package

## Troubleshooting

### CI Takes Too Long

- **Issue**: Pipeline exceeds 5-minute timeout
- **Solution**:
  - Check for slow tests: `pnpm test -- --reporter=verbose`
  - Optimize build: ensure Turborepo caching is working
  - Review dependencies: remove unused packages

### Cache Not Working

- **Issue**: Dependencies reinstalled every run
- **Solution**:
  - Check pnpm-lock.yaml is committed
  - Verify cache key in workflow:
    `key: pnpm-store-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}`
  - Clear cache if corrupted: Settings → Actions → Caches → Delete

### Concurrent PR Runs

- **Issue**: Multiple CI runs on same PR
- **Solution**:
  - CI automatically cancels previous runs
  - Check concurrency group in PR workflow
  - Manually cancel from Actions tab if needed

### Version Conflicts

- **Issue**: Dependency version mismatch in monorepo
- **Solution**:

```bash
# Check for conflicts
pnpm install

# Update all packages to latest versions
pnpm update -r

# Ensure lockfile is updated
pnpm install --frozen-lockfile
```

## Performance Tips

### Local Validation Before Push

```bash
# Run all CI checks locally
pnpm lint && pnpm typecheck && pnpm build && pnpm test

# Or create a pre-push hook
cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
pnpm lint && pnpm typecheck
EOF
chmod +x .git/hooks/pre-push
```

### Optimize Test Runs

```bash
# Run only affected tests
pnpm test -- --changed

# Run tests in watch mode during development
pnpm test -- --watch

# Skip tests temporarily (use sparingly!)
git push --no-verify
```

## CI Environment Variables

The CI environment provides these variables:

- `CI=true` - Indicates CI environment
- `GITHUB_ACTIONS=true` - Running in GitHub Actions
- `NODE_ENV=test` - For test runs
- `GITHUB_REF` - Branch or tag ref
- `GITHUB_SHA` - Commit SHA
- `GITHUB_PR_NUMBER` - PR number (if applicable)

## Monitoring CI Health

### View CI Analytics

1. Go to Actions tab in GitHub
2. Click on workflow name (e.g., "CI Pipeline")
3. View success rate, duration trends

### Set Up Notifications

1. Go to Settings → Notifications
2. Configure email/Slack for CI failures
3. Use GitHub mobile app for instant alerts

## Best Practices

1. **Keep CI Fast**: Target < 3 minutes for PR validation
2. **Fix Immediately**: Don't merge with failing CI
3. **Test Locally First**: Run checks before pushing
4. **Use Draft PRs**: For work-in-progress to save CI resources
5. **Review CI Logs**: Even on success, check for warnings
6. **Update Together**: Keep CI config in sync with project changes

## Getting Help

- **CI Failures**: Check logs, run locally, ask in team chat
- **Configuration Issues**: Review workflow files, check GitHub docs
- **Performance Problems**: Profile locally, review Turborepo cache hits
- **Access Issues**: Verify GitHub permissions, check PAT tokens

## Quick Commands Reference

```bash
# Install and setup
pnpm install

# Run all CI checks locally
pnpm ci:local

# Individual checks
pnpm lint
pnpm typecheck
pnpm build
pnpm test

# Fix common issues
pnpm lint:fix
pnpm format

# Clean everything
pnpm clean
rm -rf node_modules
pnpm install
```
