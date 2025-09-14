Validate the tasks document and perform an S‑tier code review for a specific feature.

Given the tasks document path as an argument (e.g., "specs/002-feature/tasks.md"), perform:
- A scope‑correct validation aligned with the /tasks command intent and `.specify/templates/tasks-template.md`.
- An S‑tier code review assuming the reviewer LLM is more capable than the implementer/fixer LLM; include detailed reasoning, evidence, and actionable fixes.

Inputs
- Required: path to `tasks.md`.
- Optional (for code review scope):
  - PR number OR commit range (e.g., `BASE..HEAD`) OR branch to compare against default branch.
  - File filters (globs) to narrow the review set.
  - Known environment or reproduction notes (if any).

Early Gates (stop if any fail)
1) Design Documents Gate
   - Verify required design documents exist in the feature directory:
     - `research.md` contains technical decisions and architecture patterns
     - `plan.md` exists with implementation roadmap
     - `data-model.md` exists if data entities are involved
     - `contracts/` directory exists if API endpoints are defined
   - If critical documents are missing, output Status: "Missing Design Docs" with list of missing files. STOP.

2) Plan-of-Record Gate
   - Verify `<feature>/plan.md` exists in the same directory as the tasks doc (or as referenced in Primary Sources).
   - If missing or not referenced, output Status: "Blocked by Plan" with remediation to generate/locate the plan. STOP.

3) Unknowns Gate
   - Scan the tasks doc for any remaining "[NEEDS CLARIFICATION: …]" items.
   - If any remain, output Status: "Needs Clarification" with a grouped list and suggested, succinct follow-up questions. STOP.

4) TDD Ordering Gate
   - Validate that test tasks precede implementation tasks:
     - Contract and integration tests appear before related implementation tasks.
     - Where contracts exist in contracts/ directory, there is at least one corresponding contract test task.
   - If violated, output Status: "TDD Violations" with examples and specific reorder suggestions. STOP.

5) Code Review Scope Gate
   - Establish a concrete review scope:
     - If PR number provided: fetch PR diff.
     - Else if commit range provided: use `git diff <range>`.
     - Else: compute diff from the feature branch to the repository's default branch (merge‑base to HEAD).
   - If unable to determine scope automatically and none provided, request the user to supply PR/range. STOP.

6) Task Completion Audit Gate
   - For each task in tasks.md, analyze intent and verify implementation status:
     - Parse task ID, description, and target file path from task text
     - Understand the task intent: what should be accomplished?
     - Check for expected artifacts and functionality
     - Classify completion state: Complete/Partial/Stub/Not Started
   - Build completion map: {taskId: completionState, evidence: string}
   - Calculate overall completion percentage

7) Quickstart Verification Gate
   - Check if quickstart.md exists in the same directory as tasks.md
   - If quickstart.md exists, parse all verification steps from sections like "Verification Steps", "Backend Health Check", "Frontend Access", etc.
   - Map each quickstart verification scenario to corresponding tasks in tasks.md:
     - Health check endpoints → endpoint implementation and test tasks
     - CLI verification commands → CLI interface and test tasks
     - Frontend access flows → frontend component and integration test tasks
     - Database operations → repository and migration test tasks
     - Build/test commands → build configuration and test setup tasks
   - Calculate quickstart coverage: (covered scenarios / total scenarios) * 100
   - If coverage < 80%, output Status: "Insufficient Quickstart Coverage" with list of unmapped scenarios. STOP.
   - If quickstart.md exists but no integration test tasks reference quickstart scenarios, output Status: "Missing Quickstart Integration Tests". STOP.

