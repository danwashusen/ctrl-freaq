# Code Review Report: New Section Content Flow (009-epic-2-story-4)

## Final Status: **Changes Requested** _(Approved | Changes Requested | Blocked: Missing Context | Blocked: Scope Mismatch | Needs Clarification | TDD Violation | Quality Controls Violation | Security Gate Failure | Privacy Gate Failure | Supply Chain Violation | Dependency Vulnerabilities | Deprecated Dependencies | Review Pending)_

## Resolved Scope

**Branch**: `009-epic-2-story-4` **Baseline**: `main` **Diff Source**:
`main..009-epic-2-story-4` **Review Target**: Scope-driven review for the
assumption-first drafting flow **Files Analyzed**: 58 changed files including
TypeScript services/routes, shared-data models & repositories, persistence
stores, React UI, SQL migrations, YAML contracts, and Markdown docs

**Resolved Scope Narrative**: Audited the end-to-end assumption-session feature
set: new SQLite models, repositories, and migrations; Express services and
routing; persistence bridges; React/TanStack integration; and the accompanying
contract, integration, E2E, performance, and documentation updates required for
Epic 2 Story 4.

**Feature Directory**: `specs/009-epic-2-story-4` **Implementation Scope**:

- `apps/api/src/modules/section-editor/services/assumption-session.service.ts`
  adds session lifecycle, override gating, and telemetry
- `apps/api/src/routes/sections.ts` exposes session start/respond/proposal
  endpoints behind existing middleware
- `packages/shared-data/src/models/*` and
  `.../repositories/assumption-session.repository.ts` persist prompts, sessions,
  and proposals
- `packages/editor-persistence/src/assumption-sessions/*` stores offline
  snapshots and CLI accessors
- `apps/web/src/features/document-editor/assumptions-flow/*` integrates
  checklist UI, hooks, and proposal history into the editor
- Contract, integration, E2E, performance suites plus docs (`spec.md`,
  `quickstart.md`, `architecture.md`, `front-end-spec.md`) describe and exercise
  the flow

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: 'CONSTITUTION.md'
  review:
    documents:
      - path: 'docs/prd.md'
        context:
          'Epic 2 product requirements outlining assumption-first drafting
          expectations.'
      - path: 'docs/architecture.md'
        context:
          'Backend architecture and observability mandates to preserve when
          extending section services.'
      - path: 'docs/front-end-spec.md'
        context:
          'Frontend UX patterns and accessibility rules for the document editor.'
