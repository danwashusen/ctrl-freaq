# Tasks: Document Editor Core Infrastructure

**Input**: Design documents from `/specs/006-story-2-2/` **Prerequisites**:
plan.md (required), research.md, data-model.md, contracts/sections-api.yaml

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Tech stack: TypeScript, React, Express.js, Milkdown, Zustand
   → Structure: Web application (frontend + backend)
2. Load design documents:
   → data-model.md: SectionView, PendingChange, EditorSession, TableOfContents
   → contracts/sections-api.yaml: 7 endpoints for section management
   → research.md: Technology decisions and patterns
3. Generate tasks by category:
   → Setup: TypeScript configs, dependencies
   → Tests: Contract tests for all API endpoints
   → Core: Data models, repositories, state stores
   → UI: React components with Milkdown integration
   → Integration: API routes, persistence
   → Polish: Performance tests, E2E scenarios
4. Apply task rules:
   → Different packages/files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T040)
6. Validate completeness
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Backend API**: `apps/api/src/`
- **Frontend**: `apps/web/src/`
- **Shared packages**: `packages/*/src/`
- **Tests**: `*/tests/` directories

## Phase 3.1: Setup

- [ ] T001 Configure TypeScript project references for editor packages
- [ ] T002 Install Milkdown 7.15.5 and dependencies in editor-core package
- [ ] T003 [P] Setup diff-match-patch in editor-core package
- [ ] T004 [P] Configure localforage in editor-persistence package
- [ ] T005 [P] Setup Zustand devtools middleware in web app

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### Contract Tests

- [ ] T006 [P] Contract test GET /documents/{docId}/sections in
      apps/api/tests/contract/sections-get.test.ts
- [ ] T007 [P] Contract test GET /sections/{sectionId} in
      apps/api/tests/contract/section-get.test.ts
- [ ] T008 [P] Contract test PATCH /sections/{sectionId} state update in
      apps/api/tests/contract/section-state.test.ts
- [ ] T009 [P] Contract test GET /sections/{sectionId}/pending-changes in
      apps/api/tests/contract/pending-get.test.ts
- [ ] T010 [P] Contract test POST /sections/{sectionId}/pending-changes in
      apps/api/tests/contract/pending-create.test.ts
- [ ] T011 [P] Contract test POST /sections/{sectionId}/save in
      apps/api/tests/contract/section-save.test.ts
- [ ] T012 [P] Contract test GET /documents/{docId}/toc in
      apps/api/tests/contract/toc-get.test.ts
- [ ] T013 [P] Contract test GET /documents/{docId}/editor-session in
      apps/api/tests/contract/session-get.test.ts
- [ ] T014 [P] Contract test PUT /documents/{docId}/editor-session in
      apps/api/tests/contract/session-update.test.ts

### Integration Tests

- [ ] T015 [P] ToC navigation scenario test in
      apps/web/tests/e2e/toc-navigation.test.ts
- [ ] T016 [P] Section mode transitions test in
      apps/web/tests/integration/section-modes.test.ts
- [ ] T017 [P] Placeholder content test in
      apps/web/tests/e2e/placeholder-content.test.ts
- [ ] T018 [P] Patch generation test in
      packages/editor-core/tests/patch-engine.test.ts
- [ ] T019 [P] Performance validation tests in
      apps/web/tests/performance/editor-performance.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Layer

- [ ] T020 [P] Create SectionView TypeScript interface and Zod schema in
      packages/shared-data/src/models/section-view.ts
- [ ] T021 [P] Create PendingChange interface and schema in
      packages/shared-data/src/models/pending-change.ts
- [ ] T022 [P] Create EditorSession interface and schema in
      packages/shared-data/src/models/editor-session.ts
- [ ] T023 [P] Create TableOfContents interface and schema in
      packages/shared-data/src/models/table-of-contents.ts
- [ ] T024 [P] Implement SectionRepository methods in
      packages/shared-data/src/repositories/section-repository.ts
- [ ] T025 [P] Implement PendingChangeRepository in
      packages/shared-data/src/repositories/pending-change-repository.ts

### State Management

- [ ] T026 [P] Create editor-store.ts with Zustand in
      apps/web/src/features/document-editor/stores/editor-store.ts
- [ ] T027 [P] Create pending-changes-store.ts in
      apps/web/src/features/document-editor/stores/pending-changes-store.ts
- [ ] T028 [P] Create toc-store.ts in
      apps/web/src/features/document-editor/stores/toc-store.ts
- [ ] T029 [P] Implement patch engine in
      packages/editor-core/src/patch-engine.ts
