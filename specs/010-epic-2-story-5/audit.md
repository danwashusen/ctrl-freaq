# Code Review Report: Section Draft Persistence (010-epic-2-story-5)

## Final Status: **Approved**

## Resolved Scope

**Branch**: `010-epic-2-story-5` **Baseline**: `main` **Diff Source**:
`main...HEAD` **Review Target**: Section draft persistence, recovery, compliance
signalling, and bundled saves for Epic 2 Story 5 **Files Analyzed**: 103 changed
files including TypeScript backend services/routes, shared persistence
utilities, React hooks/components, QA/compliance helpers, and supporting
documentation

**Resolved Scope Narrative**: The feature branch hardens draft persistence
end-to-end: the IndexedDB-backed store now retries prunes and surfaces quota
exhaustion, the section editor enumerates stored drafts for atomic bundle
submission, React hooks expose accessible status cues with timestamps, and the
Express API validates scope before applying bundles while logging compliance
events without leaking client content.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/specs/010-epic-2-story-5`
**Implementation Scope**:

- `packages/editor-persistence/src/draft-store.ts` – quota-aware saves,
  author-scoped pruning loop, and draft listing helpers
- `apps/web/src/features/section-editor/hooks/use-section-draft.ts` – autosave
  orchestration, bundle assembly, and retention policy escalation
- `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts` –
  rehydration gating, logout purge handling, and compliance logging bridges
- `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx`
  – accessible status badge with last-updated timestamps and live region
  messaging
- `apps/api/src/services/drafts/draft-bundle.service.ts` &
  `apps/api/src/services/drafts/draft-bundle.repository.ts` – atomic bundle
  application with document/project scope validation and audit emission
- `apps/api/src/routes/projects.ts` &
  `apps/web/src/features/document-editor/services/project-retention.ts` –
  retention policy lookups surfaced to the editor without exposing draft
  payloads

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/prd.md'
        context:
          'Product requirements and document-editor workflow expectations.'
      - path: 'docs/architecture.md'
        context:
          'Backend architecture, service boundaries, and repository rules.'
      - path: 'docs/ui-architecture.md'
        context:
          'Frontend architecture, state patterns, and accessibility guardrails.'
      - path: 'docs/front-end-spec.md'
        context:
          'Frontend document editor behaviour, draft indicators, and
          accessibility cues.'
```

## Pre-Review Gates

| Gate                      | Status | Details                                                                                                                                                            |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context Gate**          | Pass   | plan.md, tasks.md, spec.md, research.md, data-model.md, quickstart.md, and contracts reviewed; dossier complete.                                                   |
| **Change Intent Gate**    | Pass   | Implementation matches POR for Story 5 (client-only drafts, atomic bundle saves, compliance telemetry).                                                            |
| **Unknowns Gate**         | Pass   | No outstanding `[NEEDS CLARIFICATION]` markers in feature docs.                                                                                                    |
| **Separation of Duties**  | Info   | Repository lacks CODEOWNERS/branch metadata; assume CI enforces reviewer separation.                                                                               |
| **Code Owners Gate**      | Info   | No CODEOWNERS file present; owner approvals must be coordinated manually.                                                                                          |
| **Quality Controls Gate** | Info   | Targeted vitest suites executed (`@ctrl-freaq/api`, `@ctrl-freaq/editor-persistence`, `@ctrl-freaq/web`); full repo lint/typecheck/build not rerun in this review. |
| **TDD Evidence Gate**     | Pass   | New and updated Vitest/E2E suites cover persistence, compliance logging, and bundled save orchestration.                                                           |

## Findings

### Active Findings (Current Iteration)

- None — no new findings were raised in this review cycle.

### Historical Findings Log

