# Agent Guidance — Document Editor Deep Links And Deterministic Fixtures

## Working Agreements

- Follow TDD: add or update Playwright specs (`apps/web/tests/e2e/**`) to fail
  before wiring new routes or fixtures.
- Touch only `apps/web` (frontend). Document any temptation to modify `apps/api`
  or packages that would violate the fixture-first strategy.
- Keep fixtures inside `apps/web/src/lib/fixtures/e2e/` and export typed helpers
  for reuse.
- Preserve existing authentication checks; rely on mock Clerk session utilities
  rather than bypassing guards.
- Update documentation (`quickstart.md`, repo README snippets if impacted) once
  behavior stabilizes.

## Implementation Focus

1. Extend `App.tsx` / router to accept
   `/documents/:documentId/sections/:sectionId` without redirect.
2. Inject an `E2EFixtureProvider` that swaps in when
   `import.meta.env.VITE_E2E === 'true'`.
3. Surface fixture-backed data in DocumentEditor while maintaining production
   API path as default.
4. Ensure error states redirect to dashboard with actionable messaging when
   fixtures missing.
5. Capture static AI transcripts inside fixtures for deterministic assertions.

## Guardrails

- Do not mutate Playwright config to skip specs; the goal is to make them green.
- Avoid storing secrets or environment-specific paths in fixtures.
- Coordinate fixture schema changes with `/templates/` canonical definitions and
  update `data-model.md` accordingly.
- Keep console logging minimal; prefer visible UI banners for fixture mode
  diagnostics.

## Deliverables Checklist

- Updated routes + providers committed with matching tests.
- Fixture modules covering all failing specs.
- Passing `pnpm --filter @ctrl-freaq/web test:e2e` run recorded in PR notes.
- Documentation refreshed (quickstart + any impacted guides).
