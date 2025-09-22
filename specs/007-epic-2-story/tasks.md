# Tasks: Section Editor & WYSIWYG Capabilities

**Input**: Design documents from `/specs/007-epic-2-story/` **Prerequisites**:
plan.md (required), research.md, data-model.md, contracts/

## Phase 3.1: Setup

- [ ] T001 Align Milkdown deps with plan File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/package.json
      Outcome: Pin @milkdown/core@7.15.5, @milkdown/react, diff tooling per spec
- [ ] T002 [P] Expose section-editor scripts in web workspace File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/package.json
      Outcome: pnpm scripts for section-editor tests and storybook ready
- [ ] T003 [P] Seed shared section editor types File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/types/section-editor.ts
      Outcome: Define SectionEditorState, DraftMeta, DiffMeta shared across
      feature

## Phase 3.2: Tests First (TDD)

- [ ] T004 [P] Flesh out Section Editor contract tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/specs/007-epic-2-story/contracts/tests/section-editor.contract.test.ts
      Outcome: Five failing cases covering GET, drafts, diff, review, approve
- [ ] T005 [P] Add DocumentSection repository tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/**tests**/document-section.repository.test.ts
      Outcome: Failing specs for CRUD, optimistic locking, requestId propagation
- [ ] T006 [P] Add SectionDraft repository tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/**tests**/section-draft.repository.test.ts
      Outcome: Failing specs for versioning, autosave state, conflict markers
- [ ] T007 [P] Add ReviewSummary repository tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/**tests**/review-summary.repository.test.ts
      Outcome: Failing specs for approval notes, diff snapshot persistence
- [ ] T008 [P] Add diff service unit tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/**tests**/section-diff-service.test.ts
      Outcome: Failing specs for Markdown diffing and formatting metadata
- [ ] T009 [P] Add autosave workflow unit tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/**tests**/autosave-service.test.ts
      Outcome: Failing specs for debounce cadence, optimistic retry, logging
- [ ] T010 [P] Add review workflow unit tests File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/**tests**/review-workflow-service.test.ts
      Outcome: Failing specs for reviewer notes, status transitions,
      notifications
- [ ] T011 [P] Add edit-mode integration test (primary story) File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/integration/section-editor.edit-mode.test.tsx
      Outcome: Failing test covering read → edit toggle, toolbar state, autosave
      toast
