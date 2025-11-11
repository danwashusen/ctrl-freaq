# Tasks: Surface Document Editor

**Input**: Design documents from `/specs/015-surface-document-editor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create shared project/document snapshot types in
      `packages/shared-data/src/types/project-document.ts`
- [x] T002 Export new project/document snapshot types from
      `packages/shared-data/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 Add repository helper to fetch primary document metadata and first
      section in `packages/shared-data/src/models/document.ts`
- [x] T004 [P] Introduce project-document serializer utilities in
      `apps/api/src/routes/serializers/project-document.serializer.ts`
- [x] T005 Update DI container registrations for document
      discovery/provision/export services in
      `apps/api/src/services/container.ts`
- [x] T006 Refresh fixture data to keep live/fixture bootstrap parity in
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

- [x] T007 [US1] Add contract test for
      `GET /projects/:projectId/documents/primary` at
      `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`
- [x] T008 [US1] Add Playwright flow for Project→Document navigation at
      `apps/web/tests/e2e/project-open-document.e2e.ts`

### Implementation

- [x] T009 [US1] Implement `GET /projects/:projectId/documents/primary` route
      using serializer in `apps/api/src/routes/documents.ts`
- [x] T010 [P] [US1] Extend API client with `getPrimaryDocument` helper in
      `apps/web/src/lib/api.ts`
- [x] T011 [P] [US1] Update template store loading to consume primary document
      metadata in `apps/web/src/stores/template-store.ts`
- [x] T012 [US1] Rework Project workflow card logic (retain clickable card
      pattern, add status states) in `apps/web/src/pages/Project.tsx`
- [x] T013 [US1] Replace document route loader to fetch live data (fallback to
      fixtures when flagged) in `apps/web/src/app/router/document-routes.tsx`
- [x] T014 [US1] Introduce `useDocumentBootstrap` hook for live
      sections/metadata in
      `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`
- [x] T015 [US1] Integrate bootstrap hook and loading/not-found guards in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [x] T016 [US1] Implement breadcrumb/back navigation from the editor to the
      originating project in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [x] T017 [P] [US1] Sync document store initialization with live bootstrap
      payloads in
      `apps/web/src/features/document-editor/stores/document-store.ts`
- [x] T018 [P] [US1] Keep fixture bootstrap compatibility by delegating to
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

- [x] T019 [US2] Add contract test for `POST /projects/:projectId/documents` at
      `apps/api/tests/contract/documents/project-create-document.contract.test.ts`
- [x] T020 [US2] Add Project page create-document interaction test at
      `apps/web/src/pages/__tests__/Project.create-document.test.tsx`

### Implementation

- [x] T021 [US2] Implement idempotent `POST /projects/:projectId/documents`
      route logic in `apps/api/src/routes/documents.ts`
- [x] T022 [US2] Create document provisioning service that seeds template
      defaults in `apps/api/src/services/document-provisioning.service.ts`
- [x] T023 [US2] Register provisioning service and dependencies in
      `apps/api/src/services/container.ts`
- [x] T024 [US2] Add `useCreateDocument` hook to orchestrate provisioning calls
      in `apps/web/src/features/document-editor/hooks/use-create-document.ts`
- [x] T025 [US2] Wire Create Document workflow card with loading/error states in
      `apps/web/src/pages/Project.tsx`
- [x] T026 [US2] Guard template store navigation until provisioning completes in
      `apps/web/src/stores/template-store.ts`
- [x] T027 [US2] Add create-document API client helper to
      `apps/web/src/lib/api.ts`

**Checkpoint**: User Stories 1 & 2 both work independently.

---

## Phase 5: User Story 3 – Collaborate and validate within the document editor (Priority: P3)

**Goal**: Enable full editing, conflict resolution, co-authoring, QA, and export
workflows on the live document. **Independent Test**: In the editor, perform
manual saves with conflict resolution guidance, run co-authoring and QA flows
tied to the live document, and trigger a project export with feedback.

### Tests (write first, ensure failing)

- [x] T028 [US3] Add Playwright scenario covering manual save conflict
      resolution at `apps/web/tests/e2e/document-conflict.e2e.ts`
- [x] T029 [US3] Add contract test for `POST /projects/:projectId/export` at
      `apps/api/tests/contract/projects/export-project.contract.test.ts`
- [x] T030 [US3] Add unit coverage for co-author cancel/retry/resume behaviours
      at
      `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.ts`
- [x] T031 [US3] Add Playwright coverage for QA sidebar interruption and retry
      handling at `apps/web/tests/e2e/document-qa-sidebar.e2e.ts`
