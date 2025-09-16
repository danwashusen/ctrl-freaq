# CI Pipeline Troubleshooting Guide

This guide helps developers diagnose and fix common issues with the CTRL FreaQ
CI pipeline.

## Quick Diagnostics

### Check CI Status

```bash
# View recent workflow runs
gh run list --workflow=ci.yml --limit=10

# Check specific run details
gh run view [RUN_ID]

# View logs for failed jobs
gh run view [RUN_ID] --log-failed
```

### Local Testing

```bash
# Test CI pipeline locally
./scripts/ci/test-ci-locally.sh

# Validate workflow syntax
./scripts/ci/validate-workflows.sh

# Check workspace dependencies
./scripts/ci/check-dependencies.sh
```

## Common Issues and Solutions

### 1. Lint Failures

**Symptoms:**

- ESLint job fails with style violations
- Code format inconsistencies reported

**Diagnosis:**

```bash
# Run linting locally
pnpm lint

# Check for auto-fixable issues
pnpm lint:fix --dry-run
```

**Solutions:**

```bash
# Fix auto-fixable issues
pnpm lint:fix

# For manual fixes, address each violation:
# - Remove unused imports
# - Fix indentation and spacing
# - Follow naming conventions
# - Add missing type annotations

# Verify fixes
pnpm lint
```

**Prevention:**

- Set up ESLint integration in your editor
- Enable format-on-save with Prettier
- Run `pnpm lint` before committing

### 2. TypeScript Compilation Errors

**Symptoms:**

- TypeScript job fails with compilation errors
- Type checking errors in specific packages

**Diagnosis:**

```bash
# Run typecheck locally
pnpm typecheck

# Check specific package
pnpm --filter @ctrl-freaq/[package-name] typecheck

# Verbose output for debugging
pnpm typecheck --verbose
```

**Solutions:**

```bash
# Common type issues:
# 1. Missing type definitions
npm install --save-dev @types/[library-name]

# 2. Incorrect import paths
# Update import statements to use correct paths

# 3. Strict mode violations
# Add explicit type annotations where needed

# 4. Outdated TypeScript version
pnpm update typescript @types/node
```

**Prevention:**

- Use TypeScript strict mode in development
- Enable TypeScript checking in your editor
- Add type annotations for complex types

### 3. Build Failures

**Symptoms:**

- Build job fails during compilation
- Missing build artifacts

**Diagnosis:**

```bash
# Build locally
pnpm build

# Build specific package
pnpm --filter @ctrl-freaq/[package-name] build

# Check Turborepo cache
pnpm build --dry-run
```

**Solutions:**

```bash
# Clear build cache and rebuild
rm -rf dist build .turbo node_modules/.cache
pnpm install
pnpm build

# Fix import/export issues:
# - Check for circular dependencies
# - Verify export statements
# - Update import paths

# Environment-specific issues:
# - Check Node.js version compatibility
# - Verify environment variables
# - Update build configuration
```

### 4. Test Failures

**Symptoms:**

- Test job reports failing tests
- Test timeouts or crashes

**Diagnosis:**

```bash
# Run tests locally
pnpm test

# Run specific test suite
pnpm --filter @ctrl-freaq/[package-name] test

# Run tests with verbose output
pnpm test --verbose

# Run tests in watch mode for debugging
pnpm test --watch
```

**Solutions:**

```bash
# Update failing tests:
# 1. Fix test logic errors
# 2. Update snapshots if needed
# 3. Mock external dependencies
# 4. Fix async/await issues

# Performance issues:
# - Increase test timeout
# - Optimize test setup/teardown
# - Use proper cleanup in tests

# Environment issues:
# - Check test database setup
# - Verify test environment variables
# - Update test dependencies
```

### 5. Dependency Issues

**Symptoms:**

- Workspace validation fails
- Version conflicts detected
- Security vulnerabilities found

**Diagnosis:**

```bash
# Check dependency consistency
./scripts/ci/check-dependencies.sh

# Audit for security issues
pnpm audit

# Check for outdated packages
pnpm outdated
```

**Solutions:**

```bash
# Fix version inconsistencies:
# 1. Standardize versions across workspace
pnpm install [package]@[version] --workspace-root

# 2. Update package.json files manually
# 3. Regenerate lockfile
rm pnpm-lock.yaml
pnpm install

# Security vulnerabilities:
pnpm audit --fix

# Outdated dependencies:
pnpm update --recursive
```

### 6. Cache Issues

**Symptoms:**

