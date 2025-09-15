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