- [x] T032 [US3] Add contract test for document assumptions flow scoping at
      `apps/api/tests/contract/documents/assumptions-flow.contract.test.ts`

### Implementation

- [x] T033 [US3] Update manual save panel copy and state messaging in
      `apps/web/src/features/section-editor/components/manual-save-panel.tsx`
- [x] T034 [US3] Wire manual save flow to `section-editor.client` optimistic
      operations in
      `apps/web/src/features/section-editor/api/section-editor.client.ts`
- [x] T035 [US3] Align conflict dialog with refresh/diff/reapply guidance in
      `apps/web/src/features/document-editor/components/conflict-dialog.tsx`
- [x] T036 [US3] Extend DocumentEditor interactions to manage conflict retry and
      saved-state banners in
      `apps/web/src/features/document-editor/components/document-editor.tsx`
- [x] T037 [US3] Route co-authoring sessions with live document/section
      identifiers in
      `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts`
- [x] T038 [US3] Route document QA sessions with live identifiers and fallback
      handling in
      `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts`
- [x] T039 [US3] Hook DocumentQualityDashboard re-run actions to live endpoints
      in
      `apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx`
- [x] T040 [US3] Connect assumptions flow hook to live project/document
      identifiers in
      `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts`
- [x] T041 [US3] Implement `POST /projects/:projectId/export` handling (queue
      job, respond with status) in `apps/api/src/routes/projects.ts`
- [x] T042 [US3] Create export orchestration service integrating
      `@ctrl-freaq/exporter` in
      `apps/api/src/services/export/document-export.service.ts`
- [x] T043 [US3] Register export orchestration service within
      `apps/api/src/services/container.ts`
- [x] T044 [US3] Add export workflow handling (progress, feedback) to
      `apps/web/src/pages/Project.tsx`
- [x] T045 [US3] Implement template validation decision endpoint for Project
      workflow actions in `apps/api/src/routes/templates.ts`
- [x] T046 [US3] Persist template validation decisions via repository/service
      updates in `packages/shared-data/src/models/template-decision.ts`
- [x] T047 [US3] Add contract test for template decision submission at
      `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts`
- [x] T048 [US3] Invoke template decision endpoint from `TemplateValidationGate`
      submission flow in `apps/web/src/pages/Project.tsx`

**Checkpoint**: All user stories functional and independently verifiable.

#### Assumption Log

- [ASSUMPTION] T048: Template decision submissions default to
  `action: 'approved'` when the document already matches the requested template
  version; handling explicit `pending` or `blocked` selections remains future
  scope.
- [ASSUMPTION] F019: The "View troubleshooting guide" CTA points to
  `https://docs.ctrl-freaq.dev/surface-document-editor/provisioning-troubleshooting`
  because no canonical support URL exists in the repo, and the spec mandates a
  link.

---

## Phase 6: Polish & Cross-Cutting

- [x] T049 Update architectural and UI specs with new endpoints and flows in
      `docs/architecture.md` and `docs/front-end-spec.md`
- [x] T050 Capture updated validation steps in
      `specs/015-surface-document-editor/quickstart.md`
- [x] T051 Run quickstart validation flows end-to-end following
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

## Implementation Log

- 2025-11-11T20:21:39Z — F022: Restored approval panel gating so reviewers can
  approve drafting sections and the gauntlet regains access to the Section
  Approval UI.
  - Files:
    `apps/web/src/features/document-editor/components/document-editor.tsx`,
    `apps/web/src/features/document-editor/components/approval-panel-gate.tsx`,
    `apps/web/src/features/document-editor/components/approval-panel-gate.test.tsx`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands:
    `pnpm --filter @ctrl-freaq/web test -- src/features/document-editor/components/approval-panel-gate.test.tsx`
  - Tests:
    `pnpm --filter @ctrl-freaq/web test -- src/features/document-editor/components/approval-panel-gate.test.tsx`
  - Follow-ups: None.

- 2025-11-09T00:20:00Z — F022: Reseeded section-editor fixtures with
  project-scoped UUID metadata so the new project-ownership guards in the
  section routes keep returning 200/403 as expected instead of 500s.
  - Files: `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`,
    `apps/api/tests/contract/section-editor/section-editor.contract.test.ts`,
    `apps/api/tests/contract/co-authoring/{analyze,apply,proposal}.contract.test.ts`,
    `apps/api/tests/contract/quality-gates/{sections,traceability}.contract.test.ts`,
    `apps/api/tests/integration/events/section-draft.stream.test.ts`.
  - Commands: `CI=1 pnpm install`, `pnpm format`, `pnpm lint:fix`,
    `pnpm typecheck`, `pnpm build`, `pnpm test`.
  - Tests: `pnpm test` (first run exposed invalid project-id formats; reran
    successfully after aligning every fixture with deterministic UUID IDs).
  - Follow-ups: None.

