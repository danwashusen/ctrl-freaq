# Create a detailed spec for a Story

Purpose

- Build exactly one plain-text argument string to be consumed by
  `.claude/commands/specify.md` via `$ARGUMENTS`.
- Assign that string to a variable named `ARGUMENTS`.
- Run playbook `.claude/commands/specify.md` passing the variable $ARGUMENTS as
  an argument.

Output Contract

- Set variable: `ARGUMENTS` = the complete, multi-line payload described below.
- Exactly ONE argument string; no code fences, no JSON/YAML, no CLI prefixes.
- The value begins with a slug line, followed by a Context block using the exact
  headings and markers.

Argument Payload Format

- First line (slug):
  - Story: "{epic_number}.{story_number} - {story_title}"
  - Non-Story: "<short-branch-friendly slug>"

- Then the Context block (no extra commentary):

Primary Sources:

- PRD path: docs/prd.md#<anchor-if-available>
- PRD excerpt: <<PRD_EXCERPT_START>> [Paste exact Story text (description, ACs)]
  <<PRD_EXCERPT_END>>
- FE spec path: docs/front-end-spec.md#<anchor-or-section>
- FE excerpt: <<FE_EXCERPT_START>> [Minimal, relevant flow/IA/UX passages]
  <<FE_EXCERPT_END>>

Constraints:

- Treat PRD/FE excerpts as canonical for WHAT/WHY.
- If any conflict with user free-text, prefer these excerpts and surface a
  clarification question.

Open Questions:

- [Optional list in “[NEEDS CLARIFICATION: …]” format]
- Be conservative when resolving items that "NEEDS CLARIFICATION"

Rules

- Do not wrap the payload in fences or add any leading/trailing commentary.
- Use absolute repo-root paths when referencing files inside the payload.
- Keep excerpts minimal; use anchors for traceability.

Assignment

- After constructing the payload, assign it to the variable `ARGUMENTS` exactly,
  e.g., internally set: ARGUMENTS = "<the multi-line payload defined above>"