- [Resolved 2025-10-05] F021: Draft auto-discard markers delete unsaved work —
  Reported 2025-10-03 by Claude Code Review v2.0. Resolution: Draft markers now
  record timestamps and are cleared after fresh edits; rehydrate honours marker
  age so drafts persist until the user acts. Evidence:
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`,
  `apps/web/src/features/section-editor/hooks/use-section-draft.ts`, Vitest
  suite `pnpm --filter @ctrl-freaq/web test -- use-draft-persistence`.
- [Resolved 2025-10-05] F020: Draft telemetry leaks identifiers off-device —
  Reported 2025-10-03 by Claude Code Review v2.0. Resolution: Draft telemetry
  now logs via a console-only helper, avoiding remote logger flushes. Evidence:
  `apps/web/src/lib/telemetry/client-events.ts`,
  `apps/web/src/lib/telemetry/client-events.test.ts`,
  `pnpm --filter @ctrl-freaq/web test -- client-events`.
- [Resolved 2025-10-03] F001–F019 — Draft bundle scope, retention logging, and
  telemetry follow-ups (reported 2025-10-02 by Claude Code Review v2.0).
  Resolution tracked in `specs/010-epic-2-story-5/tasks.md` Phase 4.R with
  evidence linked to updated tests and docs.

## Strengths

- Atomic bundle application wraps section approvals in a single transaction,
  preventing partial saves even when validation fails mid-flight.
- Retention policy integration re-flags stored drafts once policy metadata
  loads, ensuring compliance warnings appear without losing client-only work.
- Accessible status badge surfaces last-updated timestamps alongside ARIA live
  announcements, aligning with FR-002/FR-002a and WCAG expectations.

## Outstanding Clarifications

- None.

## Control Inventory

| Control Domain         | Implementation                                                                                                          | Status      | Reference                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| **Authentication**     | Clerk-backed auth middleware enforces authenticated requests before draft actions.                                      | Operational | `apps/api/src/middleware/auth.ts`                                                     |
| **Logging**            | Compliance warnings flow through `packages/qa/src/compliance/drafts.ts`; draft telemetry uses console-only events.      | Operational | `packages/qa/src/compliance/drafts.ts`; `apps/web/src/lib/telemetry/client-events.ts` |
| **Error Handling**     | Draft routes centralise failures via `sendErrorResponse`, returning structured diagnostics.                             | Operational | `apps/api/src/routes/documents.ts`                                                    |
| **Repository Pattern** | Draft bundle repository mediates section lookups, scope checks, and patch application.                                  | Operational | `apps/api/src/services/drafts/draft-bundle.repository.ts`                             |
| **Input Validation**   | Zod schemas guard bundle/compliance payloads before services execute.                                                   | Operational | `apps/api/src/routes/documents.ts`                                                    |
| **State Management**   | React hooks (`use-draft-persistence`, `use-section-draft`) coordinate persistence, rehydration, and UI state updates.   | Operational | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`                |
| **Performance**        | Document editor route now lazy-loads the editor and memoises status formatting to keep rehydrate within the ~3s target. | Operational | `apps/web/src/app/router/document-routes.tsx`                                         |

## Quality Signal Summary

### Linting Results

- **Status**: Not Run (not requested this iteration)
- **Warnings**: N/A
- **Key Issues**:
  - Reviewer focused on targeted behavioural tests; please supply full
    `pnpm lint` evidence before merge if not already captured in CI.

### Type Checking

- **Status**: Not Run (not requested this iteration)
- **Results**: Provide fresh `pnpm typecheck` output with the merge request if
  CI does not cover it automatically.

### Test Results

- **Status**: Pass (targeted suites)
- **Results**:
  - `pnpm --filter @ctrl-freaq/api test -- draft-bundle.service` — 1 file, 6
    tests passed.
  - `pnpm --filter @ctrl-freaq/editor-persistence test -- draft-store` — 1 file,
    6 tests passed.
  - `pnpm --filter @ctrl-freaq/web test -- use-draft-persistence` — 1 file, 8
    tests passed.
  - `pnpm --filter @ctrl-freaq/web test -- client-events` — 1 file, 4 tests
    passed.
- **Root Cause**: N/A (all targeted suites green).

### Build Status

- **Status**: Not Run (build not executed during review)
- **Details**: Ensure `pnpm build` is captured in CI or prior to merge.

## Dependency Audit Summary

- **Baseline Severity Counts**: Not re-evaluated; prior audits showed no
  outstanding CVEs.
- **Current Severity Counts**: No external dependency additions beyond workspace
  links to `@ctrl-freaq/qa` and `@ctrl-freaq/shared-data`.
- **New CVEs Identified**: None observed.
- **Deprecated Packages**: None observed.
- **Justifications / Version Currency**: Workspace dependencies remain aligned
  with repo-managed versions; no registry upgrades introduced.

## Requirements Coverage Table