- [ ] T030 [P] Create persistence layer in
      packages/editor-persistence/src/change-storage.ts

### API Routes

- [ ] T031 Implement GET /documents/{docId}/sections endpoint in
      apps/api/src/routes/sections.ts
- [ ] T032 Implement PATCH /sections/{sectionId} state update in
      apps/api/src/routes/sections.ts
- [ ] T033 Implement POST /sections/{sectionId}/pending-changes in
      apps/api/src/routes/pending-changes.ts
- [ ] T034 Implement POST /sections/{sectionId}/save endpoint in
      apps/api/src/routes/sections.ts
- [ ] T035 Implement GET /documents/{docId}/toc endpoint in
      apps/api/src/routes/navigation.ts
- [ ] T036 Implement editor session endpoints in apps/api/src/routes/sessions.ts

### UI Components

- [ ] T037 Create TableOfContents component in
      apps/web/src/features/document-editor/components/table-of-contents.tsx
- [ ] T038 Create SectionView component in
      apps/web/src/features/document-editor/components/section-view.tsx
- [ ] T039 Create MilkdownEditor wrapper in
      apps/web/src/features/document-editor/components/milkdown-editor.tsx
- [ ] T040 Create DiffPreview component in
      apps/web/src/features/document-editor/components/diff-preview.tsx
- [ ] T041 Integrate components into DocumentEditor in
      apps/web/src/features/document-editor/document-editor.tsx

## Phase 3.4: Integration

- [ ] T042 Connect SectionRepository to SQLite database
- [ ] T043 Wire up API routes with repositories and services
- [ ] T044 Integrate Milkdown with patch generation
- [ ] T045 Connect UI components to Zustand stores
- [ ] T046 Implement SSE streaming for real-time updates
- [ ] T047 Add Clerk JWT validation to section endpoints

## Phase 3.5: Polish

- [ ] T048 [P] Unit tests for patch engine in packages/editor-core/tests/unit/
- [ ] T049 [P] Unit tests for repositories in packages/shared-data/tests/unit/
- [ ] T050 Performance optimization for ToC virtual scrolling
- [ ] T051 Add responsive breakpoints for mobile/tablet
- [ ] T052 Implement auto-save with debouncing
- [ ] T053 Add accessibility attributes and keyboard navigation
- [ ] T054 Run full E2E test suite and fix issues
- [ ] T055 Update CLAUDE.md with feature documentation

## Dependencies

- Setup (T001-T005) must complete first
- All tests (T006-T019) must be written and failing before implementation
- Data models (T020-T025) enable repository implementation
- State stores (T026-T030) required before UI components
- API routes (T031-T036) needed for integration tests
- UI components (T037-T041) depend on stores and API
- Integration (T042-T047) connects all layers
- Polish (T048-T055) after core functionality works

## Parallel Execution Examples

### Parallel Test Creation

```bash
# Launch all contract tests together (T006-T014):
pnpm --filter @ctrl-freaq/api test:contract:generate
```

### Parallel Data Model Creation

```bash
# Create all models simultaneously (T020-T023):
Task: "Create SectionView interface in packages/shared-data/src/models/section-view.ts"
Task: "Create PendingChange interface in packages/shared-data/src/models/pending-change.ts"
Task: "Create EditorSession interface in packages/shared-data/src/models/editor-session.ts"
Task: "Create TableOfContents interface in packages/shared-data/src/models/table-of-contents.ts"
```

### Parallel Store Implementation

```bash
# Implement all Zustand stores (T026-T028):
Task: "Create editor-store.ts in apps/web/src/features/document-editor/stores/"
Task: "Create pending-changes-store.ts in apps/web/src/features/document-editor/stores/"
Task: "Create toc-store.ts in apps/web/src/features/document-editor/stores/"
```

## Notes

- All contract tests use OpenAPI schema from contracts/sections-api.yaml
- Milkdown editor instances should be pooled (max 3) for memory efficiency
- Pending changes limited to 100 per section
- Performance targets: <300ms navigation, 60fps animations, <100ms patches
- Use Intersection Observer for ToC sync with viewport
- Debounce change tracking at 500ms intervals
- Apply CSS containment for section isolation

## Validation Checklist

- [x] All 9 API endpoints have contract tests
- [x] All 4 data model entities have creation tasks
- [x] All tests come before implementation (T006-T019 before T020+)
- [x] Parallel tasks operate on different files
- [x] Each task specifies exact file path
- [x] No parallel tasks modify same file
- [x] Integration tests cover all user stories from quickstart.md
- [x] Performance tests validate all requirements (<300ms, 60fps, <100ms)
