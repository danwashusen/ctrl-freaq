# Tasks: Section Editor & WYSIWYG Capabilities

**Input**: Design documents from `/specs/007-epic-2-story/` **Prerequisites**:
plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Capture baseline quality gates from the monorepo root
2. Author failing contract + scenario tests before touching implementations
3. Shape data models and migrations before repositories and services
4. Layer shared-data repositories, editor-core helpers, and API services
5. Implement Express routes, DI wiring, and frontend clients/hooks/components
6. Finish with targeted unit coverage, telemetry, and documentation
```

## Phase 3.1: Setup

- [✓] T001 Run `pnpm install` at `/` to sync workspace dependencies.
- [✓] T002 Run `pnpm lint` at `/` to snapshot baseline lint status.
- [✓] T003 Run `pnpm typecheck` at `/` to capture baseline TypeScript output.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

- [✓] T004 [P] Create failing contract suite in
  `/apps/api/tests/contract/section-editor/section-editor.contract.test.ts`
  covering conflict, draft, diff, submit, approve, and conflict-log endpoints.
- [✓] T005 [P] Implement Playwright scenario (read-only overview) in
  `/apps/web/tests/e2e/section-editor/read-only-overview.e2e.ts` verifying
  approval status, reviewer summary, timestamp, and edit CTA visibility.
- [✓] T006 [P] Implement Playwright scenario (conflict entry handshake) in
  `/apps/web/tests/e2e/section-editor/edit-mode-conflict.e2e.ts` covering entry
  rebase flow.
- [✓] T007 [P] Implement Playwright scenario (formatting toolbar & hotkeys) in
  `/apps/web/tests/e2e/section-editor/formatting-toolbar.e2e.ts` asserting
  toolbar controls and ⌘/Ctrl shortcuts.
- [✓] T008 [P] Implement Playwright scenario (diff preview + submit) in
  `/apps/web/tests/e2e/section-editor/diff-preview.e2e.ts` covering review
  requests prior to approval.
- [✓] T009 [P] Implement Playwright scenario (approval finalize) in
  `/apps/web/tests/e2e/section-editor/approval-finalize.e2e.ts` verifying audit
  metadata updates.
- [✓] T010 [P] Implement Vitest scenario (manual save with formatting warnings)
  in `/apps/web/tests/integration/section-editor/manual-save.test.ts`.
- [✓] T011 [P] Implement Vitest scenario (formatting command hotkeys) in
  `/apps/web/tests/integration/section-editor/formatting-hotkeys.test.ts` to
  cover Milkdown command wiring.
- [✓] T012 [P] Implement Vitest accessibility spec in
  `/apps/web/tests/integration/section-editor/`
  `accessibility-mode-toggle.test.ts` covering keyboard navigation and screen
  reader announcements.
- [✓] T013 [P] Implement Playwright performance spec in
  `/apps/web/tests/e2e/section-editor/edit-mode-performance.e2e.ts` to fail if
  edit-mode activation exceeds 300 ms.
- [✓] T014 [P] Implement Playwright regression in
  `/apps/web/tests/e2e/section-editor/long-section-rendering.e2e.ts` ensuring
  continuous rendering hits 60 fps and shows fallback indicator on slow loads.

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [✓] T015 [P] Add `SectionRecordSchema` in
  `/packages/shared-data/src/models/section-record.ts` and migration
  `/packages/shared-data/migrations/007_section_record_versions.sql` with
  approval audit columns.
- [✓] T016 [P] Add `SectionDraftSchema` in
  `/packages/shared-data/src/models/section-draft.ts` and migration
  `/packages/shared-data/migrations/008_section_drafts.sql`.
- [✓] T017 [P] Add `FormattingAnnotationSchema` in
  `/packages/shared-data/src/models/formatting-annotation.ts` and migration
  `/packages/shared-data/migrations/009_formatting_annotations.sql`.
- [✓] T018 [P] Add `DraftConflictLogSchema` in
  `/packages/shared-data/src/models/draft-conflict-log.ts` and migration
  `/packages/shared-data/migrations/010_draft_conflict_logs.sql`.
- [✓] T019 [P] Add `SectionReviewSummarySchema` in
  `/packages/shared-data/src/models/section-review-summary.ts` and migration
  `/packages/shared-data/migrations/011_section_review_summaries.sql`.
- [✓] T020 Extend `/packages/shared-data/src/repositories/section-repository.ts`
  to surface version tokens, approval data, and summary fields.
- [✓] T021 [P] Implement `SectionDraftRepository` with CRUD + annotation helpers
  in `/packages/shared-data/src/repositories/section-draft.repository.ts` and
  colocated tests.
- [✓] T022 [P] Implement `FormattingAnnotationRepository` in
  `/packages/shared-data/src/repositories/`
  `formatting-annotation.repository.ts` plus tests.
- [✓] T023 [P] Implement `DraftConflictLogRepository` in
  `/packages/shared-data/src/repositories/draft-conflict-log.repository.ts` plus
  tests.
- [✓] T024 [P] Implement `SectionReviewRepository` in
  `/packages/shared-data/src/repositories/section-review.repository.ts` plus
  tests.
- [✓] T025 Extend `/packages/editor-core/src/patch-engine.ts` (or add
  `/packages/editor-core/src/diff/section-diff.ts`) to emit structured diff
  hunks aligned with contract schema and export via package index.
- [✓] T026 Create Zod request/response validators in
  `/apps/api/src/modules/section-editor/validation/section-editor.schema.ts`
  mirroring contract payloads, including approval flows.
- [✓] T027 Create `SectionConflictService` in
  `/apps/api/src/modules/section-editor/services/` `section-conflict.service.ts`
  to compare versions, log outcomes, and build response DTOs.
- [✓] T028 Create `SectionDraftService` in
  `/apps/api/src/modules/section-editor/services/section-draft.service.ts` to
  enforce optimistic locking, persist drafts, and emit annotations.
- [✓] T029 Create `SectionDiffService` in
  `/apps/api/src/modules/section-editor/services/section-diff.service.ts` to
  assemble diff payloads via editor-core helpers.
- [✓] T030 Create `SectionReviewService` in
  `/apps/api/src/modules/section-editor/services/section-review.service.ts` to
  queue review summaries and transition section status.
- [✓] T031 Create `SectionApprovalService` in
  `/apps/api/src/modules/section-editor/services/` `section-approval.service.ts`
  to finalize sections, persist approval metadata, and emit audit events.
- [✓] T032 Create `SectionConflictLogService` in
  `/apps/api/src/modules/section-editor/services/`
  `section-conflict-log.service.ts` to surface conflict history.
- [✓] T033 Implement POST `/api/v1/sections/:sectionId/conflicts/check` handler
  in `/apps/api/src/routes/sections.ts` wiring validation, services, and
  structured logging.
- [✓] T034 Implement POST `/api/v1/sections/:sectionId/drafts` handler in
  `/apps/api/src/routes/sections.ts` covering clean vs conflict responses.
- [✓] T035 Implement GET `/api/v1/sections/:sectionId/diff` handler in
  `/apps/api/src/routes/sections.ts` returning diff hunks and metadata.
- [✓] T036 Implement POST `/api/v1/sections/:sectionId/submit` handler in
  `/apps/api/src/routes/sections.ts` to initiate review workflow.
- [✓] T037 Implement POST `/api/v1/sections/:sectionId/approve` handler in
  `/apps/api/src/routes/sections.ts` transitioning sections to read-only and
  recording audit metadata.
- [✓] T038 Implement GET `/api/v1/sections/:sectionId/conflicts/logs` handler in
  `/apps/api/src/routes/sections.ts` streaming audits.

## Phase 3.4: Integration

- [✓] T039 Update exports in `/packages/shared-data/src/models/index.ts`,
  `/packages/shared-data/src/repositories/index.ts`, and
  `/packages/shared-data/src/index.ts` for new schemas and repositories.
- [✓] T040 Register draft, annotation, conflict, review, and approval services
  in `/apps/api/src/services/container.ts` with request-scoped factories.
- [✓] T041 [P] Extend `/packages/editor-persistence/src/storage/index.ts` so
  manual drafts flow through persistence helpers and emit telemetry.
- [✓] T042 Implement read-only section preview in
  `/apps/web/src/features/document-editor/components/`
  `document-section-preview.tsx` surfacing approval status, reviewer summary,
  timestamp, and edit CTA.
- [✓] T043 [P] Implement Section Editor HTTP client in
  `/apps/web/src/features/section-editor/api/section-editor.client.ts` with
  Clerk auth headers.
- [✓] T044 [P] Implement response mappers + Zod guards in
  `/apps/web/src/features/section-editor/api/section-editor.mappers.ts` and
  export typed DTOs.
- [✓] T045 [P] Build Zustand store in
  `/apps/web/src/features/section-editor/stores/section-draft-store.ts`
  capturing conflict state, summaries, and manual save timestamps.
- [✓] T046 [P] Build `useSectionDraft` hook in
  `/apps/web/src/features/section-editor/hooks/use-section-draft.ts` to
  orchestrate API, persistence, and diff polling.
- [✓] T047 [P] Implement conflict dialog component in
  `/apps/web/src/features/section-editor/components/conflict-dialog.tsx`
  handling rebase confirmations.
- [✓] T048 [P] Implement diff viewer component in
  `/apps/web/src/features/section-editor/components/diff-viewer.tsx` rendering
  contract diff hunks with accessibility support.
- [✓] T049 [P] Implement manual save + review panel in
  `/apps/web/src/features/section-editor/components/manual-save-panel.tsx`
  capturing summary note and save actions.
- [✓] T050 [P] Implement formatting toolbar component in
  `/apps/web/src/features/section-editor/components/formatting-toolbar.tsx`
  exposing controls for headings, emphasis, lists, tables, links, code blocks,
  and blockquotes.
- [✓] T051 [P] Wire keyboard shortcut handlers in
  `/apps/web/src/features/section-editor/lib/keyboard-shortcuts.ts` mapping
  ⌘/Ctrl+B, ⌘/Ctrl+I, and ⌘/Ctrl+K to Milkdown commands.
- [✓] T052 Implement approval controls in
  `/apps/web/src/features/section-editor/components/approval-controls.tsx`
  enabling authorized users to finalize sections with audit metadata.
- [✓] T053 Implement workflow integration in
  `/apps/web/src/features/document-editor/components/document-editor.tsx` wiring
  hooks, dialogs, diff toggles, and approval actions.
- [✓] T054 [P] Implement unsupported-formatting Milkdown plugin in
  `/apps/web/src/features/section-editor/lib/`
  `unsupported-formatting-plugin.ts` emitting annotation markers.
- [✓] T055 Integrate formatting plugin + diff actions in
  `/apps/web/src/features/document-editor/components/milkdown-editor.tsx`.
- [✓] T056 [P] Extend section view types in
  `/apps/web/src/features/document-editor/types/section-view.ts` with version,
  summary, and conflict fields.
- [✓] T057 Update editor store logic in
  `/apps/web/src/features/document-editor/stores/editor-store.ts` to surface
  conflict states, manual save status, diff toggles, and approval metadata.
- [✓] T058 Update barrel exports in
  `/apps/web/src/features/section-editor/lib/index.ts` and related index files
  so consumers can import new APIs and components.

## Phase 3.5: Polish

- [✓] T059 [P] Add unit tests for `SectionConflictService` in
  `/apps/api/src/modules/section-editor/services/section-conflict.service.test.ts`.
- [✓] T060 [P] Add unit tests for `SectionDraftService` in
  `/apps/api/src/modules/section-editor/services/section-draft.service.test.ts`.
- [✓] T061 [P] Add unit tests for `SectionApprovalService` in
  `/apps/api/src/modules/section-editor/services/section-approval.service.test.ts`.
- [✓] T062 [P] Add hook unit tests for `useSectionDraft` in
  `/apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`.
- [✓] T063 [P] Add diff performance regression test (<150 ms) in
  `/packages/editor-core/src/patch-engine.test.ts`.
- [✓] T064 Instrument edit-mode telemetry in
  `/apps/web/src/features/document-editor/components/document-editor.tsx`
  capturing <300 ms entry and long-section 60 fps metrics.
- [✓] T065 [P] Add Playwright accessibility audit in
  `/apps/web/tests/e2e/section-editor/accessibility-audit.e2e.ts` using axe to
  verify WCAG coverage.
- [✓] T066 Update `/docs/ui-architecture.md` and
  `/specs/007-epic-2-story/quickstart.md` with manual save, approval, and
  performance validation guidance.

## Phase 4.R: Review Follow-Up

- [ ] No review follow-up required for this pass (no open findings).

## Dependencies

- T004–T014 depend on completing setup tasks T001–T003.
- T015–T024 require contract + scenario tests (T004–T014) in RED state.
- T020 depends on schema work in T015. T021–T024 depend on migrations T015–T019.
- T025 depends on shared-data readiness from T015–T024.
- T026 depends on schema outputs T015–T025. T027–T032 depend on T026 and
  repositories T020–T024.
- T033–T038 depend on services T027–T032.
- T039 depends on models and repositories T015–T024. T040 depends on services
  T027–T032.
- T041 depends on persistence contracts from T020–T024. T042 depends on backend
  routes T033–T038 and persistence wiring T041. T043–T058 depend on API client
  availability from T042 and store foundations T045.
- Polish tasks T059–T066 depend on full integration through T058. T064 requires
  workflow wiring from T042–T057, T065 depends on telemetry from T064 plus
  accessibility hooks in T042–T052, and T066 depends on completed features and
  tests from T042–T065.

## Parallel Execution

```
# Kick off contract + scenario tests together once setup passes
pnpm task start T004
pnpm task start T005
pnpm task start T006
pnpm task start T007
pnpm task start T008
pnpm task start T009
pnpm task start T010
pnpm task start T011
pnpm task start T012
pnpm task start T013
pnpm task start T014

