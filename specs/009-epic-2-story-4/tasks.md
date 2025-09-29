# Tasks: New Section Content Flow

**Input**: Design documents from `/specs/009-epic-2-story-4/` **Prerequisites**:
plan.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 3.1: Setup

- [✓] T001 Scaffold placeholder exports for assumption-session modules so tests
  compile before implementation in
  /apps/web/src/features/document-editor/assumptions-flow/index.ts and
  /packages/editor-core/src/assumptions/index.ts. Task agent command:
  `mkdir -p /apps/web/src/features/document-editor/assumptions-flow`

## Phase 3.2: Tests First (TDD)

- [✓] T002 [P] Author failing contract coverage for assumption-session API flows
  in /apps/api/tests/contract/assumption-session.contract.test.ts covering
  session start, prompt responses, proposal creation, and history listing. Task
  agent command: `pnpm --filter @ctrl-freaq/api test -- --runInBand`
- [✓] T003 [P] Create Playwright spec validating override skips block submission
  in /apps/web/tests/e2e/document-editor/assumptions-override.e2e.ts with
  deterministic fixture hooks. Task agent command:
  `pnpm --filter @ctrl-freaq/web test:e2e -- --ui`
- [✓] T004 [P] Add Vitest integration spec asserting proposal history retention
  in /apps/web/tests/integration/document-editor/proposal-history.test.ts. Task
  agent command: `pnpm --filter @ctrl-freaq/web test -- --watch`
- [✓] T005 [P] Write failing persistence tests for assumption-session storage in
  /packages/editor-persistence/tests/assumption-sessions/assumption-session.store.test.ts
  to lock expected IndexedDB behaviour. Task agent command:
  `pnpm --filter @ctrl-freaq/editor-persistence test -- --runInBand`
- [✓] T006 [P] Define failing service-layer tests for assumption-session logic
  in
  /apps/api/src/modules/section-editor/services/assumption-session.service.test.ts
  covering overrides, conflicts, and proposal history. Task agent command:
  `pnpm --filter @ctrl-freaq/api test -- --runInBand`
- [✓] T007 [P] Add failing resume-flow spec to ensure assumption sessions pick
  up after reload in
  /apps/web/tests/integration/document-editor/assumptions-resume.test.ts. Task
  agent command: `pnpm --filter @ctrl-freaq/web test -- --watch`
- [✓] T008 [P] Add contract test covering stakeholder escalation handling in
  /apps/api/tests/contract/assumption-session-escalation.contract.test.ts. Task
  agent command: `pnpm --filter @ctrl-freaq/api test -- --runInBand`
- [✓] T009 [P] Add integration test verifying AI failure fallback keeps manual
  drafting available in
  /apps/web/tests/integration/document-editor/proposal-fallback.test.ts. Task
  agent command: `pnpm --filter @ctrl-freaq/web test -- --watch`

## Phase 3.3: Core Implementation (after tests fail)

- [✓] T010 [P] Implement SectionAssumption model per data-model.md in
  /packages/shared-data/src/models/section-assumption.ts with Zod schema and
  unit coverage.
- [✓] T011 [P] Implement AssumptionSession model in
  /packages/shared-data/src/models/assumption-session.ts with lifecycle helpers
  for status transitions.
- [✓] T012 [P] Implement DraftProposal model in
  /packages/shared-data/src/models/draft-proposal.ts including rationale mapping
  types.
- [✓] T013 Update shared-data barrels and typings in
  /packages/shared-data/src/models/index.ts and
  /packages/shared-data/src/index.ts to export new entities.
- [✓] T014 Add SQLite migration + migration registry entry for assumption tables
  in /packages/shared-data/src/migrations/ with rollback coverage.
- [✓] T015 Create shared-data repositories for assumption sessions at
  /packages/shared-data/src/repositories/assumption-session.repository.ts and
  companion unit tests.
- [✓] T016 Implement editor-persistence storage + sync utilities for assumption
  sessions under /packages/editor-persistence/src/assumption-sessions/ with
  IndexedDB schema upgrades.
- [✓] T017 Expose CLI commands for assumption-session operations in
  /packages/editor-persistence/src/cli.ts and ensure help output covers new
  flags.
- [✓] T018 Implement assumption-session service logic in
  /apps/api/src/modules/section-editor/services/assumption-session.service.ts
  satisfying T006–T009 expectations.
- [✓] T019 Register repositories + services in the DI container at
  /apps/api/src/services/container.ts including logger wiring and CLI bindings.
- [✓] T020 Extend validation schemas in
  /apps/api/src/modules/section-editor/validation/section-editor.schema.ts for
  session start, respond, and proposal payloads.
