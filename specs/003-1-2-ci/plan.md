# Implementation Plan: CI Pipeline Setup

**Branch**: `003-1-2-ci` | **Date**: 2025-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-1-2-ci/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → Loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detected Project Type: web (monorepo with frontend+backend)
   → Set Structure Decision: N/A (CI/CD infrastructure)
3. Evaluate Constitution Check section below
   → No violations for CI infrastructure
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → No unknowns remaining after clarifications
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
6. Re-evaluate Constitution Check section
   → No new violations
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

## Summary

Establish GitHub Actions CI pipeline for CTRL FreaQ monorepo that automatically
validates code quality on PR and main branch pushes. Pipeline will run lint,
type-check, build, and test jobs across all packages using pnpm/Turborepo,
enforcing quality gates before merge with 5-minute timeout and pnpm store
caching.

## Technical Context

**Language/Version**: TypeScript 5.4.x / Node.js 20.x **Primary Dependencies**:
GitHub Actions, pnpm 9.x, Turborepo 1.x, Vitest 1.x **Storage**: N/A (CI
infrastructure) **Testing**: Vitest for unit/integration tests **Target
Platform**: GitHub Actions runners (Ubuntu latest) **Project Type**: web
(monorepo) - CI/CD infrastructure **Performance Goals**: < 5 minute CI run time
**Constraints**: Fail-fast on first error, cache pnpm store only
**Scale/Scope**: ~10 packages in monorepo, concurrent PR support

**Architecture Context**:

- CI/CD Platform: GitHub Actions (docs/architecture.md#deployment-strategy)
- Pipeline Configuration: `.github/workflows/`
  (docs/architecture.md#deployment-strategy)
- Test Philosophy: TDD mandatory, run on every PR/merge
  (docs/architecture.md#testing-philosophy)
- Monorepo: pnpm + Turborepo (docs/architecture.md#tech-stack)
- Frontend Testing: Vitest + React Testing Library
  (docs/ui-architecture.md#testing-requirements)
- Build Tool: Vite for frontend (docs/ui-architecture.md#tech-stack)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**:

- Projects: 0 (CI configuration only) ✅
- Using framework directly? Yes - GitHub Actions native ✅
- Single data model? N/A - no data model ✅
- Avoiding patterns? Yes - direct workflow configuration ✅

**Architecture**:

- EVERY feature as library? N/A - infrastructure ✅
- Libraries listed: N/A - CI configuration
- CLI per library: N/A - workflow automation
- Library docs: N/A - workflow documentation in YAML

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? Yes - CI validates all tests ✅
- Git commits show tests before implementation? CI enforces ✅
- Order: Contract→Integration→E2E→Unit strictly followed? CI runs all ✅
- Real dependencies used? Yes - actual package builds ✅
- Integration tests for: CI validates monorepo integration ✅

**Observability**:

- Structured logging included? GitHub Actions logs ✅
- Frontend logs → backend? N/A for CI ✅
- Error context sufficient? Full job logs and artifacts ✅

**Versioning**:

- Version number assigned? N/A - infrastructure ✅
- BUILD increments on every change? GitHub run numbers ✅
- Breaking changes handled? Workflow versioning ✅

## Project Structure

### Documentation (this feature)

```
specs/003-1-2-ci/
├── spec.md              # Feature specification
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # N/A for CI infrastructure
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Workflow contracts (YAML schemas)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
.github/
├── workflows/
│   ├── ci.yml           # Main CI pipeline
│   └── pr-validation.yml # PR-specific checks
├── actions/             # Reusable actions (if needed)
└── dependabot.yml       # Dependency updates config

scripts/
└── ci/                  # CI helper scripts
    ├── check-workspace.sh
    └── generate-metrics.js
```

**Structure Decision**: GitHub Actions standard structure in
`.github/workflows/`

## Phase 0: Outline & Research

All technical decisions have been resolved through clarifications:

1. **Node.js Version**: Resolved - Node.js 20.x for stability
2. **Visual Testing**: Resolved - Excluded from MVP
3. **Caching Strategy**: Resolved - pnpm store only
4. **Timeout**: Resolved - 5 minutes maximum
5. **Workspace Validation**: Resolved - Include dependency consistency

**GitHub Actions Best Practices** (from architecture):

- Use matrix builds for multiple Node versions if needed
- Leverage Turborepo's built-in caching
- Use composite actions for reusable steps
- Implement job dependencies for optimal parallelization

**Output**: research.md with implementation approach

## Phase 1: Design & Contracts

### Workflow Contracts

Generate GitHub Actions workflow schemas:

1. **Main CI Workflow** (`ci.yml`):
   - Triggers: push to main, pull_request
   - Jobs: lint, typecheck, build, test
   - Matrix: all monorepo packages
   - Caching: pnpm store
   - Artifacts: metrics and logs

2. **PR Validation** (`pr-validation.yml`):
   - Triggers: pull_request events
   - Required status checks
   - Auto-cancellation of previous runs
   - Comment with results

### Validation Points

- Workflow syntax validation
- Job dependency graph
- Secret/environment variable usage
- Permissions and security

### Quickstart Validation

Create quickstart.md with:

1. How to trigger CI manually
2. How to debug failed CI runs
3. How to update CI configuration
4. How to add new checks

### Agent Context Update

Update CLAUDE.md with:

- GitHub Actions workflow location
- Key CI commands
- Debugging approach

**Output**: contracts/ci-workflow.yml, contracts/pr-validation.yml,
quickstart.md, CLAUDE.md updates

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

**Task Generation Strategy**:

- Create main CI workflow configuration tasks
- Setup job definitions (lint, test, build, typecheck)
- Configure pnpm caching
- Setup Turborepo pipeline integration
- Configure status checks and branch protection
- Add workflow artifacts generation
- Create helper scripts for metrics

**Ordering Strategy**:

1. Basic workflow structure [P]
2. Individual job configurations [P]
3. Caching and optimization
4. Status checks and protection rules
5. Metrics and artifacts
6. Documentation and debugging aids

**Estimated Output**: 15-20 numbered tasks in tasks.md

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md) **Phase 4**:
Implementation (create workflows and test on feature branch) **Phase 5**:
Validation (verify CI runs, test all trigger paths)

## Complexity Tracking

_No violations - CI infrastructure follows all constitutional principles_

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
- [x] Complexity deviations documented (none)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
