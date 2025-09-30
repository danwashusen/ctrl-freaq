# Tasks: Section Draft Persistence

**Input**: Design documents from `/specs/010-epic-2-story-5/`  
**Prerequisites**: plan.md, research.md, data-model.md, contracts/,
quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory → extract tech stack and structure
2. Load design docs (research, data-model, contracts, quickstart)
3. Generate tasks: Setup → Tests → Core → Integration → Polish
4. Ensure TDD: every test task precedes implementation work it guards
5. Annotate parallel-friendly tasks with [P]; keep same-file tasks sequential
6. Number tasks T001…T0nn and capture dependencies and parallel examples
```

## Phase 3.1: Setup

- [✓] T001 Verify clean baseline on branch `010-epic-2-story-5` by running
  `pnpm lint`, `pnpm typecheck`, and `pnpm test:quick` to confirm no
  pre-existing failures.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

- [✓] T002 [P] Add failing contract test for PATCH
  `/api/projects/:projectSlug/documents/:documentId/draft-bundle` in
  `apps/api/tests/contracts/documents/draft-bundle.contract.test.ts` using the
  OpenAPI schema.
- [✓] T003 [P] Add failing contract test for POST
  `/api/projects/:projectSlug/documents/:documentId/draft-compliance` in
  `apps/api/tests/contracts/documents/draft-compliance.contract.test.ts`.
- [✓] T004 [P] Add failing Vitest suite covering draft keying, load/save,
  browser-quota pruning, and logout-triggered purge in
  `packages/editor-persistence/tests/draft-store.test.ts`.
- [✓] T005 [P] Add failing Vitest unit tests for bundled save orchestration in
  `apps/api/tests/unit/drafts/draft-bundle.service.test.ts` (section validation,
  conflict handling, compliance escalation, post-save cleanup/audit metadata).
- [✓] T006 [P] Add failing React/Vitest tests for `use-draft-persistence` hook
  in
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`,
  asserting status indicators, explicit revert-to-published control, ARIA
  announcements, and logout purge behaviour.
- [✓] T007 [P] Add failing Playwright E2E scenario
  `apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts` covering offline
  edits, reload recovery, revert-to-published workflow, pruning messaging,
  logout purge, and bundled save flow.

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [✓] T008 Implement `DocumentDraftState`/`SectionDraft` schema types and
  selectors in `packages/editor-persistence/src/schema.ts` per data-model.md.
- [✓] T009 Extend `packages/editor-persistence/src/draft-store.ts` with keyed
  persistence, quota-aware pruning, logout purge handlers, and rehydration
  helpers required by tests.
- [✓] T010 Update `packages/editor-persistence/src/cli.ts` to expose
  `draft:list` (and related) commands for inspecting stored drafts.
- [✓] T011 Add compliance warning helper in
  `packages/qa/src/compliance/drafts.ts` to log retention-policy conflicts
  without sending draft payloads.
- [✓] T012 Implement bundled save service in
  `apps/api/src/services/drafts/draft-bundle.service.ts` applying validated
  sections atomically, surfacing conflict metadata, and signalling draft cleanup
  with audit stamps.
- [✓] T013 Wire PATCH bundle route in
  `apps/api/src/routes/documents/save-drafts.ts` to use the new service and
  return contract-compliant responses.
- [✓] T014 Add POST compliance warning route in
  `apps/api/src/routes/documents/draft-compliance.ts` delegating to QA logging
  helper.