| Requirement | Summary                                                                        | Implementation Evidence                                                                                                                                       | Validating Tests                                                                                                                                                         | Linked Findings / Clarifications |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| **FR-001**  | Persist unsaved section edits per author until saved/discarded                 | `packages/editor-persistence/src/draft-store.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                           | `packages/editor-persistence/tests/draft-store.test.ts`; `apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts`                                                   | —                                |
| **FR-002**  | Display per-section draft status with last-updated timestamp                   | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`; `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx` | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`; `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.test.tsx` | —                                |
| **FR-002a** | Announce status changes via ARIA live regions                                  | `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx`                                                                         | `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.test.tsx`                                                                               | —                                |
| **FR-003**  | Restore outstanding drafts on reload before applying server updates            | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                     | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`; `apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts`                              | —                                |
| **FR-004**  | Bundle all draft sections into a single atomic save                            | `apps/api/src/services/drafts/draft-bundle.service.ts`; `apps/api/src/services/drafts/draft-bundle.repository.ts`                                             | `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`; `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`                                             | —                                |
| **FR-005**  | Prompt authors to apply or discard drafts before server updates overwrite them | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                     | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`                                                                                             | —                                |
| **FR-006**  | Record author metadata, retire local copy, emit audit stamps on acceptance     | `apps/api/src/services/drafts/draft-bundle.service.ts`; `packages/qa/src/compliance/drafts.ts`                                                                | `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`                                                                                                                | —                                |
| **FR-007**  | Prioritise local drafts when server conflicts occur                            | `apps/api/src/services/drafts/draft-bundle.repository.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                  | `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`; `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`                                             | —                                |
| **FR-008**  | Prune oldest drafts and notify when browser quota is hit                       | `packages/editor-persistence/src/draft-store.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                           | `packages/editor-persistence/tests/draft-store.test.ts`; `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`                                    | —                                |
| **FR-009**  | Retain drafts indefinitely until the author saves or discards them             | `packages/editor-persistence/src/draft-store.ts`; `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`                                      | `packages/editor-persistence/tests/draft-store.test.ts`                                                                                                                  | —                                |
| **FR-010**  | Abort entire bundled save when any section fails validation                    | `apps/api/src/services/drafts/draft-bundle.service.ts`; `apps/api/src/services/drafts/draft-bundle.repository.ts`                                             | `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`                                                                                                                | —                                |
| **FR-011**  | Keep drafts client-only and purge them on logout                               | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`; `packages/editor-persistence/src/draft-store.ts`                                      | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`                                                                                             | —                                |
| **FR-012**  | Expose client-side telemetry without transmitting identifiers                  | `apps/web/src/lib/telemetry/client-events.ts`                                                                                                                 | `apps/web/src/lib/telemetry/client-events.test.ts`                                                                                                                       | —                                |
| **FR-013**  | Key section drafts by project/document/section/author                          | `packages/editor-persistence/src/draft-store.ts`                                                                                                              | `packages/editor-persistence/tests/draft-store.test.ts`                                                                                                                  | —                                |
| **FR-014**  | Log compliance warnings without sending draft payloads                         | `apps/web/src/features/section-editor/hooks/use-section-draft.ts`; `apps/api/src/routes/documents.ts`; `packages/qa/src/compliance/drafts.ts`                 | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`; `apps/api/tests/contract/projects.retention.contract.test.ts`                              | —                                |

## Requirements Compliance Checklist

| Requirement Group             | Status | Notes                                                                                         |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | Pass   | Library-first, CLI, and TDD mandates remain satisfied after telemetry and persistence fixes.  |
| **SOC 2 Authentication**      | Pass   | AuthN/AZ surface unchanged; Clerk enforcement remains in place.                               |
| **SOC 2 Logging**             | Pass   | Compliance warnings recorded without draft payloads; telemetry stays local.                   |
| **Security Controls**         | Pass   | Scope validation prevents cross-project draft application; no sensitive data is leaked.       |
| **Code Quality**              | Pass   | Tests cover new behaviours; no readability or complexity regressions observed.                |
| **Testing Requirements**      | Info   | Targeted Vitest suites executed; ensure full CI (lint/typecheck/build/e2e) runs before merge. |

## Decision Log

- Selected `main...HEAD` as the comparison baseline (no alternate requested).
- Focused review on persistence, bundle application, compliance logging, and
  accessibility requirements from spec.md.
- Executed targeted Vitest suites across API, shared persistence, and web hooks
  to validate regression fixes.
- Confirmed telemetry and draft marker fixes resolve prior findings without
  introducing new regressions.

## Remediation Logging

No remediation tasks required — all historical findings have been addressed and
no new issues were identified.

---

**Review Completed**: 2025-10-05T21:49:28Z **Reviewer**: Claude Code Review v2.0
**Next Action**: Run full workspace lint/typecheck/test/build before merge and
monitor CI.

# Code Review Report: Section Draft Persistence (010-epic-2-story-5)

