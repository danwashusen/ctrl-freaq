# Plan a story based on a story spec

Purpose

- Build exactly one plain-text argument string to be consumed by
  `.claude/commands/plan.md` via `$ARGUMENTS`.
- Assign that string to a variable named `ARGUMENTS`.
- Run playbook `.claude/commands/plan.md` passing the variable $ARGUMENTS as an
  argument.
- Read the full feature spec and canonical architecture documents before
  assembling research outputs.

Output Contract

- Set variable: `ARGUMENTS` = the complete, multi-line payload described below.
- Exactly ONE argument string; no code fences, no JSON/YAML, no CLI prefixes.
- The value begins with a slug line, followed by a Context block using the exact
  headings and markers.

Argument Payload Format

- First line:
  - `Plan for: <absolute-spec-path>`

- Then the Context block (no extra commentary):

Primary Sources:

- Feature spec: <abs>/specs/<feature>/spec.md#<anchor-or-section>
- Architecture anchors: <<ARCH_ANCHORS_START>> docs/architecture.md#<anchor-one>
  docs/architecture.md#<anchor-two> <<ARCH_ANCHORS_END>>
- UI architecture anchors (if frontend in scope): <<UI_ANCHORS_START>>
  docs/ui-architecture.md#<anchor-one> <<UI_ANCHORS_END>>
- Supporting docs (data-model, quickstart, contracts, etc.):
  <<SUPPORTING_SOURCES_START>> <abs>/specs/<feature>/research.md#<section>
  <abs>/specs/<feature>/data-model.md#<section> <<SUPPORTING_SOURCES_END>>

Research Deliverables:

- Generate or update Phase 0 `research.md` with:
  - "Standards Digest" summarizing backend controls derived from architecture
    anchors.
  - "UI Standards Digest" when frontend is in scope, derived from UI
    architecture anchors.
  - Technical decisions and rationale tied to absolute anchors.
  - Open questions in `[NEEDS CLARIFICATION: …]` format when unresolved.
- Reserve Implementation Briefs for the Story Tasks playbook; do not create
  briefs in this phase.

Constraints:

- Treat architecture and UI architecture documents as canonical for HOW-level
  constraints, integrations, observability, error handling, and auth.
- Treat the feature specification as canonical for WHAT/WHY; reconcile conflicts
  before proceeding.
- Use absolute repo-root paths only; reference anchors explicitly.
- Research outputs must stay concise and reference-backed; avoid copying entire
  documents.

Open Questions:

- [Optional list in `[NEEDS CLARIFICATION: …]` format]
- Be conservative when resolving items that "NEEDS CLARIFICATION".

Rules

- Do not wrap the payload in fences or add leading/trailing commentary.
- Maintain whitespace exactly as defined in markers; remove unused marker blocks
  entirely.

Assignment

- After constructing the payload, assign it to the variable `ARGUMENTS` exactly,
  e.g., internally set: ARGUMENTS = "<the multi-line payload defined above>".