- 2025-11-08T21:25:46Z — F021: Cleared the Create Document stepper guard to
  align with its narrowed union so the repository typecheck can complete.
  - Files: `apps/web/src/pages/Project.tsx`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands: `pnpm format`, `pnpm lint:fix`, `pnpm lint`, `pnpm typecheck`
  - Tests: `pnpm lint`, `pnpm typecheck`
  - Follow-ups: None.

- 2025-11-08T00:16:05Z — F020: Hardened section routes against nullable access
  responses so `tsc` stops flagging `section` references as possibly `null`.
  - Files: `apps/api/src/routes/sections.ts`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands: `pnpm typecheck` (fails in `apps/web/src/pages/Project.tsx:1897`
    due to existing status narrowing issue),
    `pnpm --filter @ctrl-freaq/api typecheck`
  - Tests: `tsc --noEmit` via `pnpm --filter @ctrl-freaq/api typecheck`
  - Follow-ups: Repo-wide `pnpm typecheck` still blocked by the Project page
    status union mismatch; address lint scope finding F021 when governance
    change is approved.

- 2025-11-07T21:34:55Z — F018/F019: Locked section and assumption routes behind
  project authorization and added the spec-required provisioning stepper plus
  failure banner on the Project create-document workflow.
  - Files: `apps/api/src/routes/sections.ts`,
    `apps/api/src/testing/fixtures/section-editor.ts`,
    `apps/api/tests/contract/section-editor/section-editor.contract.test.ts`,
    `apps/web/src/pages/Project.tsx`,
    `apps/web/src/pages/__tests__/Project.create-document.test.tsx`,
    `apps/web/tests/e2e/project-open-document.e2e.ts`,
    `specs/015-surface-document-editor/tasks.md`.
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- tests/contract/section-editor/section-editor.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- src/pages/__tests__/Project.create-document.test.tsx`,
    `pnpm --filter @ctrl-freaq/web test:e2e:quick -- tests/e2e/project-open-document.e2e.ts`.
  - Tests: Section editor contract suite (API), Project create-document Vitest
    specs (web), and the Playwright fixture flow covering create-document error
    handling.
  - Follow-ups: None.

- 2025-11-07T09:14:27Z — F015–F017: Added the export artifact download CTA,
  spec-compliant document-missing recovery actions, and project-document-scoped
  template decision lookups.
  - Files: `.eslintignore`, `apps/web/src/pages/Project.tsx`,
    `apps/web/src/pages/Project.test.tsx`,
    `apps/web/src/components/document-missing.tsx`,
    `apps/web/src/components/document-missing.test.tsx`,
    `apps/web/src/app/router/document-routes.tsx`,
    `apps/web/src/app/router/document-routes.test.ts`,
    `apps/api/src/services/document-workflows/project-document-discovery.service.ts`,
    `apps/api/tests/unit/services/document-workflows/project-document-discovery.service.test.ts`,
    `apps/api/tests/contract/documents/project-primary-document.contract.test.ts`,
    `specs/015-surface-document-editor/tasks.md`.
  - Commands:
    `pnpm --filter @ctrl-freaq/web test -- src/pages/Project.test.tsx src/components/document-missing.test.tsx src/app/router/document-routes.test.ts`,
    `pnpm --filter @ctrl-freaq/api test -- tests/unit/services/document-workflows/project-document-discovery.service.test.ts tests/contract/documents/project-primary-document.contract.test.ts`.
  - Tests: Verified updated Vitest suites for Project workflow UI,
    DocumentMissing, router loader, the discovery service unit coverage, and the
    primary document contract test.
  - Follow-ups: None.

- 2025-11-07T08:08:27Z — F013/F014: Guarded document detail route with project
  auth and migrated assumptions flow to document-scoped APIs/UI.
  - Files: `apps/api/src/routes/documents.ts`,
    `apps/api/src/routes/sections.ts`,
    `apps/api/tests/contract/documents/document-detail.contract.test.ts`,
    `apps/web/src/features/document-editor/services/assumptions-api.ts`,
    `apps/web/src/features/document-editor/assumptions-flow/**`,
    `apps/web/tests/**/*assumptions*.test.ts`.
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- tests/contract/documents/document-detail.contract.test.ts tests/contract/documents/assumptions-flow.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.test.tsx tests/integration/document-editor/assumptions-resume.test.ts tests/performance/assumptions-timing.performance.test.ts tests/unit/services/assumptions-api.service.test.ts`.
  - Tests: API contract suites for document detail + assumptions scoping; web
    Vitest coverage for assumptions hook, integration resume flow, performance
    harness, and API client.
  - Follow-ups: None.