## Final Status: **Changes Requested**

## Resolved Scope

**Branch**: `010-epic-2-story-5` **Baseline**: `origin/main` **Diff Source**:
`origin/main...HEAD` **Review Target**: Section draft persistence, recovery,
compliance signalling, and bundled saves for Epic 2 Story 5 **Files Analyzed**:
103 changed files including TypeScript backend services/routes, shared
persistence utilities, React hooks/components, QA logging helpers, and
specification updates

**Resolved Scope Narrative**: The branch rewires client draft storage, backend
draft bundle APIs, and document-editor UX to persist section drafts locally,
recover them across sessions, prune by quota, and emit compliance telemetry.
Touch points span the IndexedDB draft store, React hooks/state, Express draft
routes/services, QA logging helpers, and documentation.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/specs/010-epic-2-story-5`
**Implementation Scope**:

- `packages/editor-persistence/src/draft-store.ts` — local draft persistence,
  quota pruning, logout purge hooks
- `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts` — draft
  rehydration, ARIA status, compliance messaging
- `apps/web/src/features/section-editor/hooks/use-section-draft.ts` — autosave,
  bundled save orchestration, draft retirement markers
- `apps/api/src/routes/documents.ts` — draft bundle/compliance endpoints with
  validation and telemetry logging
- `apps/api/src/services/drafts/draft-bundle.service.ts` — atomic bundle
  application, conflict handling, audit signals
- `apps/web/src/lib/telemetry/client-events.ts` & `apps/web/src/lib/logger.ts` —
  client telemetry instrumentation and log flushing

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/prd.md'
        context: 'Product requirements and editor workflow expectations.'
      - path: 'docs/architecture.md'
        context:
          'Backend architecture, service boundaries, and repository rules.'
      - path: 'docs/ui-architecture.md'
        context:
          'Frontend architecture, state patterns, and accessibility guardrails.'
      - path: 'docs/front-end-spec.md'
        context:
          'Front-end document editor behaviour, draft indicators, and
          accessibility cues.'
```

## Pre-Review Gates

| Gate                      | Status | Details                                                                                          |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| **Context Gate**          | Pass   | Plan, tasks, spec, research, contracts, and quickstart reviewed; dossier complete.               |
| **Change Intent Gate**    | Pass   | Changes align with Story 5 POR (client-only drafts, bundled saves, compliance logging).          |
| **Unknowns Gate**         | Pass   | No unresolved `[NEEDS CLARIFICATION]` markers in dossier files.                                  |
| **Separation of Duties**  | Info   | Repository requires peer review in CI; local review cannot confirm enforcement.                  |
| **Code Owners Gate**      | Info   | No CODEOWNERS present; approvals must be coordinated manually.                                   |
| **Quality Controls Gate** | Open   | Reviewer did not rerun `pnpm lint/typecheck/test`; request refreshed evidence after remediation. |
| **TDD Evidence Gate**     | Info   | New Vitest/Playwright suites exist, but rerun results not yet supplied for this iteration.       |

## Findings

### Active Findings (Current Iteration)

#### Finding F020: Draft telemetry leaks identifiers off-device

- **Category**: Privacy & Logging Controls
- **Severity**: Major
- **Confidence**: High
- **Impact**: Draft telemetry currently sends `draftKey`, `sectionPath`, and
  `authorId` to the server logging endpoint, breaching the client-only telemetry
  mandate and risking disclosure of unsaved work metadata.
- **Evidence**: `emitDraftSaved/emitDraftPruned/emitDraftConflict` invoke the
  shared browser logger (`apps/web/src/lib/telemetry/client-events.ts:11`) which
  flushes batches to `/api/v1/logs` (`apps/web/src/lib/logger.ts:194-214`)
  whenever remote logging is enabled.
- **Remediation**: Route draft persistence telemetry through a console-only
  channel or disable remote logging for these events; ensure no identifiers
  leave the client when reporting `draft.*` metrics and document the guardrail.
- **Source Requirement**: FR-012 — Telemetry must remain client-side without
  sending content or identifiers to the server.
- **Files**: `apps/web/src/lib/telemetry/client-events.ts:11`,
  `apps/web/src/lib/logger.ts:194`

#### Finding F021: Draft auto-discard markers delete unsaved work

- **Category**: Reliability & Data Integrity
- **Severity**: Major
- **Confidence**: High
- **Impact**: After any successful bundle save, localStorage markers permanently
  flag each draft key as cleared. Future drafts for the same section are
  auto-discarded on rehydrate with no user confirmation, violating the “never
  discard unsaved work” promise.
