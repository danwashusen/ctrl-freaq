# Tasks: Surface Document Editor

**Input**: Design documents from `/specs/015-surface-document-editor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Create shared project/document snapshot types in
      `packages/shared-data/src/types/project-document.ts`
- [ ] T002 Export new project/document snapshot types from
      `packages/shared-data/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Add repository helper to fetch primary document metadata and first
      section in `packages/shared-data/src/models/document.ts`
- [ ] T004 [P] Introduce project-document serializer utilities in
      `apps/api/src/routes/serializers/project-document.serializer.ts`
- [ ] T005 Update DI container registrations for document
      discovery/provision/export services in
      `apps/api/src/services/container.ts`
- [ ] T006 Refresh fixture data to keep live/fixture bootstrap parity in
      `apps/web/src/lib/fixtures/e2e/index.ts`

**Checkpoint**: Foundation ready — user story work can begin.

---

## Phase 3: User Story 1 – Resume architecture document from Project view (Priority: P1) 🎯 MVP

**Goal**: Launch the document editor with live project data when a primary
document already exists. **Independent Test**: From a project with a primary
document, activate the workflow card and reach
`/documents/:documentId/sections/:sectionId` showing live sections and metadata
without relying on fixtures.

### Tests (write first, ensure failing)

- [ ] T007 [US1] Add contract test for
      `GET /projects/:projectId/documents/primary` at
      `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`
- [ ] T008 [US1] Add Playwright flow for Project→Document navigation at
      `apps/web/tests/e2e/project-open-document.e2e.ts`

### Implementation

- [ ] T009 [US1] Implement `GET /projects/:projectId/documents/primary` route
      using serializer in `apps/api/src/routes/documents.ts`
- [ ] T010 [P] [US1] Extend API client with `getPrimaryDocument` helper in
      `apps/web/src/lib/api.ts`
- [ ] T011 [P] [US1] Update template store loading to consume primary document
      metadata in `apps/web/src/stores/template-store.ts`
- [ ] T012 [US1] Rework Project workflow card logic (retain clickable card
      pattern, add status states) in `apps/web/src/pages/Project.tsx`
- [ ] T013 [US1] Replace document route loader to fetch live data (fallback to
      fixtures when flagged) in `apps/web/src/app/router/document-routes.tsx`
- [ ] T014 [US1] Introduce `useDocumentBootstrap` hook for live
      sections/metadata in
      `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`
- [ ] T015 [US1] Integrate bootstrap hook and loading/not-found guards in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [ ] T016 [US1] Implement breadcrumb/back navigation from the editor to the
      originating project in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [ ] T017 [P] [US1] Sync document store initialization with live bootstrap
      payloads in
      `apps/web/src/features/document-editor/stores/document-store.ts`
- [ ] T018 [P] [US1] Keep fixture bootstrap compatibility by delegating to
      `useDocumentBootstrap` within
      `apps/web/src/features/document-editor/hooks/use-document-fixture.ts`

**Checkpoint**: User Story 1 is independently testable.

---

## Phase 4: User Story 2 – Provision a document when none exists (Priority: P2)

**Goal**: Allow maintainers to create the first document from the Project page
and land inside the editor automatically. **Independent Test**: From a project
without a document, trigger creation, observe progress/error messaging, and
navigate to the first section of the newly created document.

### Tests (write first, ensure failing)

- [ ] T019 [US2] Add contract test for `POST /projects/:projectId/documents` at
      `apps/api/tests/contract/documents/project-create-document.contract.test.ts`
- [ ] T020 [US2] Add Project page create-document interaction test at
      `apps/web/src/pages/__tests__/Project.create-document.test.tsx`

### Implementation

- [ ] T021 [US2] Implement idempotent `POST /projects/:projectId/documents`
      route logic in `apps/api/src/routes/documents.ts`
- [ ] T022 [US2] Create document provisioning service that seeds template
      defaults in `apps/api/src/services/document-provisioning.service.ts`
- [ ] T023 [US2] Register provisioning service and dependencies in
      `apps/api/src/services/container.ts`
- [ ] T024 [US2] Add `useCreateDocument` hook to orchestrate provisioning calls
      in `apps/web/src/features/document-editor/hooks/use-create-document.ts`
- [ ] T025 [US2] Wire Create Document workflow card with loading/error states in
      `apps/web/src/pages/Project.tsx`
- [ ] T026 [US2] Guard template store navigation until provisioning completes in
      `apps/web/src/stores/template-store.ts`
- [ ] T027 [US2] Add create-document API client helper to
      `apps/web/src/lib/api.ts`

**Checkpoint**: User Stories 1 & 2 both work independently.

---

## Phase 5: User Story 3 – Collaborate and validate within the document editor (Priority: P3)