- [✓] T021 Add Express routing for assumption-session endpoints in
  /apps/api/src/routes/sections.ts with structured logging + requestId
  propagation.

## Phase 3.4: Integration

- [✓] T022 Implement assumption-session API client in
  /apps/web/src/features/document-editor/services/assumptions-api.ts using
  TanStack Query patterns and SSE fallbacks.
- [✓] T023 Implement assumption-session store and hooks in
  /apps/web/src/features/document-editor/assumptions-flow/stores/proposal-store.ts
  to satisfy T004 and T009 assertions.
- [✓] T024 Build assumption checklist + override banner components under
  /apps/web/src/features/document-editor/assumptions-flow/components/ with
  accessibility cues and loading states.
- [✓] T025 Wire the new flow into document editor entry points in
  /apps/web/src/features/document-editor/components/document-editor.tsx and
  related providers so blank sections launch the assumption loop.
- [✓] T026 Connect editor-persistence offline caches to the new store in
  /packages/editor-persistence/src/assumption-sessions/bridge.ts and ensure
  browser + CLI clients share persistence keys.
- [✓] T027 Update deterministic fixtures for Playwright + contract tests in
  /apps/web/src/lib/fixtures/e2e/ and /apps/api/tests/fixtures/section-editor/
  to include assumption prompts and proposal history examples.

## Phase 3.5: Polish & Verification

- [✓] T028 Instrument observability for assumption events in
  /apps/api/src/modules/section-editor/services/assumption-session.service.ts
  emitting logs `{requestId, sessionId, action, overrideStatus}` and telemetry
  events (`assumption_session.completed`, `assumption_session.latency_ms`).
- [✓] T029 Refresh docs: update /docs/front-end-spec.md and
  /docs/architecture.md with assumption-session flow details and CLI usage
  notes.
- [✓] T030 Ensure quickstart + spec artefacts reflect implemented behaviour by
  re-running commands in /specs/009-epic-2-story-4/quickstart.md and capturing
  any fixture updates.
- [✓] T031 Run quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`) and archive Playwright evidence under /apps/web/test-results/.
- [✓] T032 [P] Add automated timing assertions for checklist render and draft
  streaming latency in
  /apps/web/tests/performance/assumptions-timing.performance.test.ts. Task agent
  command: `pnpm --filter @ctrl-freaq/web test:performance`
- [✓] T033 [P] Extend backend telemetry export to track streaming latency and
  override resolution metrics in
  /apps/api/tests/performance/assumption-session.performance.test.ts with
  assertions. Task agent command:
  `pnpm --filter @ctrl-freaq/api test -- --runInBand`

## Dependencies

- T001 before all test tasks.
- Tests T002–T009 must fail before starting T010.
- T010–T017 unblock T018; T018 must complete before T021.
- T019 and T020 must precede T021.
- Frontend integration tasks (T022–T027) depend on backend core (T018–T021) and
  persistence wiring (T016).
- Polish tasks (T028–T033) run after all implementation and integration tasks.

## Parallel Execution Example

```
# After T001, launch contract + frontend tests together:
Task agent command: pnpm --filter @ctrl-freaq/api test -- --runInBand
Task agent command: pnpm --filter @ctrl-freaq/web test:e2e -- --ui
Task agent command: pnpm --filter @ctrl-freaq/web test -- --watch
Task agent command: pnpm --filter @ctrl-freaq/editor-persistence test -- --runInBand
```

## Notes

- Honour TDD: do not begin implementation until T002–T006 fail for expected
  reasons.
- Maintain library-first boundaries: shared logic belongs in packages with CLI
  coverage before app-level usage.
- Use structured logging and requestId propagation for every new Express
  handler.
- Keep Playwright fixtures deterministic; refresh fixture docs when IDs change.

## Phase 4.R: Review Follow-Up

- [✓] F1 Finding F1: Multi-select answers are lost on resume and violate
  persistence requirement as described in review.md
- [✓] F2 Finding F2: Prompt provider never sourced from template metadata as
  described in review.md
- [✓] F3 Finding F3: Multi-select answers disappear from generated proposals and
  summaries as described in review.md
- [✓] F4 Finding F4: Document-level decision conflicts are never enforced as
  described in review.md
- [✓] F5 Finding F5: Assumption summary omits answers, risks, and escalations as
  described in review.md

## Assumption Log

- [ASSUMPTION] Document decision enforcement leverages
  `documents.content.decision_log` entries mapping `assumptionKeys`,
  `optionIds`, and `allowedAnswers` to align section-level answers with
  governance decisions. This structure must remain current for conflict gating
  to function.
