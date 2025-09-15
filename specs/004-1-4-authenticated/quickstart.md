# Quickstart: Authenticated App Layout + Dashboard

**Feature**: Authenticated App Layout + Dashboard **Branch**:
`004-1-4-authenticated` **Date**: 2025-09-15

## Prerequisites

1. **Environment Setup**:

   ```bash
   # Ensure you're on the correct branch
   git checkout 004-1-4-authenticated

   # Install dependencies
   pnpm install

   # Set up environment variables
   cp .env.example .env.local
   # Add your Clerk keys to .env.local:
   # VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   # CLERK_SECRET_KEY=sk_test_...
   ```

2. **Database Setup**:

   ```bash
   # Run migrations (if any new ones)
   pnpm --filter @ctrl-freaq/shared-data migrate

   # Seed test data (optional)
   pnpm --filter @ctrl-freaq/shared-data seed
   ```

## Running the Feature

### Start Development Servers

```bash
# Start both frontend and backend
pnpm dev

# Or start separately:
pnpm dev:web    # Frontend on http://localhost:5173
pnpm dev:api    # Backend on http://localhost:5001
```

### Test User Accounts

For testing, use Clerk's test mode or create test accounts:

- Email: `test@example.com`
- Password: `TestPassword123!`

## Feature Validation Checklist

### 1. Authentication Flow

- [ ] Navigate to http://localhost:5173
- [ ] Verify redirect to sign-in if not authenticated
- [ ] Sign in with test credentials
- [ ] Verify redirect to dashboard after successful auth
- [ ] Check JWT token in network requests

### 2. Dashboard Layout

- [ ] Verify two-column layout is displayed
- [ ] Check sidebar is visible on left
- [ ] Check main content area on right
- [ ] Verify responsive behavior (resize browser)

### 3. Sidebar Navigation

- [ ] Verify "Projects" section is visible
- [ ] Check projects are listed alphabetically
- [ ] Verify each project shows:
  - [ ] Project name
  - [ ] Project is clickable
- [ ] Test project selection updates UI state

### 4. Dashboard Content

- [ ] Verify h1 heading shows "Dashboard"
- [ ] Check two-column layout in main area:
  - [ ] Project List (left column)
  - [ ] Recent Activity (right column)

### 5. Project List Component

- [ ] Verify all user projects are displayed
- [ ] Check each project card shows:
  - [ ] Project name
  - [ ] Project summary/description
  - [ ] Member avatar(s)
  - [ ] Last modified shows "N/A" (MVP)
- [ ] Test empty state when no projects exist

### 6. Recent Activity Component

- [ ] Verify "No recent activity yet" message (MVP)
- [ ] Check empty state styling is appropriate

### 7. API Endpoints

```bash
# Test with curl (replace TOKEN with actual JWT)
TOKEN="your_jwt_token_here"

# List projects
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5173/api/v1/projects

# Get dashboard data
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5173/api/v1/dashboard

# Get activities (empty for MVP)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5173/api/v1/activities

# Select a project
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:5173/api/v1/projects/{projectId}/select
```

### 8. Error States

- [ ] Test with invalid/expired JWT token (401 error)
- [ ] Test selecting non-existent project (404 error)
- [ ] Test selecting unauthorized project (403 error)
- [ ] Verify error messages are user-friendly

### 9. Performance

- [ ] Dashboard loads within 2 seconds
- [ ] No visible layout shift during load
- [ ] Smooth transitions when selecting projects

### 10. Accessibility

- [ ] Tab through all interactive elements
- [ ] Verify focus indicators are visible
- [ ] Test with screen reader (optional)
- [ ] Check contrast ratios meet WCAG AA

## Running Tests

### Contract & Integration Tests

```bash
# API tests (contract + integration)
pnpm --filter @ctrl-freaq/api test

# Web tests (integration + unit)
pnpm --filter @ctrl-freaq/web test

# Watch mode (web)
pnpm --filter @ctrl-freaq/web test:watch
```

### E2E Tests

```bash
# Run Playwright E2E tests
pnpm test:e2e dashboard

# Run with UI mode for debugging
pnpm test:e2e -- --ui

# Update visual snapshots
pnpm test:e2e -- --update-snapshots
```

## Debugging

### Frontend Debugging

1. Open React DevTools
2. Check Zustand store state
3. Monitor Network tab for API calls
4. Check Console for Pino logs

### Backend Debugging

```bash
# View backend logs
pnpm dev:api

# Check structured logs (with jq)
pnpm dev:api 2>&1 | jq '.'

# Filter by request ID
  pnpm dev:api 2>&1 | jq 'select(.requestId=="...")'
```

## Performance Analysis (Dashboard Route)

```bash
# Build the web app
pnpm --filter @ctrl-freaq/web build

# Check bundle budgets
pnpm --filter @ctrl-freaq/web check:bundle
```

Expected: budgets OK; pages are lazy-loaded (Dashboard, Project, Settings loaded
on demand).

### Common Issues

1. **401 Unauthorized**:
   - Check Clerk keys in .env.local
   - Verify JWT token is being sent
   - Check token expiration

2. **No projects showing**:
   - Verify database has test data
   - Check user ID matches project owner
   - Look for errors in API response

3. **Layout issues**:
   - Clear browser cache
   - Check for CSS conflicts
   - Verify Tailwind classes are applied

## Success Criteria

The feature is considered complete when:

1. ✅ All acceptance scenarios from spec pass
2. ✅ Contract tests pass (after implementation)
3. ✅ Integration tests pass
4. ✅ E2E tests pass
5. ✅ No console errors in browser
6. ✅ Performance targets met (<2s load)
7. ✅ Accessibility checks pass
8. ✅ Code review approved
9. ✅ Documentation updated

## Next Steps

After validation:

1. Run `pnpm lint` and fix any issues
2. Run `pnpm typecheck` to ensure type safety
3. Update CHANGELOG.md with feature details
4. Create PR to merge into main branch

---

_This quickstart guide validates the implementation of the Authenticated App
Layout + Dashboard feature_
