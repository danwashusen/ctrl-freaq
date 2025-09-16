# Implementation Plan: Development Environment Bootstrap

**Branch**: `002-1-1-development` | **Date**: 2025-09-13 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/002-1-1-development/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   ✓ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✓ No NEEDS CLARIFICATION markers found
   ✓ Detect Project Type: web (frontend+backend)
   ✓ Set Structure Decision: Option 2 (Web application)
3. Evaluate Constitution Check section below
   ✓ All constitutional requirements satisfied
   ✓ Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   ✓ Research completed
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   ✓ Design artifacts generated
6. Re-evaluate Constitution Check section
   ✓ No new violations
   ✓ Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Task generation approach described
8. STOP - Ready for /tasks command
```

## Summary

Development Environment Bootstrap establishes the complete monorepo
infrastructure for CTRL FreaQ MVP, including adapting the existing lovable.ai
prototype as the React frontend, creating an Express.js backend with core
architectural patterns (Service Locator, Repository Pattern, Pino logging),
establishing library packages with CLI interfaces per Constitutional
requirements, and setting up comprehensive test infrastructure with Vitest.

## Technical Context

**Language/Version**: TypeScript 5.4.x / Node.js 20.x **Primary Dependencies**:
Express.js 5.1.0, React 18.3.x, Vite 5.x, Pino 9.5.0, better-sqlite3 9.x
**Storage**: SQLite 3.x with better-sqlite3 driver **Testing**: Vitest 1.x with
React Testing Library 14.x **Target Platform**: Local development
(macOS/Linux/Windows) **Project Type**: web - monorepo with frontend and backend
**Performance Goals**: <2s TTFMP, <300ms server P95, <100ms local interactions
**Constraints**: Library-first architecture, CLI interfaces mandatory, TDD
mandatory **Scale/Scope**: Single developer MVP, 8 library packages, 2 main
applications

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 2 (apps/web, apps/api) ✓
- Using framework directly? Yes - Express.js and React used directly ✓
- Single data model? Yes - shared via packages/shared-data ✓
- Avoiding patterns? No - Repository and Service Locator are architectural
  requirements

**Architecture**:

- EVERY feature as library? Yes - 8 packages planned ✓
- Libraries listed:
  - shared-data: Data access layer with repository pattern
  - templates: YAML template parsing and validation
  - ai: LLM integration via Vercel AI SDK
  - qa: Quality gates and validation
  - exporter: Document export functionality
  - editor-core: WYSIWYG Markdown editor
  - editor-persistence: Client-side persistence
  - template-resolver: Template resolution and caching
- CLI per library: Each has src/cli.ts with --help/--version/--format ✓
- Library docs: README.md per package, llms.txt format planned ✓

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? Yes - placeholder tests will fail first ✓
- Git commits show tests before implementation? Will be enforced ✓
- Order: Contract→Integration→E2E→Unit strictly followed? Yes ✓
- Real dependencies used? SQLite in-memory for tests ✓
- Integration tests for: new libraries, contract changes, shared schemas? Yes ✓
- FORBIDDEN: Implementation before test - understood ✓

**Observability**:

- Structured logging included? Pino 9.5.0 with JSON format ✓
- Frontend logs → backend? Yes via /api/v1/logs endpoint ✓
- Error context sufficient? Request ID, service context, user context ✓

**Versioning**:

- Version number assigned? 0.1.0 for all packages ✓
- BUILD increments on every change? Will use semver ✓
- Breaking changes handled? N/A for MVP ✓

## Project Structure

### Documentation (this feature)

```
specs/002-1-1-development/
├── spec.md              # Feature specification (exists)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── health-check.yaml
│   └── projects-api.yaml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 2: Web application (SELECTED)
apps/
├── web/                 # React frontend (adapted from lovable.ai)
│   ├── src/
│   │   ├── app/        # Application shell
│   │   ├── features/   # Feature modules
│   │   ├── lib/        # Utilities and services
│   │   └── stores/     # Zustand stores
│   └── tests/
└── api/                 # Express.js backend
    ├── src/
    │   ├── core/       # Core infrastructure
    │   │   ├── service-locator.ts
    │   │   ├── logging.ts
    │   │   └── errors.ts
    │   ├── middleware/
    │   ├── routes/
    │   └── services/
    └── tests/