- **Evidence**: Bundle completions set `draft-store:cleared:${draftKey}`
  (`apps/web/src/features/section-editor/hooks/use-section-draft.ts:884`) while
  `useDraftPersistence` interprets the marker as “auto discard” and immediately
  removes matching drafts on reload
  (`apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:224-255`)
  with no corresponding cleanup when new edits occur.
- **Remediation**: Clear the cleared/recent-clean markers whenever a new draft
  snapshot is saved (or stop auto-discarding on marker presence) so recovered
  drafts always require explicit user confirmation; add tests covering rehydrate
  after post-save edits.
- **Source Requirement**: FR-001 — Persist unsaved section edits for the
  signed-in user until saved or explicitly discarded.
- **Files**:
  `apps/web/src/features/section-editor/hooks/use-section-draft.ts:884`,
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:224`

### Historical Findings Log

- [Resolved 2025-10-03] F001–F019 — Draft bundle scope, retention logging, and
  telemetry follow-ups (reported 2025-10-02 by Claude Code Review v2.0).
  Resolution tracked in `specs/010-epic-2-story-5/tasks.md` Phase 4.R with
  evidence linked to updated tests and docs.

## Strengths

- Bundled saves remain atomic:
  `DraftBundleRepositoryImpl.applyBundleSectionsAtomically` wraps section
  updates in a transaction to guarantee all-or-nothing application.
- Draft store resilience: quota handling retries prune author-scoped drafts
  before surfacing errors, preserving newer work while respecting browser
  limits.

## Outstanding Clarifications

- [NEEDS CLARIFICATION: —]
- [NEEDS CLARIFICATION: —]
- [NEEDS CLARIFICATION: —]

## Control Inventory

| Control Domain         | Implementation                                                                                                            | Status      | Reference                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| **Authentication**     | Clerk user session wrappers in the document editor ensure saved drafts remain author-scoped.                              | Operational | `apps/web/src/lib/clerk-client.tsx`                                                   |
| **Logging**            | Draft compliance warnings flow through `packages/qa/src/compliance/drafts.ts`, but telemetry currently leaks identifiers. | At Risk     | `packages/qa/src/compliance/drafts.ts`; `apps/web/src/lib/telemetry/client-events.ts` |
| **Error Handling**     | Document routes centralise failures via `sendErrorResponse`, returning structured diagnostics.                            | Operational | `apps/api/src/routes/documents.ts`                                                    |
| **Repository Pattern** | Draft bundle repository mediates document/section access and conflict checks.                                             | Operational | `apps/api/src/services/drafts/draft-bundle.repository.ts`                             |
| **Input Validation**   | Zod schemas guard draft bundle payloads before hitting services.                                                          | Operational | `apps/api/src/routes/documents.ts`                                                    |
| **State Management**   | Zustand draft state store coordinates rehydrated drafts; current marker handling risks data loss.                         | At Risk     | `apps/web/src/features/document-editor/stores/draft-state.ts`                         |
| **Performance**        | Draft rehydration remains memoized with Intl timestamp formatting to meet ~3s guidance.                                   | Operational | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`                |

## Quality Signal Summary

### Linting Results

- **Status**: Not Evaluated (request evidence)
- **Warnings**: N/A warnings, N/A errors
- **Key Issues**:
  - Reviewer did not rerun lint; provide fresh `pnpm lint` output after fixes.
  - No new lint data supplied for this iteration.
  - —

### Type Checking

- **Status**: Not Evaluated (request evidence)
- **Results**: Awaiting updated `pnpm typecheck` run post-remediation.

### Test Results

- **Status**: Not Evaluated (request evidence)
- **Results**: No current `pnpm test` / Playwright outputs supplied; rerun after
  addressing findings.
- **Root Cause**: Pending remediation; automation not rerun during review.

### Build Status

- **Status**: Not Evaluated (request evidence)
- **Details**: Provide refreshed `pnpm build` evidence alongside remediation PR.

## Dependency Audit Summary

- **Baseline Severity Counts**: Not assessed this iteration.
- **Current Severity Counts**: Not assessed — requester to supply
  SBOM/vulnerability diff after fixes.
- **New CVEs Identified**: Not evaluated.
- **Deprecated Packages**: Not evaluated.
- **Justifications / Version Currency**: Pending updated dependency audit
  results.

## Requirements Coverage Table