```

## Pre-Review Gates

| Gate                      | Status | Details                                                                                             |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| **Context Gate**          | Pass   | Spec, plan, research, tasks, quickstart, and contracts present under `specs/009-epic-2-story-4/`.   |
| **Change Intent Gate**    | Pass   | Code matches POR: implement assumption discovery, overrides, proposal history.                      |
| **Unknowns Gate**         | Pass   | No `[NEEDS CLARIFICATION]` markers remain in dossier materials.                                     |
| **Separation of Duties**  | Info   | Local repo cannot confirm hosted approval policies; verify in PR.                                   |
| **Code Owners Gate**      | Info   | CODEOWNERS file not present; rely on platform enforcement.                                          |
| **Quality Controls Gate** | Pass   | No quality-control configs modified; lint/typecheck/test/build rerun locally (see Quality Signals). |
| **TDD Evidence Gate**     | Fail   | FR-003/FR-004 lack failing tests or implementation coverage; see Findings F4 and F5.                |

## Findings

### Finding F4: Document-level decision conflicts are never enforced

- **Category**: Functional Completeness
- **Severity**: Major
- **Confidence**: High
- **Impact**: FR-003 requires blocking section answers that contradict
  document-level decisions. `respondToAssumption` simply updates the prompt
  (`apps/api/src/modules/section-editor/services/assumption-session.service.ts:275`)
  without consulting document decisions or populating `conflictDecisionId`.
  Users can record answers that violate upstream choices and still proceed once
  overrides are cleared, breaking the governance loop reviewers rely on.
- **Evidence**: No call sites load document decisions; repository updates never
  set `conflictDecisionId/conflictResolvedAt`; contract tests
  (`apps/api/tests/contract/assumption-session.contract.test.ts:1`) omit
  conflict cases. Spec mandates this behaviour
  (`specs/009-epic-2-story-4/spec.md:104-107`).
- **Remediation**: Inject document-decision context (e.g., via template resolver
  or decision repository), compare responses before persisting, and return a 409
  with reconciliation instructions. Extend contract/service tests to cover
  conflicted decisions and ensure sessions remain blocked until resolved.
- **Source Requirement**: FR-003
- **Files**:
  apps/api/src/modules/section-editor/services/assumption-session.service.ts:275,
  specs/009-epic-2-story-4/spec.md:104

### Finding F5: Assumption summary omits answers, risks, and escalations

- **Category**: Functional Completeness
- **Severity**: Major
- **Confidence**: High
- **Impact**: FR-004 expects a summary that captures chosen answers, outstanding
  risks, and escalations. `buildSummaryMarkdown` returns a static bullet list of
  prompt headings
  (`apps/api/src/modules/section-editor/services/assumption-session.service.ts:625`)
  and the summary never updates as the session progresses. Reviewers cannot
  audit decisions or overrides from the stored summary, undermining transparency
  (also weakens FR-007 history expectations).
- **Evidence**: Session creation seeds summary once and no later updates occur.
  Service tests only assert the checklist heading
  (`apps/api/src/modules/section-editor/services/assumption-session.service.test.ts:68`),
  leaving answer/risk content unverified. Requirement text at
  `specs/009-epic-2-story-4/spec.md:108-109` demands richer detail.
- **Remediation**: Recompute `summaryMarkdown` whenever prompts change to
  include answer text/labels, override justifications, escalations, and
  unresolved counts. Add unit/integration tests asserting summaries capture
  answers and flagged risks.
- **Source Requirement**: FR-004, FR-007
- **Files**:
  apps/api/src/modules/section-editor/services/assumption-session.service.ts:625,
  specs/009-epic-2-story-4/spec.md:108

## Strengths

- Template-driven prompt provider
  (`apps/api/src/modules/section-editor/services/template-assumption-prompt.provider.ts`)
  gracefully falls back with structured logging when metadata is missing.
- Contract, integration, and E2E suites exercise overrides, resume flows, and
  latency expectations
  (`apps/api/tests/contract/assumption-session-escalation.contract.test.ts`,
  `apps/web/tests/integration/document-editor/assumptions-resume.test.ts`,
  `apps/web/tests/performance/assumptions-timing.performance.test.ts`).
- Persistence layer coherently mirrors session state across SQLite and IndexedDB
  (`packages/shared-data/src/repositories/assumption-session.repository.ts`,
  `packages/editor-persistence/src/assumption-sessions/session-store.ts`).

## Outstanding Clarifications

- [NEEDS CLARIFICATION: None]

## Control Inventory

| Control Domain         | Implementation                                                           | Status      | Reference                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**     | Assumption endpoints reuse `AuthenticatedRequest` guard                  | Existing    | `apps/api/src/routes/sections.ts:1421`                                                                                                                                |
| **Logging**            | Session lifecycle logs emit requestId/sessionId/action + latency metrics | Implemented | `apps/api/src/modules/section-editor/services/assumption-session.service.ts:240`                                                                                      |
| **Error Handling**     | Routes translate `SectionEditorServiceError` into structured API errors  | Implemented | `apps/api/src/routes/sections.ts:1458`                                                                                                                                |
| **Repository Pattern** | Dedicated repository manages prompts, counters, proposal history         | Implemented | `packages/shared-data/src/repositories/assumption-session.repository.ts:1`                                                                                            |
| **Input Validation**   | New Zod schemas validate start/respond/proposal payloads                 | Implemented | `apps/api/src/modules/section-editor/validation/section-editor.schema.ts:178`                                                                                         |
| **State Management**   | React hook + persistence snapshot restore assumption flow on resume      | Implemented | `apps/web/src/features/document-editor/assumptions-flow/hooks/use-assumptions-flow.ts:21`                                                                             |
| **Performance**        | Latency telemetry logged per session action; proposal store caps history | Implemented | `apps/api/src/modules/section-editor/services/assumption-session.service.ts:417`, `apps/web/src/features/document-editor/assumptions-flow/stores/proposal-store.ts:1` |

## Quality Signal Summary

### Linting Results

- **Status**: Pass (`pnpm lint`)
- **Warnings**: 0 warnings, 0 errors
- **Key Issues**:
  - None observed
  - —
  - —

### Type Checking

- **Status**: Pass (`pnpm typecheck`)
- **Results**: All workspace TypeScript builds completed without errors.

### Test Results

- **Status**: Pass (`pnpm test`)
- **Results**: 0 of N/A tests failing (0% failure rate)
- **Root Cause**: N/A — gauntlet (Vitest + Playwright) succeeded.

### Build Status

- **Status**: Pass (`pnpm build`)
- **Build Details**: Vite emitted chunk-size warnings for document-editor
  bundles; no failures.

## Dependency Audit Summary

- **Baseline Severity Counts**: Not re-evaluated this pass.
- **Current Severity Counts**: No dependency changes detected; assume parity
  with baseline.
- **New CVEs Identified**: None observed.
- **Deprecated Packages**: None introduced.
- **Justifications / Version Currency**: No package upgrades in scope; audit can
  rely on existing controls.

## Requirements Coverage Table

| Requirement | Summary                                             | Implementation Evidence                                                                  | Validating Tests                                                                    | Linked Findings / Clarifications |
| ----------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| **FR-001**  | Detect blank sections and launch assumption flow    | `apps/web/src/features/document-editor/components/document-editor.tsx:146`               | `apps/web/tests/e2e/document-editor/assumptions-override.e2e.ts:1`                  |                                  |
| **FR-002**  | Prioritised template checklist with override gating | `apps/api/src/modules/section-editor/services/template-assumption-prompt.provider.ts:17` | `apps/api/tests/contract/assumption-session.contract.test.ts:1`                     |                                  |
| **FR-003**  | Block conflicts with document-level decisions       | —                                                                                        | —                                                                                   | F4                               |
| **FR-004**  | Summarise answers, risks, escalations               | —                                                                                        | —                                                                                   | F5                               |
| **FR-005**  | Draft proposal cites assumptions with rationale     | `apps/api/src/modules/section-editor/services/assumption-session.service.ts:583`         | `apps/api/src/modules/section-editor/services/assumption-session.service.test.ts:1` |                                  |
| **FR-006**  | Reopen checklist from draft review screen           | `apps/web/src/features/document-editor/components/document-editor.tsx:855`               | `apps/web/tests/integration/document-editor/assumptions-resume.test.ts:1`           |                                  |
| **FR-007**  | Persist decisions, proposals, history               | `packages/shared-data/src/repositories/assumption-session.repository.ts:1`               | `apps/web/tests/integration/document-editor/proposal-history.test.ts:1`             |                                  |

## Requirements Compliance Checklist

| Requirement Group             | Status            | Notes                                                             |
| ----------------------------- | ----------------- | ----------------------------------------------------------------- |
| **Constitutional Principles** | Pass              | Library-first, CLI exposure, and observability preserved.         |
| **SOC 2 Authentication**      | Pass              | Existing auth guard protects assumption endpoints.                |
| **SOC 2 Logging**             | Pass              | Structured logs with requestId/sessionId emitted for new actions. |
| **Security Controls**         | Pass              | Zod validation and DI container reuse align with policy.          |
| **Code Quality**              | Changes Requested | FR-003/FR-004 gaps block compliance (see F4, F5).                 |
| **Testing Requirements**      | At Risk           | Add regression coverage once findings are remediated.             |

## Decision Log

- Identified absence of document-decision reconciliation in the new service flow
  (logged as F4).
- Noted summary Markdown remains static, violating audit expectations (logged as
  F5).
- Confirmed lint/typecheck/test/build gauntlet ran clean on 2025-09-29; will
  require re-run after fixes.

## Remediation Logging

### Remediation R1

- **Context**: F4 – conflict gating missing in assumption session updates.
- **Control Reference**: FR-003 / Input Validation & Governance Controls
- **Actions**: Load document-level decisions when responding, reject conflicting
  answers with explanatory payloads, and document the decision snapshot linkage.
  Add contract/unit tests covering conflict resolution.
- **Verification**: New tests fail prior to fix and pass after, with API
  returning 409 + decision metadata.

### Remediation R2

- **Context**: F5 – assumption summary omits answers/risks/escalations.
- **Control Reference**: FR-004 / Audit History Control
- **Actions**: Recompute `summaryMarkdown` on prompt updates to include answer
  labels, override counts, and escalations; extend service/integration tests to
  assert summary fidelity.
- **Verification**: Updated tests confirm summaries include answers and
  outstanding risks for multi-state prompts.

---

**Review Completed**: 2025-09-29 **Reviewer**: Claude Code Review v2.0 **Next
Action**: Address F4 and F5, extend automated coverage, rerun
lint/typecheck/test/build, and request re-review.