- [✓] T015 Implement `use-draft-persistence` hook in
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`
  integrating persistence library, offline detection, revert-to-published
  control, and logout purge hook-in.
- [✓] T016 Update draft store in
  `apps/web/src/features/document-editor/stores/draft-state.ts` to manage
  readiness, conflicts, and compliance warning flags.
- [✓] T017 Introduce accessible status badge and revert controls in
  `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx`
  with visible labels and ARIA live updates.
- [✓] T018 Emit telemetry events in
  `apps/web/src/lib/telemetry/client-events.ts` (`draft.saved`, `draft.pruned`,
  `draft.conflict`, `compliance.warning`) without draft content payloads.
- [✓] T019 Connect draft endpoints in
  `apps/web/src/features/document-editor/services/draft-client.ts` to call new
  PATCH/POST APIs, map responses, and trigger local cleanup on success.
- [✓] T020 Handle offline compliance escalation messaging in
  `apps/web/src/features/document-editor/utils/draft-conflict.ts` using QA
  helper outputs and audit details.

## Phase 3.4: Integration

- [✓] T021 [P] Update fixture/mocks for retention policies in
  `apps/web/src/mocks/projectRetention.ts` and backend fixtures to drive
  compliance warning scenarios.
- [✓] T022 [P] Refresh Playwright fixtures and snapshot expectations under
  `apps/web/tests/e2e/fixtures/document-editor` to include draft status and
  pruning flows.

## Phase 3.5: Polish

- [✓] T023 [P] Update documentation references (e.g., `/docs/front-end-spec.md`
  draft status section and `/specs/010-epic-2-story-5/quickstart.md`) to reflect
  final behavior, including logout purge and revert guidance.
- [✓] T024 Execute full quality gates: `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm --filter @ctrl-freaq/web test:e2e:quick`, capture
  rehydration timing (~3s target), verify user guidance appears if slower, and
  document results in plan.md Progress Tracking.

## Dependencies

- T002–T007 must complete (fail) before T008–T020.
- T008 precedes T009 and T010 (same module).
- T012 depends on T008–T011; T013 depends on T012; T014 depends on T011.
- T015 depends on T008–T010; T016 depends on T015; T017 depends on T016; T018
  depends on T015; T019 depends on T012–T018; T020 depends on T011, T016, T019.
- T021–T022 require T019–T020; T023 requires all implementation tasks; T024 is
  final verification.

## Parallel Execution Examples

```
# After setup, execute test authoring in parallel:
run-task T002
run-task T003
run-task T004
run-task T005
run-task T006
run-task T007

# During integration polish, run fixture/docs tasks together:
run-task T021
run-task T022
run-task T023
```

## Constitution Compliance Check

- TDD enforced: T002–T007 (tests) precede any implementation touching the same
  feature areas.
- Library-first respected: shared behavior implemented inside
  `packages/editor-persistence` and `packages/qa` before apps consume it.
- CLI standard satisfied via T010 updating persistence CLI.
- Observability maintained through telemetry/logging tasks (T018, T011, T024).
- Simplicity preserved by extending existing modules—no new services beyond
  planned routes.

## Notes

- [P] indicates the task can be run in parallel with others once dependencies
  are met.
- Always commit after each task; ensure failing tests exist before writing
  implementations.
- Use plan.md, data-model.md, and quickstart.md as the authoritative guides when
  implementing.

## Phase 4.R: Review Follow-Up

- [✓] F1 Finding F1: Bundled save writes diff text as final section content —
  implement remediation detailed in `specs/010-epic-2-story-5/audit.md`.
- [✓] F2 Finding F2: Draft keys hard-code project slug, breaking cross-project
  isolation — see `specs/010-epic-2-story-5/audit.md`.
- [✓] F3 Finding F3: Draft store never receives live edits, so
  rehydration/logout promises fail — follow `specs/010-epic-2-story-5/audit.md`
  remediation guidance.
- [✓] F4 Finding F4: Logout does not clear DraftStore entries — see
  `specs/010-epic-2-story-5/audit.md`.
- [✓] F5 Finding F5: Section draft badges misreport drafts when other sections
  have saves — see `specs/010-epic-2-story-5/audit.md`.
- [✓] F6 Finding F6: Draft bundle/compliance APIs trust client-supplied author
  identity — see `specs/010-epic-2-story-5/audit.md`.
- [✓] F7 Finding F7: Lint gate still emits warnings — see
  `specs/010-epic-2-story-5/audit.md`.