| Requirement | Summary                                                              | Implementation Evidence                                                                                                                   | Validating Tests                                                                                                                            | Linked Findings / Clarifications |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **FR-001**  | Persist unsaved section edits per author until explicit save/discard | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts` | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`; `apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts` | F021                             |
| **FR-009**  | Retain drafts indefinitely until author acts                         | `packages/editor-persistence/src/draft-store.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                       | `packages/editor-persistence/tests/draft-store.test.ts`; `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`             | F021                             |
| **FR-012**  | Keep draft telemetry client-side without identifiers                 | `apps/web/src/lib/telemetry/client-events.ts`; `apps/web/src/lib/logger.ts`                                                               | _No targeted tests supplied_                                                                                                                | F020                             |

## Requirements Compliance Checklist

| Requirement Group             | Status            | Notes                                                                                                         |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | At Risk           | Auto-discard behaviour conflicts with the “never discard unsaved work” mandate in spec/constitution guidance. |
| **SOC 2 Authentication**      | Pass              | Auth boundaries unchanged; Clerk gating still enforced.                                                       |
| **SOC 2 Logging**             | Changes Requested | Draft telemetry currently exports identifiers off-device (see F020).                                          |
| **Security Controls**         | Changes Requested | Privacy leak through telemetry breaks secure logging expectations.                                            |
| **Code Quality**              | Changes Requested | Data-loss logic requires rework; additional regression tests needed.                                          |
| **Testing Requirements**      | Pending           | Await rerun of lint/typecheck/test/build once remediation lands.                                              |

## Decision Log

- Confirmed comparison range `origin/main...HEAD`; no alternate baselines
  requested.
- Focused review on draft persistence flows, telemetry, and compliance logging
  per spec requirements.
- Identified telemetry leakage caused by routing draft events through remote
  logger.
- Detected auto-discard marker behaviour that silently drops future drafts,
  violating FR-001/FR-009.
- Deferred lint/typecheck/test/build execution pending remediation to avoid
  burning cycles on known blockers.

## Remediation Logging

### Remediation F020

- **Context**: Draft telemetry currently posts identifiers to `/api/v1/logs`,
  violating client-only telemetry rules.
- **Control Reference**: Logging controls
  (`packages/qa/src/compliance/drafts.ts`; browser logger in
  `apps/web/src/lib/logger.ts`).
- **Actions**: Rework draft telemetry to avoid the shared remote logger (e.g.,
  scoped console logger, mask identifiers, or disable remote flush for draft
  events); add regression test or manual verification note ensuring no network
  requests fire for draft telemetry.
- **Verification**: Provide HAR/log capture demonstrating draft events stay
  in-browser plus refreshed lint/typecheck/test/build results.

### Remediation F021

- **Context**: LocalStorage “cleared” markers trigger automatic draft deletion
  after save, causing data loss on subsequent reloads.
- **Control Reference**: Draft state management
  (`apps/web/src/features/document-editor/stores/draft-state.ts`; draft
  persistence utilities).
- **Actions**: Clear or scope markers when new edits occur, or require explicit
  confirmation before discard; add tests covering rehydrate after post-save
  edits to ensure drafts persist until the author discards them.
- **Verification**: Updated unit/E2E coverage proving drafts remain available
  after bundle saves plus rerun quality gates.

---

**Review Completed**: 2025-10-07T12:00:00Z **Reviewer**: Claude Code Review v2.0
**Next Action**: Remediate F020/F021, rerun quality gates (`pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`), and resubmit evidence for
verification.

---

# Code Review Report: Section Draft Persistence (010-epic-2-story-5)

## Final Status: **Review Pending**

## Resolved Scope

**Branch**: `010-epic-2-story-5` **Baseline**: `main` **Diff Source**:
`main...HEAD` **Review Target**: End-to-end draft persistence, recovery, and
compliance logging for Epic 2 Story 5 **Files Analyzed**: 103 changed files
including TypeScript backend services/routes, shared persistence library
updates, React hooks/components, QA logging utilities, and supporting docs/specs

**Resolved Scope Narrative**: Feature branch refactors draft persistence across
the shared library, Express API, and React editor to keep local work safe,
bundle multi-section saves atomically, and surface compliance/telemetry cues.
Changes touch the IndexedDB-backed draft store, document-editor hooks/stores,
draft status UI, backend draft-bundle/compliance routes, QA helpers, and story
documentation.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/specs/010-epic-2-story-5`
**Implementation Scope**:

- `packages/editor-persistence/src/draft-store.ts` for keyed draft retention,
  pruning, and logout purge hooks
