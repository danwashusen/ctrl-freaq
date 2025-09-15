# Start a new feature by creating a specification and feature branch.

Prepare the single argument payload for `.claude/commands/specify.md` (an LLM
instruction file). Do not execute any commands in this step.

Intent and Contract

- Purpose: Build exactly one plain-text argument string consumed by
  `.claude/commands/specify.md` via $ARGUMENTS.
- Output Contract:
  - Produce exactly ONE plain-text argument string.
  - First line must be the slug:
    - Story: "{epic_number}.{story_number} - {story_title}"
    - Non-Story: a short, branch-friendly slug describing the feature
  - Follow with the Context block exactly as defined below (Primary Sources,
    Constraints, Open Questions).
  - Do not include any commentary before/after the payload.
  - Do not wrap in code fences; no JSON/YAML; no CLI prefixes.
  - Use markers (e.g., <<PRD_EXCERPT_START>>) literally.
- Prohibited Actions (wrapper step only):
  - Do NOT run shell commands.
  - Do NOT attempt to execute `.claude/commands/specify.md` (it is not a shell
    script).
  - Do NOT prefix a CLI invocation (e.g., ".claude/commands/specify.md …").
- Template Reference:
  - Treat `.claude/commands/specify.md` as an instruction template consumed by
    an orchestrator using your single argument string via $ARGUMENTS. That file
    may run shell; you must not in this step.

Story Identifier Formatting

- epic_number: "Epic 1" → 1
- story_number: "Story 2" → 2
- story_title: exact title (no reformatting)
- Slug: "{epic_number}.{story_number} - {story_title}"
- If not a Story: Use a short, branch-friendly slug.

Inputs and Preconditions

- Verify `docs/prd.md` contains the exact Epic/Story; STOP if missing and ask to
  reconcile.
- Extract exact Story text, including acceptance criteria and relevant notes, as
  PRD excerpt.
- Extract minimal, relevant passages from `docs/front-end-spec.md` (flows/IA/UX
  goals) as FE excerpt.
- Conflict handling:
  - Prefer PRD/FE excerpts for WHAT/WHY.
  - Surface conflicts with user free-text and ask to reconcile; do not emit
    payload until confirmed.

Confirmation Step (before emitting payload)

- Present a concise summary of the Story (or feature), the PRD excerpt, and FE
  excerpt.
- Ask for confirmation or refinement.
- Only after confirmation, emit the final argument payload (structure below).

Argument Payload Structure

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

Correct vs Incorrect (for the wrapper step)

- Correct (argument only; no fences; no CLI prefix): 1.2 - Authenticated App
  Layout Primary Sources:
  - PRD path: docs/prd.md#Epic-1-Story-2
  - PRD excerpt: <<PRD_EXCERPT_START>> … <<PRD_EXCERPT_END>>
  - FE spec path: docs/front-end-spec.md#Document-Creation-Flow
  - FE excerpt: <<FE_EXCERPT_START>> … <<FE_EXCERPT_END>> Constraints:
  - Treat PRD/FE as canonical WHAT/WHY. Open Questions:
  - [NEEDS CLARIFICATION: role distinctions in layout access?]

- Incorrect:
  ```bash
  .claude/commands/specify.md "1.2 - Authenticated App Layout …"
  ```

  - Any fenced code block, CLI prefix, JSON/YAML formatting, or extra
    commentary.

Notes

- Keep excerpts minimal; avoid pasting entire sections.
- Use anchors for traceability.
- Use absolute repo-root paths when referencing files in the payload.
- The orchestrator will run `.claude/commands/specify.md` with your single
  argument string; it will create the branch and write the spec using the
  template.
