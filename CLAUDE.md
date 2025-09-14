---
# CI/CD Configuration
- **CI Platform**: GitHub Actions
- **Workflows**: `.github/workflows/ci.yml`, `.github/workflows/pr-validation.yml`
- **Key Commands**:
  - `pnpm lint` - Run linting across monorepo
  - `pnpm typecheck` - TypeScript validation
  - `pnpm build` - Build all packages
  - `pnpm test` - Run test suites
- **Debug CI**: Check Actions tab, run commands locally, see specs/003-1-2-ci/quickstart.md

---
@AGENTS.md