- `apps/web/src/features/section-editor/hooks/use-section-draft.ts` coordinating
  autosave, bundled saves, and compliance escalation
- `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`
  rehydrating drafts with ARIA status + logout handling
- `apps/api/src/routes/documents.ts` plus draft bundle/compliance endpoints with
  validation and telemetry logging
- `apps/api/src/services/drafts/draft-bundle.service.ts` and repository
  enforcing atomic save semantics and scope checks
- Documentation and QA updates (`docs/architecture.md`,
  `packages/qa/src/index.ts`, feature plan/tasks) aligning behaviour and
  telemetry narratives

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/prd.md'
        context: 'Product requirements and editor workflow expectations.'
      - path: 'docs/architecture.md'
        context:
          'Backend architecture, service boundaries, and repository rules.'
      - path: 'docs/ui-architecture.md'
        context:
          'Frontend architecture, state patterns, and accessibility guardrails.'
      - path: 'docs/front-end-spec.md'
        context:
          'UI/UX behaviour, draft indicators, and accessibility cues for the
          editor.'
```

## Pre-Review Gates

| Gate                      | Status | Details                                                                                                           |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| **Context Gate**          | Pass   | Plan, tasks, spec, research, contracts, and quickstart all present and reviewed.                                  |
| **Change Intent Gate**    | Pass   | Branch changes align with Story 5 POR (draft persistence, bundled saves, compliance logging).                     |
| **Unknowns Gate**         | Pass   | No unresolved `[NEEDS CLARIFICATION]` markers detected in dossier documents.                                      |
| **Separation of Duties**  | Info   | Local review cannot confirm repo enforcement; assume protected branches enforce peer review in CI.                |
| **Code Owners Gate**      | Info   | No CODEOWNERS file in repo; owner approvals must be managed manually per process.                                 |
| **Quality Controls Gate** | Pass   | `pnpm format`, `pnpm lint:fix`, and `pnpm lint` reran clean after refreshing the manual save dependencies.        |
| **TDD Evidence Gate**     | Pass   | New Vitest suites cover draft store, draft bundle service, React hooks, and E2E flows; Playwright scenario added. |

## Findings

None. Finding F019 was resolved by adding the retention policy dependency to
`manualSave` and extending hook coverage to assert compliance warnings after an
asynchronous policy load.

## Strengths

- Atomic bundle application:
  `DraftBundleRepositoryImpl.applyBundleSectionsAtomically` wraps section
  updates in a single transaction, ensuring all-or-nothing saves
  (`apps/api/src/services/drafts/draft-bundle.repository.ts:66`).
- Robust local persistence: new draft-store tests cover quota pruning,
  multi-attempt retries, and logout cleanup
  (`packages/editor-persistence/tests/draft-store.test.ts:1`).
- Accessibility + telemetry: `DraftStatusBadge` exposes visible timestamps and
  ARIA announcements while emitting telemetry events without content leakage
  (`apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx:1`).

## Outstanding Clarifications

- [NEEDS CLARIFICATION: None noted during this pass]
- [NEEDS CLARIFICATION: —]
- [NEEDS CLARIFICATION: —]

## Control Inventory

| Control Domain         | Implementation                                                                         | Status      | Reference                                                     |
| ---------------------- | -------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| **Authentication**     | Clerk-authenticated Express routes with test harness seeding                           | Established | `apps/api/src/middleware/test-auth.ts`                        |
| **Logging**            | Pino logger wired through service container, bundle telemetry, and compliance warnings | Established | `apps/api/src/services/container.ts`                          |
| **Error Handling**     | Centralized `sendErrorResponse` helper returns structured errors with request IDs      | Established | `apps/api/src/routes/documents.ts`                            |
| **Repository Pattern** | Section/document repositories encapsulate DB access with transaction support           | Established | `apps/api/src/services/drafts/draft-bundle.repository.ts`     |
| **Input Validation**   | Zod schemas guard draft bundle payloads and compliance inputs                          | Established | `apps/api/src/routes/documents.ts`                            |
| **State Management**   | Zustand stores coordinate draft status and rehydration gates on the client             | Established | `apps/web/src/features/document-editor/stores/draft-state.ts` |
| **Performance**        | Draft store rehydrate path keeps operations local with quota events                    | Established | `packages/editor-persistence/src/draft-store.ts`              |

## Quality Signal Summary

### Linting Results

- **Status**: Pass
- **Commands**: `pnpm format`, `pnpm lint:fix`, `pnpm lint`
- **Notes**: No warnings or errors remain after refreshing the manual save
  dependency list.

### Type Checking

- **Status**: Pass
- **Results**: `pnpm typecheck` succeeded across 10 workspaces
  (`turbo typecheck --force`).

### Test Results

- **Status**: Fail
- **Results**: `pnpm test:quick` exits with failures in
  `apps/api/tests/contract/assumption-session.contract.test.ts` (404 responses
  for session routes) while all web/editor suites remain green.
- **Notes**: The failing contract tests predate this remediation; additional API
  work is required to restore expected responses.

### Build Status

- **Status**: Not Run (Review)
- **Details**: `pnpm build` not executed during this audit; run before merge for
  full gate coverage.

## Dependency Audit Summary

- **Baseline Severity Counts**: Not evaluated during this pass.
- **Current Severity Counts**: Not evaluated; `pnpm-lock.yaml` shows extensive
  churn — rerun SBOM/vulnerability scan before release.
- **New CVEs Identified**: Not assessed.
- **Deprecated Packages**: Not assessed in this review.
- **Justifications / Version Currency**: Review pending after compliance fix.

## Requirements Coverage Table

| Requirement | Summary                                                                        | Implementation Evidence                                                                                                                                                       | Validating Tests                                                                                                                            | Linked Findings / Clarifications |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **FR-001**  | Persist unsigned drafts per author until saved/discarded                       | `packages/editor-persistence/src/draft-store.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                                           | `packages/editor-persistence/tests/draft-store.test.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`             | —                                |
| **FR-004**  | Bundle all draft sections into single save with validation                     | `apps/api/src/services/drafts/draft-bundle.service.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                                     | `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`, `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`                | —                                |
| **FR-005**  | Restore outstanding drafts on reload before applying server updates            | `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`, `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx`                 | `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`, `apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts` | —                                |
| **FR-008**  | Prune oldest drafts and notify when quota hits                                 | `packages/editor-persistence/src/draft-store.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                                                           | `packages/editor-persistence/tests/draft-store.test.ts`, `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`             | —                                |
| **FR-014**  | Log compliance warnings when client-only drafts conflict with retention policy | `apps/web/src/features/section-editor/hooks/use-section-draft.ts`, `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`, `apps/api/src/routes/documents.ts` | `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`, `apps/web/tests/integration/section-editor/manual-save.test.ts`     | —                                |