**Goal**: Enable full editing, conflict resolution, co-authoring, QA, and export
workflows on the live document. **Independent Test**: In the editor, perform
manual saves with conflict resolution guidance, run co-authoring and QA flows
tied to the live document, and trigger a project export with feedback.

### Tests (write first, ensure failing)

- [ ] T028 [US3] Add Playwright scenario covering manual save conflict
      resolution at `apps/web/tests/e2e/document-conflict.e2e.ts`
- [ ] T029 [US3] Add contract test for `POST /projects/:projectId/export` at
      `apps/api/tests/contract/projects/export-project.contract.test.ts`
- [ ] T030 [US3] Add unit coverage for co-author cancel/retry/resume behaviours
      at
      `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.ts`
- [ ] T031 [US3] Add Playwright coverage for QA sidebar interruption and retry
      handling at `apps/web/tests/e2e/document-qa-sidebar.e2e.ts`
- [ ] T032 [US3] Add contract test for document assumptions flow scoping at
      `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts`

### Implementation

- [ ] T033 [US3] Update manual save panel copy and state messaging in
      `apps/web/src/features/section-editor/components/manual-save-panel.tsx`
- [ ] T034 [US3] Wire manual save flow to `section-editor.client` optimistic
      operations in
      `apps/web/src/features/section-editor/api/section-editor.client.ts`
- [ ] T035 [US3] Align conflict dialog with refresh/diff/reapply guidance in
      `apps/web/src/features/document-editor/components/conflict-dialog.tsx`
- [ ] T036 [US3] Extend DocumentEditor interactions to manage conflict retry and
      saved-state banners in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [ ] T037 [US3] Route co-authoring sessions with live document/section
      identifiers in
      `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts`
- [ ] T038 [US3] Route document QA sessions with live identifiers and fallback
      handling in
      `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts`
- [ ] T039 [US3] Hook DocumentQualityDashboard re-run actions to live endpoints
      in
      `apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx`
- [ ] T040 [US3] Connect assumptions flow hook to live project/document
      identifiers in
      `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`
- [ ] T041 [US3] Implement `POST /projects/:projectId/export` handling (queue
      job, respond with status) in `apps/api/src/routes/projects.ts`
- [ ] T042 [US3] Create export orchestration service integrating
      `@ctrl-freaq/exporter` in
      `apps/api/src/services/export/document-export.service.ts`
- [ ] T043 [US3] Register export orchestration service within
      `apps/api/src/services/container.ts`
- [ ] T044 [US3] Add export workflow handling (progress, feedback) to
      `apps/web/src/pages/Project.tsx`
- [ ] T045 [US3] Implement template validation decision endpoint for Project
      workflow actions in `apps/api/src/routes/templates.ts`
- [ ] T046 [US3] Persist template validation decisions via repository/service
      updates in `packages/shared-data/src/models/template-decision.ts`
- [ ] T047 [US3] Add contract test for template decision submission at
      `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts`
- [ ] T048 [US3] Invoke template decision endpoint from `TemplateValidationGate`
      submission flow in `apps/web/src/pages/Project.tsx`

**Checkpoint**: All user stories functional and independently verifiable.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T049 Update architectural and UI specs with new endpoints and flows in
      `docs/architecture.md` and `docs/front-end-spec.md`
- [ ] T050 Capture updated validation steps in
      `specs/015-surface-document-editor/quickstart.md`
- [ ] T051 Run quickstart validation flows end-to-end following
      `specs/015-surface-document-editor/quickstart.md`

---

## Dependencies & Execution Order

- **Phase Dependencies**: Setup → Foundational → User Stories (P1 → P2 → P3) →
  Polish.
- **Story Dependencies**: US1 unlocks MVP; US2 and US3 depend on foundational
  infrastructure but can proceed after US1 if desired. US3 builds on exports and
  conflict flows introduced earlier.
- **Task Dependencies**: Within each story, contract/UI tests (T007/T008,
  T019/T020, T028–T032) must be authored before implementation tasks. Tasks
  touching `apps/web/src/pages/Project.tsx` should follow earlier modifications
  sequentially (US1 → US2 → US3).

## Parallel Execution Examples

- After T009 completes, T010 and T011 can proceed in parallel on separate files.
- Within US2, once T021 is in progress, T024 and T027 can be tackled in parallel
  by different contributors.
- Within US3, T037–T040 modify distinct hooks/components and can be split across
  team members once T036 lands.

## Implementation Strategy

- **MVP (US1)**: Deliver live project→document navigation; validate via
  T007–T018 before branching into additional work.
- **Incremental Delivery**: Layer US2 provisioning flow next, then US3
  collaboration/QA/export enhancements. Each story maintains independent
  validation via its test tasks and checkpoints.
- **Quality Gates**: Honor constitutional requirements—tests precede
  implementation, and final validation (T051) ensures quickstart scenarios stay
  green.
