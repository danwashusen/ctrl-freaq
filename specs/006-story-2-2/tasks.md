# Tasks: Document Editor Core Infrastructure

**Input**: Design documents from `/specs/006-story-2-2/` **Prerequisites**:
research.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Implementation plan available in CLAUDE.md
   → Extract: TypeScript, React 18, Milkdown 7.15.5, Zustand, TanStack Query
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks (SectionView, PendingChange, EditorSession, TableOfContents)
   → contracts/: sections-api.yaml → contract test task
   → research.md: Extract decisions → setup tasks (Milkdown, diff-match-patch, localforage)
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands, components
   → Integration: API endpoints, state management, persistence
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests? (✓)
   → All entities have models? (✓)
   → All endpoints implemented? (✓)
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `apps/web/src/`, `packages/*/src/`
- Package structure from existing codebase
- Frontend in `apps/web/`, shared packages in `packages/`

## Phase 3.1: Setup

- [x] T001 Create document editor feature structure in
      `apps/web/src/features/document-editor/`
- [x] T002 [P] Install Milkdown 7.15.5 dependencies and configure in
      `apps/web/package.json`
- [x] T003 [P] Install diff-match-patch and localforage in
      `packages/editor-core/package.json`
- [x] T004 [P] Configure TypeScript paths for editor packages in
      `tsconfig.base.json`

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

- [x] T005 [P] Contract test GET /api/v1/documents/{docId}/sections in
      `apps/web/src/features/document-editor/__tests__/contracts/sections-get.test.ts`
- [x] T006 [P] Contract test GET /api/v1/sections/{sectionId} in
      `apps/web/src/features/document-editor/__tests__/contracts/section-get.test.ts`
- [x] T007 [P] Contract test PATCH /api/v1/sections/{sectionId} in
      `apps/web/src/features/document-editor/__tests__/contracts/section-patch.test.ts`
- [x] T008 [P] Contract test POST /api/v1/sections/{sectionId}/pending-changes
      in
      `apps/web/src/features/document-editor/__tests__/contracts/pending-changes-post.test.ts`
- [x] T009 [P] Contract test POST /api/v1/sections/{sectionId}/save in
      `apps/web/src/features/document-editor/__tests__/contracts/section-save.test.ts`
- [x] T010 [P] Contract test GET /api/v1/documents/{docId}/toc in
      `apps/web/src/features/document-editor/__tests__/contracts/toc-get.test.ts`
- [x] T011 [P] Integration test ToC navigation in
      `apps/web/src/features/document-editor/__tests__/integration/toc-navigation.test.ts`
- [x] T012 [P] Integration test section mode transitions in
      `apps/web/src/features/document-editor/__tests__/integration/section-modes.test.ts`
- [x] T013 [P] Integration test placeholder content in
      `apps/web/src/features/document-editor/__tests__/integration/placeholder-content.test.ts`
- [x] T014 [P] Integration test patch generation in
      `apps/web/src/features/document-editor/__tests__/integration/patch-generation.test.ts`
- [x] T015 [P] Performance test section navigation (<300ms) in
      `apps/web/src/features/document-editor/__tests__/performance/navigation.test.ts`

## Phase 3.3: Core Data Models (ONLY after tests are failing)

- [x] T016 [P] SectionView model in
      `apps/web/src/features/document-editor/types/section-view.ts`
- [x] T017 [P] PendingChange model in
      `apps/web/src/features/document-editor/types/pending-change.ts`
- [x] T018 [P] EditorSession model in
      `apps/web/src/features/document-editor/types/editor-session.ts`
- [x] T019 [P] TableOfContents model in
      `apps/web/src/features/document-editor/types/table-of-contents.ts`
- [x] T020 [P] Zod validation schemas in
      `apps/web/src/features/document-editor/schemas/validation.ts`

## Phase 3.4: State Management ✅

- [x] T021 [P] Editor store with Zustand+Immer in
      `apps/web/src/features/document-editor/stores/editor-store.ts`
- [x] T022 [P] Document store for sections in
      `apps/web/src/features/document-editor/stores/document-store.ts`
- [x] T023 [P] Session store for editor state in
      `apps/web/src/features/document-editor/stores/session-store.ts`
