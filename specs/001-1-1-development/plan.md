# Implementation Plan: Development Environment Bootstrap

**Branch**: `001-1-1-development` | **Date**: 2025-09-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-1-1-development/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✓ Found and loaded spec.md
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✓ Detected Project Type: web (frontend+backend)
   → ✓ Set Structure Decision: Option 2 - Web application
3. Evaluate Constitution Check section below
   → ✓ No violations detected (library-first approach honored)
   → ✓ Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → ✓ No NEEDS CLARIFICATION found in spec
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → ✓ No new violations
   → ✓ Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach
8. STOP - Ready for /tasks command
```

## Summary
Setting up a comprehensive monorepo development environment for CTRL FreaQ with React frontend, Express.js backend, and 8 independent library packages following Constitutional requirements. The implementation adapts an existing lovable.ai prototype while establishing library-first architecture with CLI interfaces, test infrastructure, and development scripts.

## Technical Context
**Language/Version**: TypeScript 5.4.x / Node.js 20.x  
**Primary Dependencies**: React 18.3, Express.js 5.1.0, pnpm 9.x, Turborepo 1.x, Vitest 1.x  
**Storage**: SQLite 3.x with better-sqlite3 9.x  
**Testing**: Vitest for all packages, React Testing Library for frontend  
**Target Platform**: Local development (macOS/Linux/Windows), Web browsers (Chrome/Edge/Safari/Firefox)  
**Project Type**: web - Frontend (React) + Backend (Express.js) + Libraries  
**Performance Goals**: Frontend TTFMP ≤ 2s, Backend P95 ≤ 300ms, Dev server startup < 10s  
**Constraints**: Must preserve existing lovable.ai functionality, Constitutional compliance mandatory  
**Scale/Scope**: MVP with 8 library packages, 2 applications, ~37 functional requirements

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 2 apps + 8 libraries (justified by Constitutional library-first requirement)
- Using framework directly? ✓ (React, Express.js without wrappers)
- Single data model? ✓ (Each library owns its types)
- Avoiding patterns? ✓ (No unnecessary abstractions)

**Architecture**:
- EVERY feature as library? ✓ (8 distinct libraries defined)
- Libraries listed:
  - `shared-data`: Repository pattern with SQLite
  - `templates`: YAML template validation and expansion
  - `ai`: LLM integration with Vercel AI SDK
  - `qa`: Quality gates validation
  - `exporter`: Document export with versioning
  - `editor-core`: WYSIWYG editing with patches
  - `editor-persistence`: Client-side pending changes
  - `template-resolver`: Template hierarchy navigation
- CLI per library: All libraries include CLI with standard commands
- Library docs: README.md format planned for each

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? ✓ (Test templates provided)
- Git commits show tests before implementation? ✓ (Will be enforced)
- Order: Contract→Integration→E2E→Unit strictly followed? ✓
- Real dependencies used? ✓ (SQLite, not mocks)
- Integration tests for: new libraries, contract changes, shared schemas? ✓
- FORBIDDEN: Implementation before test ✓ (Understood)

**Observability**:
- Structured logging included? ✓ (Pino 9.5.0)
- Frontend logs → backend? ✓ (Pino browser with transmission)
- Error context sufficient? ✓ (RequestId, stack traces server-side)

**Versioning**:
- Version number assigned? ✓ (All packages start at 0.1.0)
- BUILD increments on every change? ✓ (Via npm version)
- Breaking changes handled? ✓ (CHANGELOG.md, migration docs)

## Project Structure

### Documentation (this feature)
```
specs/001-1-1-development/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
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
│   │   ├── components/ # UI components
│   │   ├── lib/        # Utilities
│   │   ├── pages/      # Route pages
│   │   ├── stores/     # Zustand stores
│   │   └── types/      # TypeScript types
│   └── test/
└── api/                 # Express.js backend
    ├── src/
    │   ├── routes/     # API routes
    │   ├── middleware/ # Express middleware
    │   ├── services/   # Business logic
    │   └── lib/        # Utilities
    └── test/

packages/
├── shared-data/         # Data layer library
├── templates/           # Template processing
├── ai/                  # LLM integration
├── qa/                  # Quality gates
├── exporter/           # Document export
├── editor-core/        # WYSIWYG editing
├── editor-persistence/ # Client persistence
└── template-resolver/  # Template resolution

docs/                    # Architecture docs
templates/              # Document templates
infra/                  # Infrastructure (placeholder)
```

**Structure Decision**: Option 2 - Web application structure selected based on frontend+backend requirements

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context**:
   - No NEEDS CLARIFICATION items found
   - All technologies specified in architecture documents
   - Dependencies clearly defined

2. **Research completed** (from architecture review):
   - Monorepo tooling: pnpm workspaces + Turborepo confirmed
   - Frontend: React 18 with Vite, TypeScript, shadcn/ui
   - Backend: Express.js 5.1.0 with Pino logging
   - Testing: Vitest across all packages
   - Authentication: Clerk integration specified

3. **Consolidate findings** in `research.md`:
   - Decision: pnpm workspaces for monorepo management
   - Rationale: Speed, efficiency, and disk space optimization
   - Alternatives considered: npm workspaces, yarn, lerna

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Monorepo configuration (workspace, pipeline)
   - Package metadata (name, version, dependencies)
   - Application structure (frontend, backend)
   - Library interfaces (CLI, exports)
   - Test configuration (framework, patterns)
   - Development scripts (commands, validation)

2. **Generate API contracts** from functional requirements:
   - Health check endpoint: GET /health
   - API versioning: /api/v1/* base path
   - Authentication endpoints (via Clerk)
   - Projects API: GET /api/v1/projects, PATCH /api/v1/projects/:id

3. **Generate contract tests** from contracts:
   - Health check contract test
   - Authentication flow tests
   - API versioning tests
   - Projects API tests

4. **Extract test scenarios** from user stories:
   - Developer environment setup flow
   - Service startup validation
   - Authentication integration
   - Dashboard rendering
   - Test execution across packages

5. **Update CLAUDE.md incrementally**:
   - Add monorepo structure
   - Include development commands
   - Document testing approach
   - Preserve existing content

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Generate ~40-50 tasks for comprehensive setup
- Group by component: Monorepo, Frontend, Backend, Libraries, Testing
- Each library gets CLI setup, structure, and test tasks
- Infrastructure tasks for CI/CD and documentation

**Ordering Strategy**:
1. Monorepo structure and configuration [P]
2. Library package initialization (8 parallel) [P]
3. Frontend adaptation from lovable.ai
4. Backend Express.js setup
5. Integration and wiring
6. Test infrastructure
7. Development scripts and documentation

**Estimated Output**: 40-50 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations requiring justification*

## Progress Tracking
*This checklist is updated during execution flow*

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
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*