- 2025-11-07T01:50:30Z — F009–F012: locked down project-scoped APIs, hardened
  document provisioning, queued export jobs asynchronously with polling, and
  taught the template locator to read dist assets.
  - Files: `apps/api/src/routes/helpers/project-access.ts`,
    `apps/api/src/routes/documents.ts`, `apps/api/src/routes/projects.ts`,
    `apps/api/src/routes/templates.ts`,
    `apps/api/src/services/document-provisioning.service.ts`,
    `packages/shared-data/src/repositories/section-repository.ts`,
    `apps/api/src/services/export/document-export.service.ts`,
    `apps/api/src/services/templates/template-path-resolver.ts`,
    `apps/web/src/lib/api.ts`, `apps/web/src/pages/Project.tsx`,
    `apps/web/src/pages/Project.test.tsx`, affected contract/unit tests.
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- project-primary-document.contract.test.ts project-create-document.contract.test.ts projects/export-project.contract.test.ts templates/template-validation-decision.contract.test.ts document-provisioning.service.test.ts template-path-resolver.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- Project.test.tsx`
  - Tests: API contract suites for project documents, exports, and template
    decisions; provisioning/template resolver unit tests; Project page Vitest
    coverage.
  - Follow-ups: None.

- 2025-11-06T23:56:30Z — F006–F008: Restored provisioning template lookup in
  dist builds, honored Create Document overrides (title/template/seed strategy),
  and wired export jobs to produce completed artifacts.
  - Files: `apps/api/src/services/document-provisioning.service.ts`,
    `apps/api/src/services/export/document-export.service.ts`,
    `apps/api/src/services/templates/template-path-resolver.ts`,
    `apps/api/src/routes/documents.ts`,
    `apps/api/tests/contract/documents/project-create-document.contract.test.ts`,
    `apps/api/tests/contract/projects/export-project.contract.test.ts`,
    `apps/api/tests/unit/services/document-provisioning.service.test.ts`,
    `templates/architecture-minimal.yaml`, `.eslintignore`
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- document-provisioning.service.test.ts`,
    `pnpm --filter @ctrl-freaq/api test -- project-create-document.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/api test -- export-project.contract.test.ts`
  - Tests: Provisioning env override unit test; Create Document and Export
    contract suites (Vitest)
  - Follow-ups: None

- 2025-11-06T18:52:41Z — F005: Ensured provisioning templates ship with API
  builds and added coverage.
  - Files: `apps/api/package.json`, `apps/api/scripts/copy-template-assets.mjs`,
    `apps/api/tests/unit/scripts/copy-template-assets.test.ts`,
    `apps/api/tests/types/copy-template-assets.d.ts`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands: `pnpm --filter @ctrl-freaq/api build`,
    `pnpm --filter @ctrl-freaq/api test -- copy-template-assets.test.ts`,
    `pnpm --filter @ctrl-freaq/api test -- project-create-document.contract.test.ts`
  - Tests: Copy-template-assets unit suite (Vitest); project create-document
    contract suite (Vitest)
  - Follow-ups: Monitor turbo pipeline hooks to confirm asset copy runs in CI;
    extend packaging script if new template catalogs need selective shipping.

- 2025-11-06T18:42:26Z — F004: Restored document loader auth integration and
  coverage.
  - Files: `apps/web/src/app/router/document-routes.tsx`,
    `apps/web/src/lib/auth-provider/loader-auth.ts`, `apps/web/src/lib/api.ts`,
    `apps/web/src/app/router/document-routes.test.ts`
  - Commands: `pnpm --filter @ctrl-freaq/web test -- document-routes.test.ts`
  - Tests: Document route loader unit suite (Vitest)
  - Follow-ups: Monitor Clerk token availability during navigation; add
    integration coverage once live auth flows are available in the test harness.