- [x] T024 [P] TanStack Query hooks in
      `apps/web/src/features/document-editor/hooks/use-sections-query.ts`

## Phase 3.5: Core Components ✅

- [x] T025 [P] TableOfContents component in
      `apps/web/src/features/document-editor/components/table-of-contents.tsx`
- [x] T026 [P] SectionCard component in
      `apps/web/src/features/document-editor/components/section-card.tsx`
- [x] T027 [P] MilkdownEditor component in
      `apps/web/src/features/document-editor/components/milkdown-editor.tsx`
- [x] T028 [P] DiffPreview component in
      `apps/web/src/features/document-editor/components/diff-preview.tsx`
- [x] T029 DocumentEditor main component in
      `apps/web/src/features/document-editor/components/document-editor.tsx`

## Phase 3.6: Editor Packages ✅

- [x] T030 [P] Patch engine with diff-match-patch in
      `packages/editor-core/src/patch-engine.ts`
- [x] T031 [P] Patch CLI commands in `packages/editor-core/src/cli.ts`
- [x] T032 [P] Local persistence layer in
      `packages/editor-persistence/src/local-storage.ts`
- [x] T033 [P] Persistence CLI commands in
      `packages/editor-persistence/src/cli.ts`

## Phase 3.7: API Services ✅

- [x] T034 [P] Sections API service in
      `apps/web/src/features/document-editor/services/sections-api.ts`
- [x] T035 [P] Pending changes service in
      `apps/web/src/features/document-editor/services/pending-changes-service.ts`
- [x] T036 [P] Editor session service in
      `apps/web/src/features/document-editor/services/session-service.ts`

## Phase 3.8: Backend API Endpoints ✅

- [x] T037 GET /api/v1/documents/{docId}/sections endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T038 GET /api/v1/sections/{sectionId} endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T039 PATCH /api/v1/sections/{sectionId} endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T040 POST /api/v1/sections/{sectionId}/pending-changes endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T041 POST /api/v1/sections/{sectionId}/save endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T042 GET /api/v1/documents/{docId}/toc endpoint in
      `apps/api/src/routes/sections.ts`
- [x] T043 GET /api/v1/documents/{docId}/editor-session endpoint in
      `apps/api/src/routes/sessions.ts`
- [x] T044 PUT /api/v1/documents/{docId}/editor-session endpoint in
      `apps/api/src/routes/sessions.ts`

## Phase 3.9: Repository Layer ✅

- [x] T045 [P] SectionRepository in
      `packages/shared-data/src/repositories/section-repository.ts`
- [x] T046 [P] PendingChangeRepository in
      `packages/shared-data/src/repositories/pending-change-repository.ts`
- [x] T047 [P] EditorSessionRepository in
      `packages/shared-data/src/repositories/editor-session-repository.ts`
- [x] T048 [P] Database migrations for new tables in
      `packages/shared-data/src/migrations/`

## Phase 3.10: Integration & Polish

- [x] T049 [P] Unit tests for patch engine in
      `packages/editor-core/src/__tests__/patch-engine.test.ts`
- [x] T050 [P] Unit tests for local persistence in
      `packages/editor-persistence/src/__tests__/local-storage.test.ts`
- [x] T051 [P] Component tests for TableOfContents in
      `apps/web/src/features/document-editor/components/__tests__/table-of-contents.test.tsx`
- [x] T052 [P] Component tests for SectionCard in
      `apps/web/src/features/document-editor/components/__tests__/section-card.test.tsx`
- [x] T053 [P] Component tests for MilkdownEditor in
      `apps/web/src/features/document-editor/components/__tests__/milkdown-editor.test.tsx`
- [x] T054 [P] E2E tests with Playwright in `tests/e2e/document-editor.e2e.ts`
- [x] T055 [P] Performance optimization and lazy loading in
      `apps/web/src/features/document-editor/utils/performance.ts`
- [x] T056 [P] CLI documentation update in `packages/editor-core/README.md`
- [x] T057 [P] CLI documentation update in
      `packages/editor-persistence/README.md`

## Dependencies