packages/
├── shared-data/
├── templates/
├── ai/
├── qa/
├── exporter/
├── editor-core/
├── editor-persistence/
└── template-resolver/
```

**Structure Decision**: Option 2 - Web application with separate
frontend/backend apps

## Phase 0: Outline & Research

### Research Tasks Completed:

1. **Service Locator Pattern in Express.js**
   - Decision: Request-scoped container pattern
   - Rationale: Avoids singletons, enables per-request configuration
   - Alternatives: Global DI container (rejected - violates no-singleton rule)

2. **Pino Logger Configuration**
   - Decision: Structured JSON with correlation IDs
   - Rationale: Constitutional requirement for observability
   - Alternatives: Winston (rejected - Pino has better performance)

3. **Repository Pattern with SQLite**
   - Decision: Abstract base repository with typed implementations
   - Rationale: Enables future DynamoDB migration
   - Alternatives: Direct database access (rejected - violates architecture)

4. **Adapting Existing React Code**
   - Decision: Move and enhance lovable.ai prototype
   - Rationale: Preserves existing investment
   - Alternatives: Rewrite from scratch (rejected - wastes existing work)

5. **Monorepo Tool Selection**
   - Decision: pnpm workspaces + Turborepo
   - Rationale: Efficient dependency management, parallel builds
   - Alternatives: Lerna, Nx (rejected - more complex)

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts

### Artifacts Generated:

1. **Data Models** (data-model.md):
   - User (from Clerk authentication)
   - Project (personal project container)
   - Document (future use)
   - Configuration (app settings)

2. **API Contracts** (contracts/):
   - health-check.yaml: Health check endpoint
   - projects-api.yaml: Basic project endpoints

3. **Contract Tests**:
   - Health check contract test
   - Project API contract tests
   - All tests will fail initially (no implementation)

4. **Quickstart Guide** (quickstart.md):
   - Prerequisites and setup
   - Installation steps
   - Running the development environment
   - Verification procedures

5. **AI Assistant Context** (CLAUDE.md):
   - Updated with project structure
   - Core architectural patterns
   - Development guidelines

**Output**: data-model.md, contracts/\*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**:

- Extract from spec.md acceptance criteria
- Generate setup tasks for monorepo structure
- Create tasks for each library package with CLI
- Frontend adaptation tasks from lovable.ai
- Backend infrastructure tasks (service locator, logging, middleware)
- Test infrastructure setup tasks
- Documentation and script tasks

**Ordering Strategy**:

1. Monorepo setup (foundation)
2. Core infrastructure (logging, service locator, errors)
3. Library packages [P] (can be done in parallel)
4. Frontend adaptation
5. Backend API setup
6. Test infrastructure
7. Development scripts
8. Documentation

**Estimated Output**: 40-45 numbered, ordered tasks in tasks.md covering:

- Monorepo configuration (3-4 tasks)
- Core infrastructure (5-6 tasks)
- Library packages (16 tasks - 2 per package)
- Frontend setup (6-8 tasks)
- Backend setup (5-6 tasks)
- Test setup (4-5 tasks)
- Scripts and docs (3-4 tasks)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md) **Phase 4**:
Implementation (execute tasks.md following constitutional principles) **Phase
5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation          | Why Needed                                             | Simpler Alternative Rejected Because                                |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Repository Pattern | Architecture requirement for SQLite→DynamoDB migration | Direct DB access would require complete rewrite for cloud migration |
| Service Locator    | Architecture requirement for per-request DI            | Global singletons violate Constitutional no-singleton rule          |

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
