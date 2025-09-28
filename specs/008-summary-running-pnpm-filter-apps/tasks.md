# Tasks: Document Editor Deep Links And Deterministic Fixtures

**Input**: Design documents from `/specs/008-summary-running-pnpm-filter-apps/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup

- [✓] T001 Capture baseline failures by running
  `pnpm --filter @ctrl-freaq/web test:e2e` and archive screenshots in
  `/apps/web/test-results/` for reference before changes.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

- [✓] T002 [P] Add Playwright deep-link coverage in
  `/apps/web/tests/e2e/document-editor/deep-link.e2e.ts` asserting fixtures
  render table of contents, section preview, and edit affordances (expect fail
  until routing exists).
- [✓] T003 Extend `/apps/web/tests/e2e/document-editor.e2e.ts` to assert
  assumption conflict modal shows static transcript content and auth messaging
  under fixture mode (expect fail).
- [✓] T004 [P] Add Playwright regression
  `/apps/web/tests/e2e/document-editor/fixture-missing.e2e.ts` validating
  graceful error + dashboard link when fixture ids are absent (expect fail).
- [✓] T005 [P] Create Vitest contract test
  `/apps/web/src/lib/fixtures/e2e/__tests__/document-fixtures.contract.test.ts`
  validating fixture lookups against `contracts/document-fixtures.openapi.yaml`
  (expect fail until fixtures exist).

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [✓] T006 [P] Define TypeScript types and Zod validators for `DocumentFixture`,
  `SectionFixture`, and related entities in
  `/apps/web/src/lib/fixtures/e2e/types.ts` per `data-model.md`.
- [✓] T007 [P] Implement demo architecture fixture payloads (document, sections,
  assumption sessions, transcripts) in
  `/apps/web/src/lib/fixtures/e2e/demo-architecture.ts` referencing template
  schemas.
- [✓] T008 [P] Add fixture access helpers with 200/404 semantics and exports in
  `/apps/web/src/lib/fixtures/e2e/index.ts` to serve document + section queries.
- [✓] T009 Create `E2EFixtureProvider` in
  `/apps/web/src/lib/fixtures/e2e/fixture-provider.tsx` supplying context hooks
  for fixture data and console banner when enabled.
- [✓] T010 Update `/apps/web/src/lib/api-context.tsx` to branch on
  `import.meta.env.VITE_E2E === 'true'`, injecting the fixture provider while
  preserving production ApiProvider behavior and logging.
- [✓] T011 Build dedicated document route module
  `/apps/web/src/app/router/document-routes.tsx` that mounts the DocumentEditor
  for `/documents/:documentId/sections/:sectionId`, including loaders that
  consume fixture helpers and error boundaries.
- [✓] T012 Update `/apps/web/src/App.tsx` to register the new document routes,
  ensure SignedIn flow mounts them, and maintain wildcard redirect fallback.
- [✓] T013 Implement fixture-backed query logic in
  `/apps/web/src/features/document-editor/hooks/use-sections-query.ts`, swapping
  to fixture helpers when `VITE_E2E` is true and retaining API calls otherwise.
- [✓] T014 Update table of contents and section preview components
  (`/apps/web/src/features/document-editor/components/table-of-contents.tsx` and
  `document-section-preview.tsx`) to consume fixture data, display lifecycle
  badges, and handle loading states without API calls.
- [✓] T015 Sync assumption conflict UI and stores
  (`/apps/web/src/features/document-editor/components/section-card.tsx` plus
  `/apps/web/src/features/document-editor/stores/document-store.ts`) to display
  static transcripts, unresolved counts, and policy chips from fixtures.

## Phase 3.4: Integration

- [✓] T016 Update `/apps/web/vite.config.ts` to expose `VITE_E2E` defaults and
  alias `/__fixtures` routes to the fixture helper module without impacting
  production builds.
- [✓] T017 Configure `/apps/web/playwright.config.ts` to set `VITE_E2E=true` for
  dev server launches and ensure test command uses the fixture-aware base URL.
- [✓] T018 Implement reusable missing-fixture error view in
  `/apps/web/src/components/document-missing.tsx` and wire it into document
  routing fallback messaging.

## Phase 3.5: Polish & Quality Gates

- [✓] T019 [P] Update
  `/specs/008-summary-running-pnpm-filter-apps/quickstart.md` and repository
  README segment describing E2E mode so instructions match final behavior.
- [✓] T020 [P] Document fixture governance and deep-link behavior in
  `/docs/front-end-spec.md` (and reference `/docs/architecture.md` if schema
  notes change).
- [ ] T021 Run `pnpm lint`, `pnpm test`, and
      `pnpm --filter @ctrl-freaq/web test:e2e` to confirm all suites pass and
      attach results to PR notes.
- [ ] T022 [P] Capture updated Playwright screenshots/artifacts demonstrating
      document editor loaded via deep link and attach to change log or PR
      description.

## Dependencies

- T002, T003, T004, T005 must complete (and fail) before starting any task in
  Phase 3.3.
- T006 precedes T007 and T008 (shared type definitions).
- T008 feeds T009–T013 (fixture helpers consumed by providers and hooks).
- T011 must complete before T012 integrates routes.
- T013–T015 rely on T008/T009 outputs.
- T016 and T017 depend on core implementation pieces to define fixture modules.
- T019–T022 execute only after integration tasks succeed.

## Assumption Log

- [ASSUMPTION] Baseline Playwright command
  (`pnpm --filter @ctrl-freaq/web test:e2e`) now executes the authored `.e2e.ts`
  specs and is expected to fail against missing fixtures until Phase 3.3
  completes; the earlier “No tests found” state is resolved by T016/T017.
- [ASSUMPTION] Fixture lifecycle state `ready` maps to DocumentStore status
  `published` so existing document badges render without introducing a new
  status tier.
- [ASSUMPTION] T005 contract test lives at
  `/apps/web/src/lib/fixtures/e2e/document-fixtures.contract.test.ts` instead of
  an `__tests__` directory to comply with the constitution’s colocation rule
  while preserving task intent.
- [ASSUMPTION] The interim fixture request handler added for T016 returns a 501
  JSON stub until actual fixtures arrive; this keeps the middleware wiring
  testable without faking successful payloads ahead of Phase 3.3 work.
- [ASSUMPTION] Playwright `testMatch` now targets `*.e2e.ts(x)` so Phase 3.2
  specs execute across every browser profile; failures are expected until
  fixtures and routes land in later tasks.

## Parallel Execution Example

```
# After completing T001 and before implementation, run parallel test authoring:
Task.run("T002")  # Add deep-link Playwright spec
Task.run("T004")  # Add missing-fixture Playwright spec
Task.run("T005")  # Add Vitest contract test for fixtures

# Post-type definition, create fixtures in parallel:
Task.run("T007")  # Implement demo architecture fixtures
Task.run("T008")  # Add fixture access helpers
```

## Notes

- Maintain TDD discipline: do not implement fixture logic until
  Playwright/Vitest tasks are failing.
- Respect library-first boundaries—fixture helpers belong to
  `/apps/web/src/lib/fixtures/e2e/` and must expose CLI-equivalent usage via
  pnpm scripts if extended.
- Preserve structured logging and security messaging per `CONSTITUTION.md` when
  wiring fixture provider and routes.
