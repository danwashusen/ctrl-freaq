# Implementation Plan: Authenticated App Layout + Dashboard

**Branch**: `004-1-4-authenticated` | **Date**: 2025-09-15 | **Spec**:
`/specs/004-1-4-authenticated/spec.md` **Input**: Feature specification from
`/specs/004-1-4-authenticated/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by
other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Implement authenticated two-column layout with sidebar navigation showing user
projects and a dashboard view displaying Project List and Recent Activity
columns. Uses Clerk JWT authentication, Repository pattern for data access, and
React with Zustand/TanStack Query for state management.

## Primary Sources

- Architecture path: /docs/architecture.md#auth-authorization
  - Excerpt: Validate Clerk JWT on all `/api/v1/*` routes; return 401 for
    invalid/expired tokens; stateless JWT via HttpOnly cookies.
- Architecture path: /docs/architecture.md#logging-standards
  - Excerpt: Pino structured JSON logging; include correlation/request ID,
    service context, and userId; never log secrets/PII.
- Architecture path: /docs/architecture.md#error-handling-strategy
  - Excerpt: Typed HttpError hierarchy; map to stable error codes; return
    sanitized JSON `{ code, message, requestId, timestamp }`.
- Architecture path: /docs/architecture.md#shared-data
  - Excerpt: Repository pattern only; no raw SQL in routes; typed entities; use
    transactions for multi-table updates.
- UI Architecture path: /docs/ui-architecture.md#routing
  - Excerpt: ProtectedRoute gates authenticated areas; unauthenticated →
    `/auth/sign-in`; authenticated default `/` → `/dashboard`; lazy route
    loading with Suspense.
- UI Architecture path: /docs/ui-architecture.md#frontend-developer-standards
  - Excerpt: Hooks discipline, immutable state updates, accessibility and
    performance budgets, structured browser logging with correlation IDs, and
    RTL/Vitest testing patterns.

## Standards/Conventions Digest

### Backend

- Dependency Injection (Service Locator)
  - Bad: `import logger from '../logger-singleton'`
  - Good: `const logger = req.services.get<Logger>('logger')`
- Input Validation (Zod at API boundaries)
  - Bad: `if (!req.body.name) return res.status(400).send('bad')`
  - Good:
    `const parsed = Schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ code: 'validation_error', requestId })`
- Error Handling (typed HttpError + stable codes)
  - Bad: `throw 'not found'`
  - Good: `throw new NotFoundError('project_not_found')`
- Structured Logging (Pino; no secrets)
  - Bad: `console.log('Auth', req.headers.authorization)`
  - Good: `logger.info({ requestId, userId }, 'Auth success')`
- Repository Pattern (no raw SQL in routes)
  - Bad: `db.exec("SELECT * FROM projects WHERE user='${userId}'")`
  - Good: `await projectRepo.findByUserId(userId)`

### Frontend

- Routing/Auth Gating (guard before data fetches)
  - Bad: Fetch projects in root before auth check
  - Good: Wrap with `<ProtectedRoute />`, then fetch within protected routes
- State Immutability and Separation (server vs client)
  - Bad: `projects.push(item); setProjects(projects)`
  - Good: `setProjects(prev => [...prev, item])`; use TanStack Query for server
    state
- Accessibility (semantic roles/names)
  - Bad: `<div onClick>Projects</div>`
  - Good: `<nav aria-label="Projects"><ul>…</ul></nav>`
- Performance (lazy routes, memoization)
  - Bad: Eagerly import all dashboard subcomponents
  - Good: `lazy(() => import('…/dashboard'))` and memoize list items

## Technical Context

**Language/Version**: TypeScript 5.4.x / Node.js 22.x / React 18.3.x **Primary
Dependencies**: Express.js 5.1.0, React, Clerk, Zustand, TanStack Query, React
Router v6, shadcn/ui **Storage**: SQLite with better-sqlite3 (via Repository
pattern) **Testing**: Vitest for unit/integration, React Testing Library for
components, Playwright for E2E **Target Platform**: Web application (local MVP,
future AWS deployment) **Project Type**: web - monorepo with frontend (React) +
backend (Express.js) **Performance Goals**: Dashboard load < 2s, smooth
navigation, responsive UI **Constraints**: Local-only operation for MVP, no
remote servers required **Scale/Scope**: Single user project (MVP enforces one
project per user)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 2 (apps/web for React frontend, apps/api for Express backend)
- Using framework directly? YES (Express.js, React without wrappers)
- Single data model? YES (shared via Repository pattern)
- Avoiding patterns? Using Repository (justified: SQLite → DynamoDB migration
  path)

**Architecture**:

- EVERY feature as library? YES (packages structure already established)
- Libraries listed:
  - shared-data: Repository pattern data access with CLI
  - Multiple existing packages with CLI interfaces
- CLI per library: Existing CLIs with --help/--version/--format
- Library docs: Following established monorepo patterns

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? Will enforce
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (In-memory SQLite for tests)
- Integration tests for: new libraries, contract changes, shared schemas? YES
- FORBIDDEN: Implementation before test, skipping RED phase - UNDERSTOOD

**Observability**:

- Structured logging included? YES (Pino on backend, browser Pino on frontend)
- Frontend logs → backend? YES (unified stream to /api/v1/logs)
- Error context sufficient? YES (requestId, userId, timestamps)

**Versioning**:

- Version number assigned? Using existing package versions
- BUILD increments on every change? Following monorepo conventions
- Breaking changes handled? N/A for MVP

## Project Structure

### Documentation (this feature)

```
specs/004-1-4-authenticated/
├── spec.md              # Feature specification (existing)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 2: Web application (when "frontend" + "backend" detected)
apps/
├── web/                 # React frontend
│   └── src/
│       ├── app/        # Application shell and providers
│       ├── features/   # Feature modules
│       ├── components/ # Shared UI components
│       ├── pages/      # Route pages
│       └── lib/        # Core utilities
└── api/                # Express.js backend
    └── src/
        ├── routes/     # API endpoints
        ├── middleware/ # Auth, logging, etc.
        └── services/   # Business logic

packages/
├── shared-data/        # Repository pattern data access
└── [other packages]    # Existing library packages

tests/
├── contract/          # API contract tests
├── integration/       # Feature integration tests
└── e2e/              # Playwright E2E tests
```

**Structure Decision**: Option 2 - Web application (monorepo with frontend +
backend)

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - ✅ All technical context resolved from architecture docs
   - ✅ Authentication approach: Clerk JWT
   - ✅ State management: Zustand + TanStack Query
   - ✅ Repository pattern implementation exists

2. **Generate and dispatch research agents**:

   ```
   Task: Research Clerk authentication flow with React Router v6
   Task: Research project listing with Repository pattern
   Task: Research dashboard layout patterns with shadcn/ui
   Task: Research empty state handling in React
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - User entity (from Clerk)
   - Project entity (existing)
   - Activity entity (placeholder for MVP)
   - Dashboard state (client-side)

2. **Generate API contracts** from functional requirements:
   - GET /api/v1/projects - List user projects
   - GET /api/v1/dashboard - Dashboard data endpoint
   - GET /api/v1/activities - Recent activities (empty for MVP)
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - User logs in and sees dashboard
   - Sidebar shows projects alphabetically
   - Project list displays with member avatars
   - Recent activity shows empty state
   - Project selection updates state

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude`
   - Add dashboard and authenticated layout context
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md,
CLAUDE.md updates

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**:

- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract test task [P]
- Each entity → model/repository task [P]
- Each user story → integration test task
- Implementation tasks to make tests pass

**Ordering Strategy**:

- TDD order: Tests before implementation
- Dependency order: Backend APIs before frontend components
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md covering:

- Backend API endpoints (5-6 tasks)
- Frontend components (8-10 tasks)
- State management setup (3-4 tasks)
- Protected routing (2-3 tasks)
- Integration tests (5-6 tasks)
- E2E tests (3-4 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md) **Phase 4**:
Implementation (execute tasks.md following constitutional principles) **Phase
5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation          | Why Needed                       | Simpler Alternative Rejected Because                                                 |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------ |
| Repository pattern | SQLite → DynamoDB migration path | Direct DB access would require rewriting all data access code during cloud migration |

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
- [x] Complexity deviations documented

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