## Requirements Compliance Checklist

| Requirement Group             | Status         | Notes                                                                                                      |
| ----------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Constitutional Principles** | Pass           | Library-first, TDD, and CLI mandates remain satisfied after the compliance fix.                            |
| **SOC 2 Authentication**      | Pass           | No auth regressions detected; authenticated routes unchanged.                                              |
| **SOC 2 Logging**             | Pass           | Compliance warnings now trigger after async policy load via updated `manualSave` dependencies.             |
| **Security Controls**         | Pass           | Payload validation and scope checks intact.                                                                |
| **Code Quality**              | Pass           | Lint suite clean following the dependency update and hook coverage adjustments.                            |
| **Testing Requirements**      | Review Pending | `pnpm test:quick` fails in `apps/api` assumption-session contract tests (404 responses) unrelated to F019. |

## Decision Log

- Selected `main...HEAD` as comparison baseline (no override provided).
- Reran governance gates (`pnpm format`, `pnpm lint:fix`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test:quick`); lint/typecheck succeeded, while
  `pnpm test:quick` still fails in `apps/api` assumption-session contract tests
  (404 responses) outside the section-draft scope.
- Deferred dependency severity reconciliation pending follow-up on the
  assumption-session contract failures.

## Remediation Logging

### Remediation F019

- **Context**: Manual save closure previously omitted `retentionPolicy`, so
  compliance warnings never re-triggered after asynchronous policy load.
- **Control Reference**: QA compliance logging helper
  (`packages/qa/src/index.ts`) expects accurate retention signals.
- **Actions**: Added `retentionPolicy` to the `manualSave` dependency array,
  introduced a regression test validating compliance warnings after delayed
  policy resolution, and reran lint/typecheck suites.
- **Verification**: `pnpm format`, `pnpm lint:fix`, `pnpm lint`, and
  `pnpm typecheck` all succeeded; `pnpm test:quick` currently fails in
  assumption-session contract tests that predate this remediation.

---

**Review Completed**: 2025-10-04T12:50:00Z **Reviewer**: Claude Code Review v2.0
**Next Action**: Investigate and stabilize `apps/api` assumption-session
contract tests so `pnpm test:quick` completes without errors.