Scope and Sources
- Primary input: the provided `tasks.md`.
- Sibling artifacts (same directory): evaluate only those explicitly referenced or expected by the tasks doc: `plan.md`, `data-model.md`, `contracts/*`, `quickstart.md`, `research.md`.
- Note: Architecture details should be extracted from `research.md` which contains feature-specific architectural decisions, NOT from primary architecture documents which are too generic.
- Alignment references: `spec.md` (WHAT/WHY scope), `CONSTITUTION.md` (constitutional constraints).
- Do not require or load `docs/architecture.md` or `docs/ui-architecture.md` unless specifically debugging architectural violations.
- Do not scan unrelated files.

Validation Criteria (when gates pass)
- Structure & Completeness:
  - Title references correct feature name consistent with plan.md.
  - Tasks are numbered sequentially (T001, T002, …) with unique IDs.
  - Each task includes concrete file paths and clear outcomes; avoid vague actions.
  - Parallelization markers [P] used only when tasks touch different files or independent subsystems.

- Artifact Mapping:
  - Contracts → at least one contract test task per contract file; endpoint impl tasks exist and depend on prior tests.
  - Data-model → model or schema tasks for each key entity.
  - Quickstart → comprehensive mapping of verification scenarios to test tasks:
    * Health check scenarios → endpoint implementation tasks with corresponding integration tests
    * CLI verification commands → CLI interface tasks with test coverage for help flags and core functionality
    * Frontend access flows → UI component tasks, authentication integration tasks, and end-to-end tests
    * Database setup steps → migration tasks, repository implementation tasks, and connection tests
    * Build/test verification → build configuration tasks, test setup tasks, and deployment pipeline tasks
    * Environment configuration → config file tasks, environment variable validation tasks
    * Logging verification → structured logging implementation tasks and log format validation tests
    * Error handling scenarios → error middleware tasks and error response format tests
    * Each quickstart verification step should have at least one corresponding test task that validates the expected behavior.

- Architecture Alignment (HOW):
  - Tasks do not cross service boundaries improperly; respect routing/state patterns from UI Architecture.
  - Observability, error handling, and auth constraints from Architecture are represented as task acceptance notes or checklist items.

- Constitution Check (WHAT/WHY level constraints):
  - High-level requirements (authn, RBAC, logging, input validation, safe errors) are captured as constraints or acceptance criteria without leaking low-level HOW unrelated to tasks.

- Execution Readiness:
  - Tasks are immediately executable by an agent: specific, unambiguous, and scoped.
  - Dependencies are explicit; examples of parallel groups are provided where feasible.

Task Completion Audit (Intent-Based Analysis)
- For each task (T001-TXXX), determine completion through intent analysis:
  - Parse task description to understand the expected outcome
  - Identify target artifacts: files, directories, configurations, tests
  - Verify completion through multiple signals:
    * Primary: Does the main artifact exist?
    * Secondary: Does it contain expected functionality?
    * Tertiary: Is it integrated with the rest of the system?

- Completion State Classification:
  - ✅ Complete: All indicators positive, meaningful implementation exists
  - 🟡 Partial: Main artifact exists but missing key elements
  - 🔶 Stub: File/directory exists but only placeholder content
  - ❌ Not Started: No evidence of implementation

- Smart Detection Patterns by Task Type:
  * "Create X package structure in /path/"
    → Check: directory exists, has package.json, has src/ structure
  * "X CLI interface in /path/cli.ts"
    → Check: file exists, exports CLI class/function, responds to --help
  * "Contract/integration test for X"
    → Check: test file exists, contains describe/test blocks, tests are not skipped
  * "X model and repository in /path/"
    → Check: file exists, exports model class/schema, has CRUD operations
  * "X endpoints (GET/POST) in /path/routes.ts"
    → Check: file exists, exports route handlers, handlers have proper signatures
  * "Configure X in /config.file"
    → Check: config file exists, contains expected settings, valid syntax
  * "Service/middleware implementation in /path/"
    → Check: file exists, exports expected functions/classes, has core logic
  * "Health check endpoint in /path/"
    → Check: endpoint file exists, returns status information, includes service metadata
  * "Environment setup task for X"
    → Check: environment files exist, contain required variables, have proper format
  * "Database migration/setup in /path/"
    → Check: migration files exist, contain schema definitions, have proper versioning
  * "Build configuration in /path/"
    → Check: build config exists, has proper targets/scripts, includes all dependencies
  * "Authentication integration in /path/"
    → Check: auth middleware exists, handles tokens/sessions, includes error cases
  * "Logging setup/configuration in /path/"
    → Check: logger config exists, structured format defined, includes log levels
  * "Error handling middleware in /path/"
    → Check: error handler exists, catches exceptions, returns consistent format