- 2025-11-06T06:56:33Z — F001/F002/F003: Added exporter dependency/build step,
  corrected export route error payloads/DB lookup, restored document bootstrap
  fallback, and reintroduced link-wrapped workflow card semantics with new
  coverage.
  - Files: `apps/api/package.json`, `apps/api/src/routes/projects.ts`,
    `apps/api/tests/contract/projects/export-project.contract.test.ts`,
    `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`,
    `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`,
    `apps/web/src/pages/Project.tsx`, `apps/web/src/pages/Project.test.tsx`
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- export-project.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- use-document-bootstrap.test.tsx`,
    `pnpm --filter @ctrl-freaq/web test -- Project.test.tsx`,
    `pnpm --filter @ctrl-freaq/api lint`, `pnpm --filter @ctrl-freaq/web lint`
  - Tests: Export route contract suite; document bootstrap hook and Project page
    Vitest suites
  - Follow-ups: Audit remaining project routes for consistent `code`/`error`
    fields before freezing API responses.

- 2025-11-06T05:26:30Z — T044–T051: Extended Project workflow card states,
  persisted template validation decisions, and refreshed docs/quickstart.
  - Files: `apps/web/src/pages/Project.tsx`, `apps/web/src/lib/api.ts`,
    `apps/web/src/pages/__tests__/Project.template-validation.test.tsx`,
    `apps/api/src/routes/templates.ts`,
    `apps/api/tests/contract/templates/template-validation-decision.contract.test.ts`,
    `packages/shared-data/src/repositories/template-decision.repository.ts`,
    `packages/shared-data/src/models/template-decision.ts`,
    `docs/architecture.md`, `docs/front-end-spec.md`,
    `specs/015-surface-document-editor/quickstart.md`
  - Commands: `pnpm --filter @ctrl-freaq/web test -- Project.test.tsx`,
    `pnpm --filter @ctrl-freaq/web test -- Project.template-validation.test.tsx`,
    `pnpm --filter @ctrl-freaq/api test -- template-validation-decision.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/shared-data test -- template-decision.repository.test.ts`
  - Follow-ups: Consider support for `pending`/`blocked` decision flows and
    richer export progress updates during future iterations.

- 2025-11-06T04:56:10+00:00 — T028–T043: Completed conflict workflows, streaming
  integrations, and export service/contract coverage.
  - Files: `apps/web/tests/e2e/document-conflict.e2e.ts`,
    `apps/api/tests/contract/projects/export-project.contract.test.ts`,
    `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts`,
    `apps/api/src/services/export/document-export.service.ts`,
    `specs/015-surface-document-editor/tasks.md`
  - Follow-ups: Implement export workflow card UI (T044) and template decision
    endpoints (T045–T048) before polish tasks.

- 2025-11-05T07:14:18Z — T019/T020/T021–T027: Revalidated provisioning contracts
  and surfaced success copy on the Project create-document workflow. Confirmed
  backend idempotency and frontend state transitions.
  - Files: `apps/web/src/pages/Project.tsx`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- project-create-document.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- Project.create-document.test.tsx`
  - Tests: Create-document API contract suite; Project create-document
    interaction test (Vitest)
  - Follow-ups: Monitor provisioning hint timing as Playwright coverage (T028)
    comes online to ensure success banner persists long enough for accessibility
    cues.
- 2025-11-05T05:45:12Z — QA/Playwright stabilization: Added full fixture
  responses for template summary/version and document bootstrap in the project
  open flow; relaxed editor title assertion to match live heading and reran the
  gauntlet (`pnpm test` now green).
