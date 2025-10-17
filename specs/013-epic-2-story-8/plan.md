# Implementation Plan: Quality Gates Integration

**Branch**: `013-epic-2-story-8` | **Date**: 2025-10-13 | **Spec**:
`/specs/013-epic-2-story-8/spec.md` **Input**: Feature specification from
`/specs/013-epic-2-story-8/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver section-level quality gate feedback, a document-quality dashboard, and
automated traceability sync so authors receive actionable blockers within two
seconds, document owners can re-run and unblock publishing from a single view,
and compliance reviewers see up-to-date requirement links backed by telemetry
and audit logging.

## Technical Context

**Language/Version**: TypeScript 5.x (pnpm monorepo)  
**Primary Dependencies**: React 19, Express 5, TanStack Query, Zustand,
packages/qa, packages/editor-core  
**Storage**: SQLite via persistence layer (`packages/editor-persistence`) and
traceability repositories in `packages/shared-data`  
**Testing**: Vitest (unit/contract), Playwright (fixture E2E), repository
gauntlet (`pnpm test`)  
**Target Platform**: React web client + Express API (desktop-first, modern
evergreen browsers)  
**Project Type**: Monorepo with web frontend (`apps/web`) and API backend
(`apps/api`)  
**Performance Goals**: Section validation status refresh ≤2s; document dashboard
refresh ≤5s; maintain existing client P95 <3s  
**Constraints**: Must reuse QA engine definitions, block publish on blockers,
emit telemetry/audit events, adhere to library-first + CLI standards  
**Scale/Scope**: Single-document collaboration (dozens of sections) with
concurrent authors and compliance reviewers

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Library-First Architecture**: Core gate evaluation, dashboard aggregation,
  and traceability logic must live in libraries (`packages/qa`,
  `packages/editor-core`, `packages/shared-data`) with clear boundaries.
- **CLI Interface Standard**: Expose new quality gate orchestration through the
  QA package CLI so the workflow remains scriptable and debuggable.
- **Test-First Development (NON-NEGOTIABLE)**: Author failing unit, integration,
  and contract tests (Vitest + Playwright fixture) before implementing runtime
  code; ensure gauntlet commands run clean.
- **Integration & Observability**: Extend structured telemetry/audit logs for
  validation runs, include Request ID and actor metadata, and document the
  observability plan.
- **Simplicity & Versioning**: Prefer incremental extensions of existing modules
  over net-new services; justify any complexity that exceeds current
  architecture.
- **SOC2 Logging Rules**: Capture authentication, data access, and authorization
  events tied to quality gate actions within audit logs.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
apps/
├── api/
│   └── src/
│       ├── modules/
│       │   └── quality-gates/            # New controllers/services for dashboard + traceability APIs
│       ├── routes/
│       │   └── quality-gates.ts          # REST entry points (document + section)
│       ├── services/
│       │   └── quality-gates-runner/     # Gate orchestration + telemetry emitters
│       └── tests/
│           ├── unit/quality-gates/       # Vitest unit suites (fail-first)
│           └── contract/quality-gates/   # Contract tests for new endpoints
├── web/
│   └── src/
│       ├── features/document-editor/
│       │   ├── components/quality-gates/ # Sidebar, dashboard, traceability widgets
│       │   ├── hooks/useQualityGates.ts  # React hooks for live updates
│       │   └── stores/quality-gates/     # Zustand store slices
│       └── tests/
│           ├── unit/quality-gates/       # Component + hook tests
│           └── e2e/document-quality/     # Playwright fixture suites
packages/
├── qa/
│   └── src/
│       ├── gates/section/                # Rule definitions + remediation guidance
│       ├── dashboard/                    # Aggregation helpers + CLI command
│       └── traceability/                 # Requirement link management
├── editor-core/
│   └── src/quality-gates/                # Shared models + status vocab
└── shared-data/
    └── src/traceability/                 # Persistence + repositories
specs/013-epic-2-story-8/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/                            # OpenAPI / schema artifacts
```

**Structure Decision**: Extend existing `apps/api`, `apps/web`, and
`packages/qa` modules with quality-gate-focused folders while adding supporting
docs under `/specs/013-epic-2-story-8/`.

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output schema to `/contracts/`

3. **Update agent context**:
   - Run the agent-specific context script to record new technologies introduced
     in this plan
   - Append only new information; preserve existing manual notes

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

**Output**: data-model.md, /contracts/\*, quickstart.md, updated agent context
file

## Phase 2: Task Planning Approach

_This section describes what the `/speckit.tasks` command will do - DO NOT
execute during `/speckit.plan`_

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Organize tasks by user story priority (P1, P2, P3...)
- Each user story → complete set of tests (if requested), models, services,
  endpoints, and integration work
- Shared setup and foundational tasks appear before user stories; polish tasks
  appear last
- Use `[P]` markers for parallel-safe tasks (different files)

**Outputs expected from `/speckit.tasks`**:

- `tasks.md` with phases for setup, foundational work, each user story, and
  polish
- MVP recommendation and dependency graph between user stories
- Parallel execution guidance and implementation strategy summary