- Review/Fix Task Patterns:
  * "TXYZ: [Category] Summary — File: path[:line-range]"
    → Parse category, severity, and fix requirements from task structure
    → Identify task type: Initial implementation vs Fix/Review task
    → For fix tasks, check if specific issue is resolved:
      - [Security]: Vulnerable pattern removed, secure alternative present
        Examples: Math.random() → crypto.randomUUID(), plaintext → hashed
      - [Correctness]: Logic error fixed, correct implementation exists
        Examples: Missing null checks added, wrong calculations corrected
      - [Performance]: Optimization applied, inefficiency removed
        Examples: Race conditions fixed, memory leaks plugged, caching added
      - [Testing]: Tests added/fixed, coverage improved
        Examples: Import paths corrected, assertions added, tests not skipped
      - [API/Contract]: Endpoint compliance, response format correct
        Examples: Missing routes implemented, response structure matches spec
      - [Observability]: Logging/metrics added where needed
        Examples: Correlation IDs added, structured logging implemented
      - [Maintainability]: Code quality improved, patterns consistent
        Examples: Mixed imports unified, magic numbers replaced with constants
    → Line-specific verification when :line-number provided:
      - Read specific line range (line ± 5)
      - Verify exact issue at that location is fixed
    → File-level verification when no line number:
      - Check entire file for pattern fixes
      - Verify all instances of issue are resolved
    → Confidence levels for fix verification:
      - ✅ High: Anti-pattern gone, fix implemented, no related TODOs
      - 🟡 Medium: Issue addressed differently, partial fix, or missing tests
      - 🔶 Low: File modified but fix unclear
      - ❌ Not Fixed: Original issue still present

- Quality Indicators:
  - Non-trivial implementation (not just empty functions)
  - No TODO/FIXME/NOT_IMPLEMENTED comments
  - Exports match expected interface
  - For tests: Contains actual assertions
  - For configs: Not just boilerplate defaults

S‑Tier Code Review (when scope established)
- Review depth and reasoning:
  - Provide detailed reasoning for each finding; include evidence (code excerpts with file:line), impact analysis, and suggested fixes.
  - Treat the reviewer as more capable than the implementer; challenge design choices and test adequacy.
  - Classify findings: Correctness, Security, Performance, Reliability, API/Contract, Observability, Testing, Accessibility, Maintainability, Style.
- Coverage and mapping:
  - Map findings to Architecture/UI boundaries (HOW) and Spec acceptance criteria (WHAT/WHY) to detect scope drift or boundary violations.
  - Verify tests meaningfully exercise critical paths; propose additional tests where coverage is insufficient.
- Constitution alignment:
  - Evaluate authn/RBAC, logging, input validation, error handling, and data protection practices against `CONSTITUTION.md`.
- Remediation quality:
  - For each finding, propose a concrete fix plan with minimal, safe diffs; include test additions/updates, observability hooks, and migration notes when relevant.

Write‑Back Behavior (update checkboxes and append feedback to tasks.md)
- FIRST: Update task completion status based on audit:
  - For each task, update checkbox based on completion state:
    * Change `- [ ] T001` to `- [x] T001` for ✅ Complete tasks
    * Keep `- [ ] T002` for 🟡 Partial, 🔶 Stub, or ❌ Not Started
  - Preserve all other task text exactly as-is

