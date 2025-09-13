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
1) Required Context Gate
   - Ensure Primary Sources are present in the tasks doc and include:
     - Plan path
     - Architecture path + Architecture excerpt markers: `<<ARCH_EXCERPT_START>> … <<ARCH_EXCERPT_END>>`
     - UI Architecture path + UI excerpt markers: `<<UI_EXCERPT_START>> … <<UI_EXCERPT_END>>`
   - Fail if any of the above are missing, empty, or placeholders. Output Status: "Missing Context". STOP.

2) Plan-of-Record Gate
   - Verify `<feature>/plan.md` exists in the same directory as the tasks doc (or as referenced in Primary Sources).
   - If missing or not referenced, output Status: "Blocked by Plan" with remediation to generate/locate the plan. STOP.

3) Unknowns Gate
   - Scan the tasks doc for any remaining "[NEEDS CLARIFICATION: …]" items.
   - If any remain, output Status: "Needs Clarification" with a grouped list and suggested, succinct follow-up questions. STOP.

4) TDD Ordering Gate
   - Validate that test tasks precede implementation tasks:
     - Contract and integration tests appear before related implementation tasks.
     - Where contracts are listed in Primary Sources, there is at least one corresponding contract test task.
   - If violated, output Status: "TDD Violations" with examples and specific reorder suggestions. STOP.

5) Code Review Scope Gate
   - Establish a concrete review scope:
     - If PR number provided: fetch PR diff.
     - Else if commit range provided: use `git diff <range>`.
     - Else: compute diff from the feature branch to the repository’s default branch (merge‑base to HEAD).
   - If unable to determine scope automatically and none provided, request the user to supply PR/range. STOP.

Scope and Sources
- Primary input: the provided `tasks.md`.
- Sibling artifacts (same directory): evaluate only those explicitly referenced or expected by the tasks doc: `plan.md`, `data-model.md`, `contracts/*`, `quickstart.md`, `research.md`.
- Alignment references: `spec.md` (WHAT/WHY scope), `CONSTITUTION.md` (constitutional constraints), `docs/architecture.md`, `docs/ui-architecture.md` (HOW boundaries and conventions).
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
  - Quickstart → integration test tasks reflect listed scenarios.

- Architecture Alignment (HOW):
  - Tasks do not cross service boundaries improperly; respect routing/state patterns from UI Architecture.
  - Observability, error handling, and auth constraints from Architecture are represented as task acceptance notes or checklist items.

- Constitution Check (WHAT/WHY level constraints):
  - High-level requirements (authn, RBAC, logging, input validation, safe errors) are captured as constraints or acceptance criteria without leaking low-level HOW unrelated to tasks.

- Execution Readiness:
  - Tasks are immediately executable by an agent: specific, unambiguous, and scoped.
  - Dependencies are explicit; examples of parallel groups are provided where feasible.

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

Write‑Back Behavior (append feedback to tasks.md)
- After producing the review report, write actionable feedback as additional tasks in the same `tasks.md`:
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
- Summary: Ready for execution | Missing Context | Blocked by Plan | Needs Clarification | TDD Violations | Alignment Issues | Review Complete (with write‑backs) | Review Pending (no scope).
- Gates: pass/fail for Required Context, Plan-of-Record, Unknowns, TDD Ordering (with notes).
- Checklist Results: map to Structure & Completeness, Artifact Mapping, Architecture Alignment, Constitution Check, Execution Readiness.
- Strengths: concise positives to preserve.
- Gaps & Risks: findings with severity (Critical | Major | Minor), rationale, and section/file references.
- Proposed Improvements: concrete task-level rewrites or reorderings.
- Open Questions: any remaining items in "[NEEDS CLARIFICATION: …]" format.
- Alignment Notes: plan/spec/architecture/Constitution consistency or conflicts.
- Code Review Report: categorized findings with reasoning, evidence, and proposed diffs/tests.

Important
- Non-destructive by default; if permitted, append feedback tasks to the same `tasks.md` as a new Phase 3.<N> section. If not permitted, emit a patch for user approval.
