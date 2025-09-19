# Build the single $ARGUMENTS payload (assign to a variable only)

Purpose

- Build exactly one plain-text argument string to be consumed by
  `.claude/commands/tasks.md` via `$ARGUMENTS`.
- Assign that string to a variable named `ARGUMENTS`.
- Run playbook `.claude/commands/tasks.md` passing the variable $ARGUMENTS as an
  argument.
- Expand the feature research document with execution-ready Implementation
  Briefs covering every phase in the generated task list.

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
- Spec path (WHAT/WHY): <abs>/specs/<feature>/spec.md#<anchor>
- Architecture anchors: <<ARCH_ANCHORS_START>> docs/architecture.md#<anchor-one>
  docs/architecture.md#<anchor-two> <<ARCH_ANCHORS_END>>
- UI architecture anchors (if frontend-involved): <<UI_ANCHORS_START>>
  docs/ui-architecture.md#<anchor> <<UI_ANCHORS_END>>
- Research path: <abs>/specs/<feature>/research.md
- Available artifacts:
  - Data model: <abs>/specs/<feature>/data-model.md (if present)
  - Contracts dir: <abs>/specs/<feature>/contracts (if present)
  - Quickstart: <abs>/specs/<feature>/quickstart.md (if present)

Plan guidance: <<PLAN_NOTES_START>>

- Scope notes or sequencing signals required for task ordering
- Gates or assumptions that affect task readiness <<PLAN_NOTES_END>>

Standards Constraints:

- Backend standards anchors: <<BACKEND_STANDARDS_START>>
  docs/architecture.md#coding-standards docs/architecture.md#logging-standards
  docs/architecture.md#error-handling-strategy docs/architecture.md#security
  docs/architecture.md#soc2-guidelines <<BACKEND_STANDARDS_END>>
- UI standards anchors (if frontend involved): <<UI_STANDARDS_START>>
  docs/ui-architecture.md#frontend-developer-standards <<UI_STANDARDS_END>>

Implementation Briefs Write-Back

- After generating `tasks.md`, read the latest research document at
  `<abs>/specs/<feature>/research.md`.
- Replace (or create) a block that begins with `## Implementation Briefs`
  followed by `<!-- story-tasks:auto -->` and ends with
  `<!-- /story-tasks:auto -->`.
- Inside the block, emit one subsection per phase or remediation group you
  output in `tasks.md` using the format
  `### Phase 3.x – <Phase name> (T###–T###)`.
- Within each subsection include the following bullet groups:
  - `Anchors:` list 1-3 absolute paths with anchors that justify the phase
    decisions.
  - `Intent:` 1-2 bullets (<=20 words each) describing what the phase achieves
    and why sequencing matters.
  - `Task coverage:` bullets mapping task IDs to the key work product or
    acceptance shorthand.
  - `Acceptance focus:` bullets naming the tests or quality gates that must fail
    then pass.
  - `Quality guards:` bullets for cross-cutting requirements (auth, logging,
    validation, accessibility, performance, observability, etc.).
- Keep bullets tight (maximum three per group) and reuse anchors already
  gathered for task generation.
- Regenerate the entire block on every run so briefs always stay in sync with
  `tasks.md`.

Constraints

- Treat plan.md as the plan-of-record for scope and sequencing.
- Treat architecture/UI anchors as canonical for HOW boundaries and controls.
- Treat spec.md as canonical for WHAT/WHY; flag conflicts as open questions.
- Implementation Briefs must stay synchronized with the generated tasks. Do not
  leave stale subsections.
- Remove unused marker blocks (e.g., `<<UI_ANCHORS_START>>` when no frontend
  work).

Open Questions:

- [Optional list in `[NEEDS CLARIFICATION: …]` format]
- Be conservative when resolving items that "NEEDS CLARIFICATION".

Rules

- Do not wrap the payload in fences or add leading/trailing commentary.
- Maintain whitespace exactly as defined in marker blocks.
- Avoid duplicating large excerpts; rely on anchors plus intent summaries.

Assignment

- After constructing the payload, assign it to the variable `ARGUMENTS` exactly,
  e.g., internally set: ARGUMENTS = "<the multi-line payload defined above>".