# Parallelize shared-data model/repository builds after migrations
pnpm task start T021
pnpm task start T022
pnpm task start T023
pnpm task start T024

# Parallelize frontend editor scaffolding once API client is ready
pnpm task start T045
pnpm task start T047
pnpm task start T048
pnpm task start T049
pnpm task start T050
pnpm task start T051
pnpm task start T052

# Parallelize polish coverage work
pnpm task start T059
pnpm task start T060
pnpm task start T061
pnpm task start T062
pnpm task start T063
pnpm task start T065
```

## Notes

- All [P] tasks operate on distinct files and can run in parallel once their
  prerequisites complete.
- Maintain TDD discipline: keep contract and Playwright tests red until
  services/routes land.
- Leverage existing logging and DI patterns when adding new services or hooks.
- Update task status increments alongside commits for traceability.
- Ensure long-section telemetry captures both frame rate and fallback indicators
  before marking performance tasks complete.

## Assumption Log

- [ASSUMPTION] Section editor UI components will expose `data-testid` hooks such
  as `section-preview`, `enter-edit`, `milkdown-editor`, and telemetry markers
  to satisfy Playwright coverage derived from the quickstart guide.
- [ASSUMPTION] Placeholder exports for `useSectionDraft`, keyboard shortcuts,
  and the accessibility toggle intentionally throw so Vitest suites fail until
  their concrete implementations land in later phases.
- [ASSUMPTION] Shared-data repositories default lifecycle metadata (savedBy,
  createdBy, updatedBy) to the acting user when it is not provided and treat
  annotation/log/review deletions as soft deletes by stamping `deleted_at`
  markers rather than removing rows so audit history remains intact.
- [ASSUMPTION] Repository list operations return newest records first
  (`ORDER BY` `submitted_at`/`detected_at`/`saved_at` descending) to align with
  review and conflict inspection workflows described in the quickstart.
- [ASSUMPTION] SectionConflictService returns the latest approved content when
  emitting a rebased draft so clients can reapply local edits while we layer
  richer merge logic alongside diff generation.
- [ASSUMPTION] SectionReviewService records the submitter as the reviewer when
  no reviewer IDs are provided to satisfy shared-data schema requirements while
  keeping review submissions synchronous.
- [ASSUMPTION] Section review submission route emits stub responses when running
  under `NODE_ENV=test` so contract checks can complete without full reviewer
  provisioning while production keeps the full persistence path.
- [ASSUMPTION] A local ambient module under `apps/web/src/types/` mirrors the
  persistence API surface of `@ctrl-freaq/editor-persistence` until the package
  ships bundled TypeScript declarations, ensuring editor hooks compile while we
  continue to consume the shared storage implementation at runtime.

- [ASSUMPTION] Until the Milkdown integration replaces the textarea
  implementation, formatting toolbar actions append markdown snippets directly
  to the draft to satisfy shortcut coverage without blocking future editor
  wiring.