- Jobs running slower than expected
- Cache misses in CI logs
- Inconsistent build results

**Diagnosis:**

```bash
# Check cache status in CI logs
gh run view [RUN_ID] --log | grep -i cache

# Clear local caches
rm -rf node_modules .turbo dist build
pnpm store prune
```

**Solutions:**

```bash
# Force cache refresh:
# 1. Update dependencies to change lockfile hash
# 2. Clear GitHub Actions cache (repository settings)
# 3. Review cache key patterns in workflow

# Local development:
pnpm install --frozen-lockfile
pnpm build
```

### 7. Timeout Issues

**Symptoms:**

- Jobs timeout after 5 minutes
- Hanging processes
- Resource exhaustion

**Diagnosis:**

```bash
# Check job duration in CI logs
gh run view [RUN_ID]

# Test locally with timeout
timeout 300s pnpm [command]
```

**Solutions:**

```bash
# Optimize performance:
# 1. Enable parallel execution where possible
# 2. Optimize test suites for speed
# 3. Use Turborepo caching effectively
# 4. Remove unnecessary dependencies

# If legitimate need for longer timeout:
# Update timeout-minutes in .github/workflows/ci.yml
# (Consider implications for cost and developer experience)
```

## Environment-Specific Issues

### Node.js Version Issues

**Problem:** CI fails due to Node.js version mismatch

```bash
# Check current version
node --version

# Switch to project version
nvm use

# Update CI configuration
# Edit .github/workflows/ci.yml NODE_VERSION
```

### pnpm Version Issues

**Problem:** pnpm commands fail or behave unexpectedly

```bash
# Check pnpm version
pnpm --version

# Install correct version
npm install -g pnpm@9

# Update CI configuration
# Edit .github/workflows/ci.yml PNPM_VERSION
```

### GitHub Actions Limits

**Problem:** CI fails due to GitHub Actions limitations

- **Resource limits:** Reduce parallel jobs or optimize build
- **API rate limits:** Add delays between API calls
- **Artifact size limits:** Compress or exclude large files
- **Log size limits:** Reduce verbose output

## Advanced Debugging

### Enable Debug Logging

```bash
# Set environment variables in workflow
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Inspect CI Environment

```bash
# Add debugging step to workflow
- name: Debug Environment
  run: |
    echo "Node.js: $(node --version)"
    echo "pnpm: $(pnpm --version)"
    echo "Working directory: $(pwd)"
    echo "Environment variables:"
    env | sort
    echo "Disk usage:"
    df -h
    echo "Memory usage:"
    free -h
```

### SSH Debug Access

```bash
# Add to workflow for interactive debugging (use sparingly)
- name: Setup tmate session
  if: failure()
  uses: mxschmitt/action-tmate@v3
  with:
    limit-access-to-actor: true
```

## Monitoring and Alerts

### Set up Notifications

```bash
# GitHub repository settings → Notifications
# Configure email/Slack notifications for:
# - Failed workflow runs
# - Successful deployments
# - Security alerts

# Use GitHub CLI for status checks
gh api repos/:owner/:repo/commits/main/status
```

### Performance Monitoring

```bash
# Review CI metrics regularly
./scripts/ci/generate-metrics.js

# Monitor trends:
# - Job duration changes
# - Cache hit rates
# - Success/failure ratios
# - Resource usage patterns
```

## Getting Help

### Internal Resources

- **CI Pipeline Documentation:** `docs/ci-repository-setup.md`
- **Workflow Validation:** `scripts/ci/validate-workflows.sh`
- **Local Testing:** `scripts/ci/test-ci-locally.sh`
- **Dependency Checker:** `scripts/ci/check-dependencies.sh`

### External Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [pnpm Workspace Guide](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Vitest Testing Framework](https://vitest.dev/)

### Escalation Process

1. **Self-Service:** Use this troubleshooting guide and local testing scripts
2. **Team Discussion:** Share findings with team members
3. **Issue Creation:** Create GitHub issue with:
   - Error messages and logs
   - Steps to reproduce
   - Local testing results
   - Attempted solutions

### Emergency Procedures

If CI is completely broken and blocking development:

1. **Immediate:** Skip CI checks temporarily via repository settings
2. **Communicate:** Notify team of CI bypass and expected fix timeline
3. **Fix:** Address root cause using this guide
4. **Restore:** Re-enable CI checks after validation
5. **Post-mortem:** Document issue and prevention measures

---

_Generated: 2025-09-14_ _Task: T024 - Create CI troubleshooting guide in
docs/ci-troubleshooting.md_
