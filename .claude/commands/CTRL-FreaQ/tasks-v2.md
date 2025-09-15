# Break down the plan into executable tasks.

Prepare the single argument payload for `.claude/commands/tasks.md` (an LLM
instruction file). Do not execute any commands in this step.

Intent and Contract

- Purpose: Prepare exactly one plain-text argument string for
  `.claude/commands/tasks.md` via $ARGUMENTS.
- Output Contract:
  - Produce exactly ONE plain-text argument string.
  - First line must be the slug: "Tasks for:
    <absolute-plan-path or absolute-feature-dir>"
  - Follow with the Context block exactly as defined below (Primary Sources,
    Plan/Architecture/UI excerpts, Standards Constraints, Constraints, Open
    Questions).
  - Do not include any commentary before/after the payload.
  - Do not wrap in code fences; no JSON/YAML; no CLI prefixes.
  - Use markers (e.g., <<PLAN_EXCERPT_START>>) literally.
- Prohibited Actions (wrapper step only):
  - Do NOT run shell commands.
  - Do NOT attempt to execute `.claude/commands/tasks.md` (it is not a shell
    script).
  - Do NOT prefix a CLI invocation (e.g., ".claude/commands/tasks.md …").
- Template Reference:
  - Treat `.claude/commands/tasks.md` as an LLM instruction template that a
    separate orchestrator will run with your single argument string via
    $ARGUMENTS. That file may run shell scripts; do not do so in this wrapper
    step.

Inputs and Preconditions

- Verify the target feature directory exists and contains a `plan.md`; STOP if
  missing and ask to reconcile.
- Read `plan.md` minimally:
  - Capture plan title, scope summary, execution status, TDD intent, and gates.
- Extract minimal, relevant Architecture/UI-Architecture constraints:
  - Architecture: boundaries, services, data flow/contracts,
    observability/testing relevant to task grouping.
  - UI Architecture: components/routing/state/accessibility that affect
    decomposition and ordering.
- Standards Constraints:
  - Read the “Standards Digest” (Backend) and, if frontend is in scope, the “UI
    Standards Digest” from `plan.md` or `research.md`.
  - Turn key rules into acceptance criteria (e.g., Service Locator usage, Zod
    validation, structured logging with requestId, React hooks rules, a11y
    checks, immutability).

Frontend Scope Detection

- Treat the feature as “frontend-involved” if plan/spec mentions: React, UI,
  apps/web, component, page, routing, hooks, shadcn, Tailwind, .tsx.
- If frontend-involved → include UI Standards Constraints; otherwise note “N/A”.

Confirmation Step (before emitting payload)

- Present a concise summary of the plan scope, selected Architecture/UI
  excerpts, discovered artifacts (if any), and Standards Constraints.
- Ask the user to confirm/refine. Only after confirmation, emit the final
  argument payload (structure below).

Argument Payload Structure

- First line (slug):
  - Tasks for: <absolute-plan-path or absolute-feature-dir>

- Then the Context block (no extra commentary):

Primary Sources:

- Plan path: <abs>/specs/<feature>/plan.md#<anchor>
- Architecture path: docs/architecture.md#<anchor>
- UI Architecture path: docs/ui-architecture.md#<anchor>
- Spec path (WHAT/WHY): <abs>/specs/<feature>/spec.md#<anchor>
- Available artifacts:
  - Data model: <abs>/specs/<feature>/data-model.md (if present)
  - Contracts dir: <abs>/specs/<feature>/contracts (if present)
  - Quickstart: <abs>/specs/<feature>/quickstart.md (if present)
  - Research: <abs>/specs/<feature>/research.md (if present)

Plan excerpt: <<PLAN_EXCERPT_START>> [Paste only the most relevant plan sections
for task generation: scope, sequencing intent, TDD emphasis, gating]
<<PLAN_EXCERPT_END>>

Architecture excerpt: <<ARCH_EXCERPT_START>> [Only
boundaries/services/data-flow/observability that affect task grouping/order]
<<ARCH_EXCERPT_END>>

UI Architecture excerpt: <<UI_EXCERPT_START>> [Only
components/routing/state/accessibility that affect task decomposition]
<<UI_EXCERPT_END>>

