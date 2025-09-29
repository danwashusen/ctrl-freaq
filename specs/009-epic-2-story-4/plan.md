---
description: 'Implementation plan template for feature development'
---

# Implementation Plan: New Section Content Flow

**Branch**: `009-epic-2-story-4` | **Date**: 2025-09-29 | **Spec**:
[spec.md](/specs/009-epic-2-story-4/spec.md) **Input**: Feature specification
from `/specs/009-epic-2-story-4/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by
other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

New Section Content Flow (Epic 2, Story 4) enforces an assumption-first
experience whenever a section has no approved content. The flow guides engineers
through prioritized prompts, records explicit overrides when they skip ahead,
blocks conflicts with document-level decisions, and preserves every generated
draft proposal so reviewers can audit rationale later. Implementation extends
the existing document editor and assumption engine with session tracking,
override gating, and multi-proposal history available to frontend and API
clients.

## Technical Context

**Language/Version**: TypeScript 5.4.x, Node.js 22.x runtime, React 18.3.x  
**Primary Dependencies**: Vercel AI SDK, Milkdown editor, TanStack Query, Clerk
auth, `@ctrl-freaq/editor-persistence`, `@ctrl-freaq/shared-data`  
**Storage**: SQLite via `@ctrl-freaq/shared-data` with session artefacts cached
client-side; IndexedDB for draft persistence  
**Testing**: Vitest + React Testing Library, Playwright E2E, contract suites in
`apps/api/tests/contract`  
**Target Platform**: Web (React) with Express API served locally during MVP  
**Project Type**: web (React frontend + Express backend inside pnpm monorepo)  
**Performance Goals**: Assumption checklist renders in <300 ms after entry;
draft proposal generation streams first tokens in <400 ms; override check
latency <150 ms per prompt  
**Constraints**: Overrides block submission until resolved; conflict responses
must align with document-level decisions; multi-proposal history retained per
session without exceeding 10 proposals  
**Scale/Scope**: Expect up to 20 assumptions per section, three collaborators
per document session, and retention of 5–10 draft proposals per assumption
session  
**Feature Context**: Epic 2, Story 4 — New Section Content Flow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Library-First Architecture**: ✅ PASS

- Extend existing packages (`@ctrl-freaq/editor-core`,
  `@ctrl-freaq/editor-persistence`, `@ctrl-freaq/shared-data`) with
  assumption-session utilities instead of embedding logic in apps.

**CLI Interface Standard**: ✅ PASS

- Any new persistence or assumption processors expose CLI entry points via the
  owning package (e.g., `pnpm --filter @ctrl-freaq/editor-persistence cli`)
  mirroring current tooling.

**Test-First Development**: ✅ PASS

- Plan mandates contract specs, data model validation tests, and Playwright
  flows before implementation; gauntlet (`pnpm lint`, `pnpm typecheck`,
  `pnpm test`) remains non-negotiable.

**Integration Testing & Observability**: ✅ PASS

- Add structured logging for assumption sessions capturing `requestId`,
  `sessionId`, `action`, and `overrideStatus`, emit
  `assumption_session.completed` and `assumption_session.latency_ms` metrics,
  and extend existing Vitest + Playwright coverage to new flows.

**Simplicity & Versioning**: ✅ PASS

- Reuse current section lifecycle and patch engine, avoid introducing new
  storage backends, and stay within MVP versioning rules.

## Project Structure

### Documentation (this feature)

```
specs/009-epic-2-story-4/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── assumption-session.yaml
```

### Source Code (repository root)

```
apps/
├── api/
│   ├── src/modules/document-editor/
│   │   ├── assumption-session/
│   │   │   ├── entities/
│   │   │   ├── services/
│   │   │   └── routes/
│   │   ├── shared/
│   │   └── index.ts
│   ├── src/lib/
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── fixtures/
├── web/
│   ├── src/features/document-editor/
│   │   ├── assumptions-flow/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── stores/
│   │   ├── services/
│   │   ├── lib/
│   │   └── tests/
│   └── tests/
│       ├── integration/
│       └── e2e/
packages/
├── editor-core/
│   ├── src/assumptions/
│   └── src/testing/
├── editor-persistence/
│   └── src/assumption-sessions/
├── shared-data/
└── template-resolver/
```

**Structure Decision**: Extend existing document editor modules in `apps/web`
and `apps/api`, backed by shared libraries for assumption sessions in
`packages/editor-core` and `packages/editor-persistence`, keeping everything
CLI-accessible per the constitution.

## Phase 0: Outline & Research

1. **Research topics** derived from Technical Context:
   - Prioritise assumption prompts using template metadata and recent document
     state without exceeding the 300 ms render goal.
   - Determine how override decisions and proposal history persist across client
     IndexedDB and backend SQLite while preserving CLI access in
     `@ctrl-freaq/editor-persistence`.
   - Define resilient AI draft fallback behaviour so the flow stays usable when
     proposal generation fails or returns low confidence scores.

2. **Research tasks** for `research.md` (Phase 0 output):
   - Task: "Research assumption prioritisation heuristics for New Section
     Content Flow."
   - Task: "Research override persistence model syncing IndexedDB, SQLite, and
     CLI tooling."
   - Task: "Research AI draft fallback patterns for assumption-driven authoring"
     (manual editing, retry limits, reviewer escalation).

3. **Deliverable format**:
   - Record each finding as Decision, Rationale, and Alternatives considered.
   - Link decisions back to spec clarifications (override gating, conflict
     resolution, multi-proposal retention).
   - Confirm no residual unknowns before Phase 1 begins.

**Output**: `research.md` summarising the finalised approach with zero open
questions.

## Phase 1: Design & Contracts

_Prerequisite: research.md complete_

1. **Data model** → `data-model.md`:
   - Detail `SectionAssumption`, `AssumptionSession`, and `DraftProposal`
     structures with status enums and relationships to documents/sections.
   - Capture override metadata (skipped prompts) and alignment checks against
     document-level decisions.

2. **API contracts** → `/contracts/assumption-session.yaml` + supporting files:
   - Start session for blank sections; respond to prompts (answer, defer,
     escalate, skip with override flag); request proposal generation; fetch
     proposal history.
   - Define error envelopes for conflicts and unresolved overrides.

3. **Contract tests** →
   `apps/api/tests/contract/assumption-session.contract.test.ts`:
   - Assert request/response schemas, override gating, and conflict blocking
     behaviours remain enforced before submitting drafts.

4. **Quickstart** → `quickstart.md`:
   - Outline Vitest + Playwright commands to exercise assumption flow, including
     setup of fixture section, answering prompts, generating proposals, and
     verifying final submission is blocked until overrides resolved.

**Output**: data-model.md, contracts/, quickstart.md, and failing contract tests
ready for task planning.

## Phase 2: Task Planning Approach

_This section informs the upcoming `/tasks` run — do not create tasks here_

**Task Generation Strategy**:

- Seed from `/templates/tasks-template.md`.
- Map each contract endpoint (start session, respond to prompt, generate
  proposal, list proposals) to a contract test task [P].
- Map each entity (`SectionAssumption`, `AssumptionSession`, `DraftProposal`) to
  persistence/model tasks [P].
- Derive integration/UI tasks from acceptance scenarios (skip override, decision
  conflict, multi-proposal review) and Playwright fixtures.
- Include validation tasks for logging/telemetry requirements and CLI tooling
  updates.

**Ordering Strategy**:

- TDD first: contract + unit tests before implementation.
- Persistence and services before frontend UI, followed by Playwright coverage.
- Mark tasks touching independent modules (`packages/*` vs `apps/web`) as [P] to
  highlight parallelism.

**Estimated Output**: ≈28 ordered tasks captured in `tasks.md` by `/tasks`.

**IMPORTANT**: Execution deferred to the `/tasks` command.

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional
principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance
validation)

## Complexity Tracking

No constitutional deviations identified; keep this section empty unless future
changes require a formally documented exception.

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---

_Based on Constitution v2.1.1 - See `SPEC_KIT_CONFIG.constitution.path`_
