---
# Dashboard & Authenticated Layout
- **Feature**: Two-column layout with sidebar navigation and dashboard view
- **Components**:
  - Sidebar: Projects list sorted alphabetically, user profile placeholder
  - Dashboard: Project List (left) and Recent Activity (right) columns
  - Protected routes wrapping all authenticated views
- **State Management**:
  - Zustand: Client state (active project, sidebar state)
  - TanStack Query: Server state with caching
- **API Endpoints**:
  - `GET /api/v1/projects` - User's projects list
  - `GET /api/v1/dashboard` - Aggregated dashboard data
  - `GET /api/v1/activities` - Recent activities (empty for MVP)
  - `POST /api/v1/projects/:id/select` - Select active project
- **Quick Verify**: See specs/004-1-4-authenticated/quickstart.md

## Pointers (004-1-4-authenticated)
- Backend
  - Request ID + logging: `apps/api/src/middleware/request-id.ts`, `apps/api/src/core/logging.ts`
  - Error handling (standard shapes): `apps/api/src/middleware/error-handler.ts`
  - Service Locator + repos: `apps/api/src/core/service-locator.ts`, `apps/api/src/services/container.ts`
  - Routes: `apps/api/src/routes/{projects.ts,dashboard.ts,activities.ts,projects.select.ts}`
  - Tests avoid `app.listen`: supertest against `createApp()`
- Frontend
  - ApiClient public methods: `apps/web/src/lib/api.ts` (`listProjects`, `getDashboard`, `listActivities`)
  - Services: `apps/web/src/lib/api/services/*`
  - Store: `apps/web/src/stores/project-store.ts`
  - Lazy routes: `apps/web/src/App.tsx` (React.lazy + Suspense)
  - Removed prod alias for `zustand`; test-only mock in `apps/web/tests/setup.ts`
- Tests
  - API contract: `apps/api/tests/contract/*` (request-id and error-handler assertions added)
  - Repo unit tests: `packages/shared-data/src/repositories/project.repository.test.ts`
  - Web unit/integration: `apps/web/src/components/common/__tests__/Avatar.test.tsx`, existing integration tests

---

# Authentication Configuration (Clerk)

- **Provider**: Clerk (clerk.com) for JWT-based authentication
- **Frontend**: @clerk/clerk-react with React Router v6 protected routes
- **Backend**: @clerk/clerk-sdk-node with Service Locator middleware
- **Environment Variables**:
  - `VITE_CLERK_PUBLISHABLE_KEY` - Frontend public key
  - `CLERK_SECRET_KEY` - Backend secret key
- **Key Files**:
  - `apps/web/src/app/router/protected-route.tsx` - Route protection
  - `apps/api/src/middleware/auth.ts` - JWT validation
  - `packages/shared-data/src/repositories/UserRepository.ts` - User persistence
- **Test Users**: Configure in Clerk dashboard for E2E testing
- **Quick Verify**: See specs/004-1-3-authentication/quickstart.md

---

# CI/CD Configuration

- **CI Platform**: GitHub Actions
- **Workflows**: `.github/workflows/ci.yml`,
  `.github/workflows/pr-validation.yml`
- **Key Commands**:
  - `pnpm lint` - Run linting across monorepo
  - `pnpm typecheck` - TypeScript validation
  - `pnpm build` - Build all packages
  - `pnpm test` - Run test suites
- **Debug CI**: Check Actions tab, run commands locally, see
  specs/003-1-2-ci/quickstart.md

---

@AGENTS.md
