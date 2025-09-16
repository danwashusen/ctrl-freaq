# Plan a story based on a story spec

Purpose

- Build exactly one plain-text argument string to be consumed by
  `.claude/commands/plan.md` via `$ARGUMENTS`.
- Assign that string to a variable named `ARGUMENTS`.
- Run playbook `.claude/commands/plan.md` passing the variable $ARGUMENTS as an
  argument.

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

- Architecture path: docs/architecture.md#<anchor-or-section>
- Architecture excerpt: <<ARCH_EXCERPT_START>> [Minimal, relevant passages:
  services/boundaries/data‑flows/constraints] <<ARCH_EXCERPT_END>>
- UI Architecture path: docs/ui-architecture.md#<anchor-or-section>
- UI Architecture excerpt: <<UI_EXCERPT_START>> [Minimal, relevant passages:
  components/routing/state/accessibility/styling] <<UI_EXCERPT_END>>

Standards Digest (Backend):

- Coding Standards path: docs/architecture.md#coding-standards
- Coding Standards excerpt: <<STANDARDS_EXCERPT_START>> [Top rules with brief
  bad/good examples tailored to this spec] <<STANDARDS_EXCERPT_END>>
- Additional Standards:
  - Logging: docs/architecture.md#logging-standards
  - Errors: docs/architecture.md#error-handling-strategy
  - Security: docs/architecture.md#security
  - SOC 2: docs/architecture.md#soc2-guidelines
- Additional excerpts: <<ADDL_STANDARDS_EXCERPT_START>> [Minimal, spec‑relevant
  bullets only] <<ADDL_STANDARDS_EXCERPT_END>>

UI Standards Digest (Frontend, when in scope):

- FE Standards path: docs/ui-architecture.md#frontend-developer-standards
- UI Standards excerpt: <<UI_STANDARDS_EXCERPT_START>> [React hooks rules, a11y,
  state immutability, performance, UI security, observability, testing — only
  items relevant to this spec, with short bad/good examples]
  <<UI_STANDARDS_EXCERPT_END>>

Constraints:

- Treat Architecture/UI‑Architecture excerpts and Standards Digest(s) as
  canonical for HOW‑level boundaries, integrations, observability, error
  handling, and auth.
- Treat the feature specification as canonical for WHAT/WHY; pause and reconcile
  conflicts.
- Copy “Standards Digest” (Backend) into Phase 0 research.md as a top‑level
  section named “Standards Digest”.
- If frontend is in scope, copy “UI Standards Digest” into Phase 0 research.md
  as a top‑level section named “UI Standards Digest”.
- Use absolute repo‑root paths only.

Open Questions:

- [Optional list in “[NEEDS CLARIFICATION: …]” format]
- Be conservative when resolving items that "NEEDS CLARIFICATION"

Rules

- Do not wrap the payload in fences or add any leading/trailing commentary.
- Use absolute paths and anchors for traceability; keep excerpts minimal.

Assignment

- After constructing the payload, assign it to the variable `ARGUMENTS` exactly,
  e.g., internally set: ARGUMENTS = "<the multi-line payload defined above>"