- 2025-11-05T02:32:14Z — T010–T018: Wired live bootstrap across loader, hook,
  stores, and editor UI; added deterministic tests and updated fixtures
  compatibility.
  - Files: `apps/web/src/app/router/document-routes.tsx`,
    `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`,
    `apps/web/src/features/document-editor/hooks/use-document-fixture.ts`,
    `apps/web/src/features/document-editor/components/document-editor.tsx`,
    `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands:
    `pnpm --filter @ctrl-freaq/web test -- use-document-bootstrap.test.tsx`,
    `pnpm --filter @ctrl-freaq/web test -- template-store.test.ts`
  - Tests: Document bootstrap hook unit suite; template store regression suite
  - Follow-ups: Playwright project-open flow remains blocked in sandbox; rerun
    locally once browser permissions available.
- 2025-11-05T01:15:52Z — T004/T005/T006: Introduced project document serializer,
  registered discovery/provision/export services, and refreshed fixture snapshot
  parity.
  - Files: `apps/api/src/routes/serializers/project-document.serializer.ts`,
    `apps/api/src/services/container.ts`,
    `apps/api/src/services/document-workflows/project-document-discovery.service.ts`,
    `apps/api/tests/unit/routes/project-document.serializer.test.ts`,
    `apps/api/tests/unit/services/container/document-workflows-registration.test.ts`,
    `apps/web/src/lib/fixtures/e2e/index.ts`,
    `apps/web/src/lib/fixtures/e2e/project-document.fixture.contract.test.ts`
  - Commands:
    `pnpm --filter @ctrl-freaq/api test -- project-document.serializer.test.ts`,
    `pnpm --filter @ctrl-freaq/web test -- project-document.fixture.contract.test.ts`,
    `pnpm --filter @ctrl-freaq/api lint`,
    `pnpm --filter @ctrl-freaq/api typecheck`,
    `pnpm --filter @ctrl-freaq/web lint`,
    `pnpm --filter @ctrl-freaq/web typecheck`
  - Tests: API serializer and container registration unit suites; web fixture
    contract test (vitest)
  - Follow-ups: Implement provisioning/export services before enabling POST
    routes; update frontend bootstrap to consume live snapshot in US1.

- 2025-11-05T00:41:53Z — T003: Added repository helper to build primary project
  document snapshots with lifecycle derivation and section lookup.
  - Files: `packages/shared-data/src/models/document.ts`,
    `packages/shared-data/src/types/project-document.ts`,
    `packages/shared-data/src/repositories/document.repository.test.ts`
  - Commands:
    `pnpm --filter @ctrl-freaq/shared-data test -- document.repository.test.ts`
  - Tests: Document repository suite (vitest) verifying snapshot states and
    archival handling
  - Follow-ups: Wire serializer (T004) and API route (T009) to consume snapshot
    helper and propagate template decisions when available.

- 2025-11-05T00:33:20Z — T001/T002: Added shared project-document snapshot
  schemas and exports for backend/frontend usage.
  - Files: `packages/shared-data/src/types/project-document.ts`,
    `packages/shared-data/src/index.ts`,
    `specs/015-surface-document-editor/tasks.md`
  - Commands: none
  - Tests: not run (schema-only change; will validate alongside upcoming
    repository/helper wiring)
  - Follow-ups: Use snapshot types in T003 repository helper and API serializers
    before implementing routes.

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: API lacks dependency on `@ctrl-freaq/exporter` as
      described in audit.md
- [x] F002 Finding F002: Document bootstrap fails to fall back when the
      requested section is missing as described in audit.md
- [x] F003 Finding F003: Workflow card must restore link-wrapped accessibility
      semantics as described in audit.md
- [x] F004 Finding F004: Document route loader bypasses API client auth as
      described in audit.md
- [x] F005 Finding F005: Document provisioning template asset missing from
      builds as described in audit.md
- [x] F006 Finding F006: Production provisioning still fails from dist builds as
      described in audit.md
- [x] F007 Finding F007: Export workflow never produces artifacts as described
      in audit.md
- [x] F008 Finding F008: Create Document API ignores contract overrides as
      described in audit.md
- [x] F009 Finding F009: Project-scoped document/export endpoints skip
      authorization as described in audit.md
- [x] F010 Finding F010: Document provisioning is not atomic as described in
      audit.md
- [x] F011 Finding F011: Export jobs run synchronously so UI never sees queued
      states as described in audit.md
- [x] F012 Finding F012: Template locator ignores dist templates as described in
      audit.md
- [x] F013 Finding F013: Document detail route lacks project authorization as
      described in audit.md
- [x] F014 Finding F014: Assumptions flow still uses unscoped section endpoints
      as described in audit.md
- [x] F015 Finding F015: Export workflow never surfaces a downloadable artifact
      in Project.tsx as described in audit.md
- [x] F016 Finding F016: Document missing screen lacks the spec-required “Return
      to project”/“Provision new document” actions as described in audit.md
- [x] F017 Finding F017: Template decision snapshot reuses project-level history
      rather than the active document’s decisions as described in audit.md
- [x] F018 Finding F018: Section routes bypass project authorization as
      described in audit.md
- [x] F019 Finding F019: Create-document workflow lacks the spec-mandated
      provisioning stepper and failure UX as described in audit.md
- [x] F020 Finding F020: TypeScript build fails in section routes as described
      in audit.md
- [x] F021 Finding F021: Create-document stepper state check keeps typecheck red
      as described in audit.md
- [x] F022 Finding F022: Section approval panel hidden so pnpm test fails as
      described in audit.md