Standards Constraints:

- Backend standards: <<STANDARDS_EXCERPT_START>> [Acceptance criteria: Service
  Locator only; Zod validation at API boundaries; structured Pino logging with
  requestId; Repository Pattern (no raw SQL in routes); TDD tests first; no
  console in app code] <<STANDARDS_EXCERPT_END>>
- UI standards (if frontend-involved): <<UI_STANDARDS_EXCERPT_START>>
  [Acceptance criteria: React hooks rules; accessibility alt-text and role-based
  queries; immutable state updates with Immer/Zustand; lazy
  routes/code-splitting; browser Pino logging with redaction; RTL best
  practices] <<UI_STANDARDS_EXCERPT_END>>

Constraints:

- Treat plan as the plan-of-record for immediate scope and task boundaries.
- Treat Architecture/UI excerpts as canonical for HOW boundaries/patterns.
- Treat spec as canonical for WHAT/WHY; surface and reconcile conflicts before
  proceeding.
- Use absolute paths; generate tasks that are directly executable; favor [P]
  markers when file-level independence exists.
- Incorporate Standards Constraints as task-level acceptance criteria and
  explicit checklist items.

Open Questions:

- [Optional list in “[NEEDS CLARIFICATION: …]” format]

Task Generation Emphasis (for the base tasks command)

- Respect TDD ordering: write tests before implementation; plan
  contract/integration tests to fail first.
- Parallelization rules: different files → [P] allowed; shared files →
  sequential (no [P]).
- Map artifacts to task types:
  - Each contract file → contract test task [P]
  - Each entity in data-model → model creation task [P]
  - Each endpoint → implementation task (sequential if shared files)
  - Each user story (from spec) → integration test task [P]
- Output should include numbered tasks (T001, T002, …), file-path specificity,
  dependency notes, and parallel execution guidance.

Correct vs Incorrect (for the wrapper step)

- Correct (argument only; no fences; no CLI prefix): Tasks for:
  /abs/path/specs/002-1-1-auth-layout/plan.md Primary Sources:
  - Plan path: /abs/path/specs/002-1-1-auth-layout/plan.md#Tasks-Scope
  - Architecture path: docs/architecture.md#Services-and-Boundaries
  - UI Architecture path: docs/ui-architecture.md#Routing-and-State
  - Spec path: /abs/path/specs/002-1-1-auth-layout/spec.md#Acceptance
  - Available artifacts:
    - Data model: /abs/path/specs/002-1-1-auth-layout/data-model.md
    - Contracts dir: /abs/path/specs/002-1-1-auth-layout/contracts
    - Quickstart: /abs/path/specs/002-1-1-auth-layout/quickstart.md
    - Research: /abs/path/specs/002-1-1-auth-layout/research.md Plan excerpt:
      <<PLAN_EXCERPT_START>> … <<PLAN_EXCERPT_END>> Architecture excerpt:
      <<ARCH_EXCERPT_START>> … <<ARCH_EXCERPT_END>> UI Architecture excerpt:
      <<UI_EXCERPT_START>> … <<UI_EXCERPT_END>> Standards Constraints:
  - Backend standards: <<STANDARDS_EXCERPT_START>> … <<STANDARDS_EXCERPT_END>>
  - UI standards: <<UI_STANDARDS_EXCERPT_START>> … <<UI_STANDARDS_EXCERPT_END>>
    Constraints:
  - … Open Questions:
  - …

- Incorrect:
  ```bash
  .claude/commands/tasks.md "Tasks for: /abs/path/specs/002-1-1-auth-layout/plan.md …"
  ```

  - Any fenced code block, CLI prefix, JSON/YAML formatting, or extra
    commentary.

Notes

- Keep excerpts minimal and directly relevant; avoid pasting entire sections.
- Prefer section anchors and absolute repo-root paths.
- If Standards Digests are missing in plan/research, include a minimal subset
  from `docs/architecture.md#coding-standards` (and `docs/ui-architecture.md`
  when frontend-involved) and note the fallback.
- The orchestrator will run `.claude/commands/tasks.md` with your single
  argument string and can run shell (e.g., check-task-prerequisites.sh); do not
  do so in this wrapper step.
