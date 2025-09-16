# Build the single $ARGUMENTS payload (assign to a variable only)

Purpose

- Build exactly one plain-text argument string to be consumed by
  `.claude/commands/tasks.md` via `$ARGUMENTS`.
- Assign that string to a variable named `ARGUMENTS`. Do not execute anything,
  do not print extra commentary.

Output Contract

- Set variable: `ARGUMENTS` = the complete, multi-line payload described below.
- Exactly ONE argument string; no code fences, no JSON/YAML, no CLI prefixes.
- The value begins with a slug line, followed by a Context block using the exact
  headings and markers.

Argument Payload Format

- First line (slug):
  - `Tasks for: <absolute-plan-path or absolute-feature-dir>`

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
  queries; immutable state updates; lazy routes/code-splitting; browser Pino
  logging with redaction; RTL best practices] <<UI_STANDARDS_EXCERPT_END>>

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
- Be conservative when resolving items that "NEEDS CLARIFICATION"

Rules

- Do not wrap the payload in fences or add any leading/trailing commentary.
- Use absolute repo-root paths and anchors for traceability; keep excerpts
  minimal.

Assignment

- After constructing the payload, assign it to the variable `ARGUMENTS` exactly,
  e.g., internally set: ARGUMENTS = "<the multi-line payload defined above>"
