# Implementation Plan: Document Editor Core Infrastructure

**Branch**: `006-story-2-2` | **Date**: 2025-09-20 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/006-story-2-2/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
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

The Document Editor Core Infrastructure provides a comprehensive editing
environment with hierarchical Table of Contents navigation, section-based
read/edit modes, WYSIWYG Markdown editing via Milkdown, and Git-style patch
management for tracking changes. This enables senior engineers to efficiently
author architecture documents with AI assistance while maintaining clear visual
state indicators and responsive navigation.

## Technical Context

**Language/Version**: TypeScript 5.4.x, Node.js 22.x, React 18.x **Primary
Dependencies**: React, Milkdown 7.15.5, Zustand, React Router v6, shadcn/ui,
Express.js 5.1.0 **Storage**: SQLite (better-sqlite3) for sections/documents,
localStorage/IndexedDB for pending changes **Testing**: Vitest for unit tests,
React Testing Library for components, Playwright for E2E **Target Platform**:
Web browsers (Chrome, Firefox, Safari), local Node.js server **Project Type**:
web - monorepo with frontend React app and Express.js backend API **Performance
Goals**: <300ms section navigation, 60fps animations, <100ms patch generation
**Constraints**: Full document rendering (no lazy loading), streaming SSE for AI
responses, JWT auth via Clerk **Scale/Scope**: MVP for single user per project,
~50 sections per document, ~10 documents per project **Coding Standards**:
ESLint v9 flat config with strict TypeScript rules, Prettier, Husky pre-commit

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Library-First Architecture**: ✅ PASS

- Using existing libraries: shared-data, editor-core, editor-persistence,
  template-resolver
- Each feature module maintains clear boundaries and CLI interfaces

**Test-First Development (TDD)**: ✅ PASS

- Plan includes contract test generation before implementation
- Integration tests from user stories defined upfront
- All tests will fail initially (no implementation)

**CLI Interface Standard**: ✅ PASS

- Libraries already expose CLI interfaces per constitutional requirement
- API endpoints follow REST standards with JSON responses

**Integration Testing & Observability**: ✅ PASS

- Plan includes integration tests for API contracts
- Structured logging via Pino already configured
- Health checks and monitoring in place

**Simplicity & Versioning**: ✅ PASS

- Leveraging existing Milkdown editor vs building custom
- Using established patterns from current codebase
- No unnecessary abstractions planned

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 2 (Web application) - Project uses React frontend
and Express.js backend architecture

## Phase 0: Outline & Research

1. **Append configured Technical Context additions** (if available):
   - If `SPEC_KIT_CONFIG.plan.technical_context` exists, append entries not
     already present in Technical Context
   - Preserve formatting and `[NEEDS CLARIFICATION]` markers so they flow into
     research tasks

2. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

3. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

4. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

5. **Execute Additional Research instructions (if configured)**:
   - If `SPEC_KIT_CONFIG.plan.additional_research` exists, run each item as an
     independent research instruction using the available context (feature spec,
     constitution, and any plan documents)
   - Append results to `research.md` under a top-level heading:
     `## Additional Research`
   - For each instruction output, derive a clear section heading that summarizes
     the key subject (do not repeat the instruction verbatim). Use the following
     format for each section:
     - `### {Concise Title Derived From Output}`
     - Summary and details produced by the instruction
     - References or source notes (if applicable)

**Output**: research.md with all NEEDS CLARIFICATION resolved and (if
configured) an "Additional Research" section containing the instruction-driven
findings

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` for your AI
     assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md,
agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**: The /tasks command will generate implementation
tasks based on:

- Data model entities → TypeScript interfaces and Zod schemas
- API contracts → Express route handlers and contract tests
- UI components → React components with tests
- State management → Zustand stores implementation
- Integration points → Service layer and API client

**Task Categories Expected**:

1. **Data Layer Tasks** [P - can be done in parallel]:
   - Create SectionView TypeScript interface and Zod schema
   - Create PendingChange interface and schema
   - Create EditorSession interface and schema
   - Create TableOfContents interface and schema
   - Implement repository methods in shared-data package

2. **API Layer Tasks** [P after data layer]:
   - Implement GET /documents/{docId}/sections endpoint
   - Implement PATCH /sections/{sectionId} state update
   - Implement POST /sections/{sectionId}/pending-changes
   - Implement POST /sections/{sectionId}/save endpoint
   - Create contract tests for each endpoint

3. **Frontend State Tasks**:
   - Create editor-store.ts with Zustand
   - Create pending-changes-store.ts
   - Create toc-store.ts
   - Implement state synchronization logic

4. **UI Component Tasks** (sequential):
   - Create TableOfContents component
   - Create SectionView component
   - Create MilkdownEditor wrapper
   - Create DiffPreview component
   - Integrate components into DocumentEditor

5. **Integration Test Tasks**:
   - ToC navigation E2E test
   - Section mode transitions test
   - Placeholder content test
   - Patch generation test
   - Performance validation tests

**Ordering Strategy**:

- Follow TDD: Contract tests → Implementation → Integration tests
- Respect dependencies: Data models → Services → UI components
- Enable parallelism where possible with [P] markers
- Group related tasks for context efficiency

**Estimated Output**: 35-40 numbered tasks covering all layers

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional
principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance
validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

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