- SECOND: Add completion status report as a new section:
  ```
  ## Task Completion Status - <YYYY-MM-DD HH:MM>

  ### Summary
  - Total Tasks: XX
  - ✅ Completed: XX (XX%)
  - 🟡 Partial: XX (XX%)
  - 🔶 Stubs: XX (XX%)
  - ❌ Not Started: XX (XX%)

  ### Phase Breakdown
  - Phase 3.1 Setup: X/X complete
  - Phase 3.2 Tests: X/X complete
  - Phase 3.3 Core: X/X complete
  - Phase 3.4 Integration: X/X complete
  - Phase 3.5 Polish: X/X complete

  ### Completed Tasks (Evidence)
  ✅ T001: Monorepo structure created (package.json, pnpm-workspace.yaml exist)
  ✅ T014: Service locator implemented (service-locator.ts with full implementation)
  [List all completed with evidence...]

  ### Incomplete Tasks (Missing)
  ❌ T040: Base repository not found (/packages/shared-data/src/repositories/base-repository.ts)
  🟡 T020: Package structure partial (missing repository subdirectory)
  [List all incomplete with reasons...]
  ```

- THIRD: After completion updates, write actionable feedback as additional tasks in the same `tasks.md`:
  - Insert a new phase section titled:
    `## Phase 3.<N>: Code Review Feedback from <YYYY-MM-DD HH:MM>` (short local time; 24‑hour)
  - Determine `<N>` by scanning existing headings `## Phase 3.<n>:`; if none, start at `3.1`.
  - Continue task numbering from the highest existing `T###` in the file (preserve zero‑padding).
  - For each finding, add a task with this structure:
    - `TXYZ: [Category] Summary — File: path[:line-range]`
      - Why: concise impact rationale (user/system risk)
      - Severity: Critical | Major | Minor
      - Fix: concrete steps (tests first, then implementation)
      - Links: spec/architecture anchors, commits/PR references
  - Respect TDD: include or reference a preceding test task for each implementation fix.
- If file is write‑protected or editing is not permitted, output a ready‑to‑apply patch diff instead of modifying files.

Output Format
- Summary: Ready for execution | Missing Context | Blocked by Plan | Needs Clarification | TDD Violations | Insufficient Quickstart Coverage | Missing Quickstart Integration Tests | Alignment Issues | Review Complete (XX% tasks implemented) | Review Pending (no scope).
- Implementation Progress: XX/XX tasks complete (XX%)
  - ✅ Completed phases: [list completed phases]
  - 🚧 In-progress phases: [list partial phases]
  - ⏳ Not started phases: [list pending phases]
- Quickstart Coverage: XX/XX scenarios covered (XX%)
  - ✅ Covered scenarios: [list scenarios with corresponding tasks]
  - ❌ Missing scenarios: [list unmapped verification steps]
  - 🔍 Recommended tests: [suggest integration tests for uncovered scenarios]
- Gates: pass/fail for Required Context, Plan-of-Record, Unknowns, TDD Ordering, Task Completion Audit, Quickstart Verification (with notes).
- Checklist Results: map to Structure & Completeness, Artifact Mapping, Architecture Alignment, Constitution Check, Execution Readiness, Task Completion.
- Strengths: concise positives to preserve.
- Gaps & Risks: findings with severity (Critical | Major | Minor), rationale, and section/file references.
- Proposed Improvements: concrete task-level rewrites or reorderings.
- Open Questions: any remaining items in "[NEEDS CLARIFICATION: …]" format.
- Alignment Notes: plan/spec/architecture/Constitution consistency or conflicts.
- Code Review Report: categorized findings with reasoning, evidence, and proposed diffs/tests.

Important
- Non-destructive by default; if permitted, append feedback tasks to the same `tasks.md` as a new Phase 3.<N> section. If not permitted, emit a patch for user approval.
