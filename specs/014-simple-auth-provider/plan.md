# Implementation Plan: Simple Auth Provider Mode

**Branch**: `[014-simple-auth-provider]` | **Date**: 2025-10-20 | **Spec**:
[`spec.md`](../spec.md) **Input**: Feature specification from
`/specs/014-simple-auth-provider/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a configuration-driven "simple" authentication provider that loads
predefined users from YAML, exposes simple-mode auth endpoints and middleware on
the API, and swaps the web app's auth surface to a local user selector. Adoption
hinges on parity with existing Clerk flows, configuration toggles between
providers, and explicit warnings when simple mode is active.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Node.js 20 runtime, pnpm workspace)  
**Primary Dependencies**: Express.js API stack, React 19 frontend, TanStack
Query, Clerk SDK (existing), YAML parsing (js-yaml), Vite build tooling  
**Storage**: SQLite (existing persistence) plus filesystem YAML file defined by
`SIMPLE_AUTH_USER_FILE`  
**Testing**: Vitest for unit/contract tests, Playwright for E2E verification,
pnpm test harness  
**Target Platform**: Local-first development stack (macOS/Linux) running
`apps/api` and `apps/web` concurrently  
**Project Type**: Monorepo with `apps/api` backend and `apps/web` frontend,
shared libraries under `packages/`  
**Performance Goals**: Meet success criteria—login flow available within 60
seconds of stack start, valid simple tokens succeed 100% of time, mode switching
within 5 minutes, warnings emitted immediately when simple mode active  
**Constraints**: Maintain parity with Clerk integration, no external auth
dependency in simple mode, warn on simple usage in any environment, adhere to
TDD and library-first principles  
**Scale/Scope**: Supports small team local development scenarios (dozens of
predefined users) with minimal concurrency; not intended for production load

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Library-First Architecture**: New backend components will live within
  existing modular services (`apps/api/src/modules/auth`) and shareable
  utilities under `packages/` if generalized; any new shared library code will
  expose a CLI entry point per constitutional mandate.
- **CLI Interface Standard**: If simple auth logic graduates into a shared
  package, we will add a pnpm-exposed CLI for validation/testing. Otherwise,
  work remains inside existing apps which already satisfy CLI obligations.
- **Test-First Development**: Plan mandates writing failing unit, contract, and
  Playwright tests for YAML validation, middleware enforcement, and UI login
  flow before implementing logic.
- **Security Requirements**: Simple mode explicitly documents its non-production
  intent, still enforces authentication checks, rejects malformed tokens, and
  logs warnings; no secrets stored in code.
- **Quality Gates**: Implementation must pass `pnpm lint`, `pnpm typecheck`, and
  `pnpm test` per verification discipline.

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
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   └── auth/
│   │   └── routes/
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── unit/
└── web/
    ├── src/
    │   ├── components/
    │   │   └── simple-auth/
    │   ├── features/
    │   ├── lib/
    │   │   └── auth-provider/
    │   └── main.tsx
    └── tests/
        ├── unit/
        └── e2e/

packages/
├── templates/
├── persistence/
└── shared-data/

.specify/
└── templates/
```

**Structure Decision**: Use existing monorepo layout with `apps/api` handling
service logic and `apps/web` delivering UI. Shared validation helpers may live
in `packages/shared-data` if needed; otherwise, simple auth remains app-scoped.

## Complexity Tracking

No constitutional violations requiring justification identified at this stage.

## Phase 0: Outline & Research

- Reviewed configuration, backend, and UI architecture guidance to confirm
  simple auth fits library-first constraints.
- Captured key decisions in `research.md`:
  - YAML parsing and validation approach (`js-yaml` + Zod).
  - Strategy for seeding users into SQLite via `ensureTestUserMiddleware`.
  - Frontend auth-provider selector pattern with local storage persistence.
  - Logging/warning policy for simple mode activation.
- No open clarifications remain heading into design.

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. Documented data entities and relationships in `data-model.md`, covering
   `SimpleAuthUser`, persistence mapping, runtime config, session state, and
   audit events.
2. Auth routes and payloads modeled in `/contracts/simple-auth.openapi.yaml`,
   defining `GET /auth/simple/users` and `POST /auth/simple/logout`.
3. Auth provider quickstart prepared in `quickstart.md` with environment setup,
   run instructions, validation checks, and troubleshooting.
4. Extracted user story scenarios into quickstart validation steps and plan
   future tests accordingly.
5. Agent context update script is not present in `.specify/scripts/bash`;
   document the new simple-auth considerations manually in the agent context
   file during implementation.

**Output**: `data-model.md`, `/contracts/simple-auth.openapi.yaml`,
`quickstart.md`, updated agent context notes (manual entry required)

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
