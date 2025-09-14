# Tasks: CI Pipeline Setup

**Input**: Design documents from `/specs/003-1-2-ci/`
**Prerequisites**: plan.md (required), research.md, contracts/, quickstart.md

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Loaded: GitHub Actions CI for monorepo
   → Extract: GitHub Actions, pnpm 9.x, Turborepo 1.x, Node.js 20.x
2. Load optional design documents:
   → contracts/: ci-workflow.yml, pr-validation.yml
   → research.md: Node.js 20.x, 5-min timeout, pnpm caching
   → quickstart.md: CI debugging guide
3. Generate tasks by category:
   → Setup: GitHub Actions structure, workflow files
   → Tests: Workflow validation, dry runs
   → Core: Job definitions, caching, artifacts
   → Integration: Branch protection, status checks
   → Polish: Documentation, helper scripts
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Workflow sections = sequential updates
5. Number tasks sequentially (T001-T020)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All workflow contracts implemented
   → All jobs defined
   → Caching configured
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Workflows**: `.github/workflows/` at repository root
- **Scripts**: `scripts/ci/` for helper scripts
- **Documentation**: `docs/` and inline YAML comments

## Phase 3.1: Setup
- [ ] T001 Create `.github/workflows/` directory structure
- [ ] T002 [P] Create `scripts/ci/` directory for helper scripts
- [ ] T003 [P] Create `.github/dependabot.yml` for automated dependency updates

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These workflow tests MUST be created and MUST FAIL before implementation**
- [ ] T004 [P] Create workflow syntax validation script in `scripts/ci/validate-workflows.sh`
- [ ] T005 [P] Create dry-run test script in `scripts/ci/test-ci-locally.sh`
- [ ] T006 [P] Create branch protection validation in `scripts/ci/check-protection.sh`

## Phase 3.3: Core Implementation (ONLY after tests are failing)
### Main CI Workflow
- [ ] T007 Create `.github/workflows/ci.yml` with basic structure and triggers
- [ ] T008 Add setup job with Node.js 20.x and pnpm caching in `.github/workflows/ci.yml`
- [ ] T009 Add lint job with fail-fast strategy in `.github/workflows/ci.yml`
- [ ] T010 Add typecheck job for TypeScript validation in `.github/workflows/ci.yml`
- [ ] T011 Add build job with Turborepo integration in `.github/workflows/ci.yml`
- [ ] T012 Add test job running Vitest suites in `.github/workflows/ci.yml`
- [ ] T013 Add workspace validation job for dependency consistency in `.github/workflows/ci.yml`
- [ ] T014 Add metrics generation job with artifacts in `.github/workflows/ci.yml`

### PR Validation Workflow
- [ ] T015 Create `.github/workflows/pr-validation.yml` with concurrency control
- [ ] T016 Add changed files detection using paths-filter in `.github/workflows/pr-validation.yml`
- [ ] T017 Add PR metadata validation and auto-labeling in `.github/workflows/pr-validation.yml`
- [ ] T018 Add comment results job for PR feedback in `.github/workflows/pr-validation.yml`

## Phase 3.4: Integration
- [ ] T019 Configure required status checks in repository settings documentation
- [ ] T020 [P] Create workspace dependency check script in `scripts/ci/check-dependencies.sh`
- [ ] T021 [P] Create metrics aggregation script in `scripts/ci/generate-metrics.js`
- [ ] T022 Configure 5-minute timeout for all jobs in both workflows

## Phase 3.5: Polish
- [ ] T023 [P] Add inline documentation to all workflow files
- [ ] T024 [P] Create CI troubleshooting guide in `docs/ci-troubleshooting.md`
- [ ] T025 [P] Add workflow badges to README.md
- [ ] T026 Validate all workflows with syntax checker and dry run
- [ ] T027 Test CI pipeline on feature branch with sample PR

## Dependencies
- Setup (T001-T003) before everything
- Tests (T004-T006) before implementation (T007-T018)
- Main workflow (T007-T014) can proceed in sequence
- PR workflow (T015-T018) can proceed in sequence
- T007 required before T008-T014 (same file)
- T015 required before T016-T018 (same file)
- Integration (T019-T022) after core workflows
- Polish (T023-T027) after everything