- [ ] T012 [P] Add diff preview integration test (acceptance #2) File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/integration/section-editor.diff-view.test.tsx
      Outcome: Failing test asserting side-by-side diff + review prompt
- [ ] T013 [P] Add conflict handling integration test File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/integration/section-editor.conflict.test.tsx
      Outcome: Failing test for server 409 surfacing conflict banner + merge
      options
- [ ] T014 [P] Add Playwright primary flow scenario File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/e2e/section-editor.primary.story.ts
      Outcome: Failing e2e covering edit → autosave → review → approve path

## Phase 3.3: Core Implementation (after tests fail)

- [ ] T015 [P] Implement DocumentSection persistence model File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/models/document-section.ts
      Outcome: Schema + mapper aligned to data-model.md
- [ ] T016 [P] Implement SectionDraft persistence model File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/models/section-draft.ts
      Outcome: Schema + mapper with versioning and autosave fields
- [ ] T017 [P] Implement ReviewSummary persistence model File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/editor-persistence/src/models/review-summary.ts
      Outcome: Schema + mapper for reviewer notes and diff snapshot
- [ ] T018 [P] Build section diff service File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/section-diff-service.ts
      Outcome: Pure diff generator using persistence + Markdown formatting
- [ ] T019 [P] Build autosave workflow service File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/autosave-service.ts
      Outcome: Debounced save orchestration calling persistence + emitting
      events
- [ ] T020 [P] Build review workflow service File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/review-workflow-service.ts
      Outcome: Submit + approval orchestration with reviewer summary capture
- [ ] T021 [P] Implement GET /sections/{sectionId} File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/get-section.ts
      Outcome: Handler returning SectionView payload with drafts metadata
- [ ] T022 [P] Implement POST /sections/{sectionId}/drafts File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/save-draft.ts
      Outcome: Handler persisting drafts with optimistic locking + autosave flag
- [ ] T023 [P] Implement GET /sections/{sectionId}/diff File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/get-diff.ts
      Outcome: Handler emitting diff resource for UI
- [ ] T024 [P] Implement POST /sections/{sectionId}/review File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/submit-review.ts
      Outcome: Handler creating review requests + notifying reviewers
- [ ] T025 [P] Implement POST /sections/{sectionId}/approve File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/approve-section.ts
      Outcome: Handler promoting draft to approved content with audit fields
- [ ] T026 Wire section editor router into Express Files:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections/editor/router.ts,
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/routes/sections.ts
      Outcome: Compose middleware (auth, rate limit, logging) and mount
      endpoints
- [ ] T027 [P] Define request/response validators File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/validation/section-editor.schema.ts
      Outcome: Zod schemas consistent with OpenAPI + shared types
- [ ] T028 [P] Create section editor API client File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/services/section-editor-api.ts
      Outcome: Typed fetch helpers for TanStack Query
- [ ] T029 [P] Create TanStack Query hooks File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/api/use-section-editor-queries.ts
      Outcome: Query + mutation hooks with optimistic updates + error mapping
- [ ] T030 [P] Build SectionEditor component File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/components/section-editor.tsx
      Outcome: Milkdown-powered editor with toolbar + autosave signals
- [ ] T031 [P] Build SectionDiffPreview component File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/components/section-diff-preview.tsx
      Outcome: Split pane diff rendering approved vs draft Markdown
- [ ] T032 [P] Build SectionConflictBanner component File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/components/section-conflict-banner.tsx
      Outcome: Conflict resolution UI with merge/discard actions
- [ ] T033 [P] Build SectionReviewSidebar component File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/components/section-review-sidebar.tsx
      Outcome: Review summary capture + approve/request-changes controls

## Phase 3.4: Integration

- [ ] T034 Register section editor services in container File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/services/container.ts
      Outcome: Factory wiring for new repositories + workflow services
- [ ] T035 Add SQLite migrations for section editor tables File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/shared-data/migrations/2025-09-23-section-editor.sql
      Outcome: Tables + indexes for document_sections, section_drafts,
      review_summaries
- [ ] T036 Wire CLI entry for diff generation File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/cli/section-editor.ts
      Outcome: CLI commands for diff preview + review automation
- [ ] T037 Integrate SectionEditor into document view File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/document-editor/components/document-editor.tsx
      Outcome: Replace textarea stub with new component + workflow triggers
- [ ] T038 Implement section editor Zustand store File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/src/features/section-editor/stores/section-editor-store.ts
      Outcome: State for mode, autosave, pending review, diff selection
- [ ] T039 Ensure structured logging + request IDs on routes File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/api/src/middleware/request-logger.ts
      Outcome: Log draft/review events with requestId + user context

## Phase 3.5: Polish

- [ ] T040 [P] Add accessibility regression test File:
      /Users/danwas/Development/Projects/ctrl-freaq/apps/web/tests/integration/section-editor.accessibility.test.tsx
      Outcome: axe-core assertions for toolbar, diff view, review sidebar
- [ ] T041 [P] Capture performance metrics helpers File:
      /Users/danwas/Development/Projects/ctrl-freaq/packages/section-editor/src/services/performance-metrics.ts
      Outcome: Timing utilities guarding <200 ms interactions, autosave budget
- [ ] T042 [P] Update quickstart with new flows File:
      /Users/danwas/Development/Projects/ctrl-freaq/specs/007-epic-2-story/quickstart.md
      Outcome: Steps include new commands, review/approve verification
- [ ] T043 [P] Update architecture + UI docs with editor details Files:
      /Users/danwas/Development/Projects/ctrl-freaq/docs/architecture.md,
      /Users/danwas/Development/Projects/ctrl-freaq/docs/ui-architecture.md
      Outcome: Document endpoints, UI workflow, accessibility handling
- [ ] T044 Run quality gates before handoff Commands: pnpm lint && pnpm
      typecheck && pnpm test && pnpm test:contracts && pnpm build Outcome: All
      mandatory gates pass with new feature enabled

## Dependencies

- Setup (T001-T003) → Tests (T004-T014) → Models (T015-T017) → Services
  (T018-T020) → API handlers (T021-T027) → Frontend feature (T028-T033) →
  Integration (T034-T039) → Polish (T040-T044)
- T015-T017 block T018-T025
- T021-T025 block T026-T027 and backend logging (T039)
- T028 blocks T029; T029 blocks T030-T033
- T030-T033 block integration tasks T037-T038
- T034 depends on T015-T020; T036 depends on T018 and T026
- T037-T038 depend on T028-T033; T039 depends on T026 and T034
- T040-T043 require integration complete; T044 runs last

## Parallel Execution Examples

### Tests (after T003)

```bash
specify agents:task run --id T004
specify agents:task run --id T005
specify agents:task run --id T006
specify agents:task run --id T007
```

### Frontend build-out (after T029)

```bash
specify agents:task run --id T030
specify agents:task run --id T031
specify agents:task run --id T032
specify agents:task run --id T033
```

## Validation Checklist

- [ ] Contract file mapped to T004
- [ ] Entities mapped to T015-T017 implementation tasks
- [ ] Tests (T004-T014) precede implementation (T015+)
- [ ] [P] tasks touch independent files only
- [ ] Integration + polish reference specific absolute paths