- Setup (T001-T004) before tests (T005-T015)
- Tests (T005-T015) before models (T016-T020)
- Models (T016-T020) before stores (T021-T024)
- Stores (T021-T024) before components (T025-T029)
- T030-T033 can run parallel with T025-T029
- API services (T034-T036) after stores (T021-T024)
- Backend endpoints (T037-T044) after models (T016-T020)
- Repository layer (T045-T048) blocks backend endpoints (T037-T044)
- Integration (T049-T057) after all core implementation

## Parallel Example

```bash
# Phase 3.2 - Launch contract tests together:
Task: "Contract test GET /api/v1/documents/{docId}/sections in apps/web/src/features/document-editor/__tests__/contracts/sections-get.test.ts"
Task: "Contract test GET /api/v1/sections/{sectionId} in apps/web/src/features/document-editor/__tests__/contracts/section-get.test.ts"
Task: "Contract test PATCH /api/v1/sections/{sectionId} in apps/web/src/features/document-editor/__tests__/contracts/section-patch.test.ts"
Task: "Contract test POST /api/v1/sections/{sectionId}/pending-changes in apps/web/src/features/document-editor/__tests__/contracts/pending-changes-post.test.ts"

# Phase 3.3 - Launch data models together:
Task: "SectionView model in apps/web/src/features/document-editor/types/section-view.ts"
Task: "PendingChange model in apps/web/src/features/document-editor/types/pending-change.ts"
Task: "EditorSession model in apps/web/src/features/document-editor/types/editor-session.ts"
Task: "TableOfContents model in apps/web/src/features/document-editor/types/table-of-contents.ts"

# Phase 3.5 - Launch core components together:
Task: "TableOfContents component in apps/web/src/features/document-editor/components/table-of-contents.tsx"
Task: "SectionCard component in apps/web/src/features/document-editor/components/section-card.tsx"
Task: "MilkdownEditor component in apps/web/src/features/document-editor/components/milkdown-editor.tsx"
Task: "DiffPreview component in apps/web/src/features/document-editor/components/diff-preview.tsx"
```

## Notes

- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Follow TDD: Red-Green-Refactor cycle
- Use existing patterns from codebase (Zustand stores, shadcn/ui components)
- Commit after each task
- Run linting and type checking after each phase

## Task Generation Rules

_Applied during main() execution_

1. **From Contracts** (sections-api.yaml):
   - 8 endpoints → 8 contract test tasks [P]
   - 8 endpoints → 8 implementation tasks

2. **From Data Model**:
   - 4 entities → 4 model creation tasks [P]
   - State management → 3 store tasks [P]

3. **From Quickstart Scenarios**:
   - 5 test scenarios → 5 integration test tasks [P]
   - Performance goals → 1 performance test task [P]

4. **Ordering**:
   - Setup → Tests → Models → Stores → Components → Services → Endpoints →
     Polish
   - TDD enforced: tests before implementation

## Validation Checklist

_GATE: Checked by main() before returning_

- [✓] All contracts have corresponding tests (T005-T010)
- [✓] All entities have model tasks (T016-T019)
- [✓] All tests come before implementation (T005-T015 before T016+)
- [✓] Parallel tasks truly independent (different files)
- [✓] Each task specifies exact file path
- [✓] No task modifies same file as another [P] task
- [✓] Backend API structure follows existing patterns
- [✓] Frontend follows feature-based organization
- [✓] Package structure aligns with Constitutional library-first requirements

## Phase 4.R: Review Follow-Up

- [x] F001 Finding F001: TDD Violation - Implementation Missing While Tests
      Exist as described in review.md
- [x] F002 Finding F002: API Implementation Gaps as described in review.md
- [x] F003 Finding F003: Library Package Placeholder Implementations as
      described in review.md
- [x] F004 Finding F004: Database Schema Missing as described in review.md
- [x] F005 Finding F005: Performance Testing Framework Incomplete as described
      in review.md
- [x] F006 Finding F001: Test Failures in SectionCard Component as described in
      review.md
- [x] F007 Finding F002: Incomplete API Implementation Verification as described
      in review.md
- [x] F008 Finding F003: Placeholder Library Package Implementations as
      described in review.md