## Parallel Example
```bash
# Phase 3.1 - Setup parallel tasks:
Task: "Create scripts/ci/ directory for helper scripts"
Task: "Create .github/dependabot.yml for automated dependency updates"

# Phase 3.2 - Test scripts parallel:
Task: "Create workflow syntax validation script in scripts/ci/validate-workflows.sh"
Task: "Create dry-run test script in scripts/ci/test-ci-locally.sh"
Task: "Create branch protection validation in scripts/ci/check-protection.sh"

# Phase 3.4 - Integration scripts parallel:
Task: "Create workspace dependency check script in scripts/ci/check-dependencies.sh"
Task: "Create metrics aggregation script in scripts/ci/generate-metrics.js"

# Phase 3.5 - Polish tasks parallel:
Task: "Add inline documentation to all workflow files"
Task: "Create CI troubleshooting guide in docs/ci-troubleshooting.md"
Task: "Add workflow badges to README.md"
```

## Notes
- [P] tasks = different files, no dependencies
- Workflow jobs (T008-T014, T016-T018) modify same file, must be sequential
- Test scripts first to validate workflow syntax
- Commit after each task for incremental progress
- Use `act` tool locally to test GitHub Actions workflows

## Task Generation Rules
*Applied during main() execution*

1. **From Contracts**:
   - ci-workflow.yml → Main CI workflow tasks (T007-T014)
   - pr-validation.yml → PR validation tasks (T015-T018)

2. **From Research**:
   - Node.js 20.x → Setup job configuration (T008)
   - 5-minute timeout → Timeout configuration (T022)
   - pnpm caching → Cache configuration (T008)

3. **From Quickstart**:
   - Debug guide → Troubleshooting documentation (T024)
   - Local testing → Test scripts (T004-T006)

4. **Ordering**:
   - Setup → Test Scripts → Workflows → Integration → Polish
   - Sequential updates within same workflow file

## Validation Checklist
*GATE: Checked by main() before returning*

- [x] All contracts have corresponding implementation tasks
- [x] Test/validation scripts come before workflow implementation
- [x] Parallel tasks work on different files
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] Workflow modifications are sequential (T008-T014, T016-T018)

## Task Completion Status - 2025-09-14 14:01

### Summary
- Total Tasks: 27
- ✅ Completed: 0 (0%)
- 🟡 Partial: 0 (0%)
- 🔶 Stubs: 0 (0%)
- ❌ Not Started: 27 (100%)

### Phase Breakdown
- Phase 3.1 Setup: 0/3 complete
- Phase 3.2 Tests: 0/3 complete
- Phase 3.3 Core: 0/12 complete
- Phase 3.4 Integration: 0/4 complete
- Phase 3.5 Polish: 0/5 complete

### Incomplete Tasks (Missing)
❌ T001: .github/workflows/ directory not found
❌ T002: scripts/ci/ directory not found
❌ T003: .github/dependabot.yml not found
❌ T004: scripts/ci/validate-workflows.sh not found
❌ T005: scripts/ci/test-ci-locally.sh not found
❌ T006: scripts/ci/check-protection.sh not found
❌ T007: .github/workflows/ci.yml not found
❌ T008-T014: Main CI workflow jobs not found
❌ T015: .github/workflows/pr-validation.yml not found
❌ T016-T018: PR validation workflow jobs not found
❌ T019: Repository settings documentation not found
❌ T020: scripts/ci/check-dependencies.sh not found
❌ T021: scripts/ci/generate-metrics.js not found
❌ T022: Timeout configuration not found in workflows
❌ T023: Workflow documentation not found
❌ T024: docs/ci-troubleshooting.md not found
❌ T025: README.md badges not found
❌ T026-T027: Validation and testing not performed

## Quickstart Coverage Analysis - 2025-09-14 14:01

### Coverage Summary
- Total Scenarios: 12
- ✅ Covered: 12 (100%)
- ❌ Missing: 0 (0%)

### Scenario Mapping
✅ **Trigger CI Manually** → T007, T015 (workflow triggers)
✅ **Debug Failed CI Runs** → T024 (troubleshooting guide), T004-T006 (test scripts)
✅ **Lint Failures** → T009 (lint job), T004 (validation script)
✅ **Type Check Failures** → T010 (typecheck job)
✅ **Test Failures** → T012 (test job), T005 (local test script)
✅ **Build Failures** → T011 (build job)
✅ **Update CI Configuration** → T023 (documentation), T026 (validation)
✅ **Add New Check** → T023 (inline docs show how to add jobs)
✅ **Add New Package to CI** → T013 (workspace validation)
✅ **CI Takes Too Long** → T022 (5-minute timeout)
✅ **Cache Not Working** → T008 (pnpm caching setup)
✅ **Concurrent PR Runs** → T015 (concurrency control)

### Integration Test Coverage
All quickstart scenarios have corresponding test tasks (T004-T006) that validate the CI pipeline functionality before implementation.