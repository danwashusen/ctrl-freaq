Start a new feature by creating a specification and feature branch.

Primary Sources (Canonical)
- docs/prd.md is the authoritative source for product requirements and Story definitions.
- docs/front-end-spec.md is the authoritative source for UI/UX goals, IA, flows, and design constraints.
- Do not proceed unless both documents have been read and relevant sections identified.

Formatting the Story identifier
1. Define epic_number as the Epic number (e.g., "Epic 1" → 1).
2. Define story_number as the Story number (e.g., "Story 2" → 2).
3. Define story_title as the exact Story title (no reformatting).
4. Output "{epic_number}.{story_number} - {story_title}".

Context preparation (required before calling specify)
1. Read docs/prd.md and locate the exact Epic/Story. If missing, STOP and ask the user to reconcile or correct the reference.
2. Extract the exact Story text, including acceptance criteria and relevant notes, as the PRD excerpt.
3. Identify relevant sections from docs/front-end-spec.md (flows/IA/UX goals). Extract only the most relevant passages as the FE excerpt.
4. If the user’s free‑text description conflicts with PRD/FE excerpts:
   - Prefer PRD/FE content.
   - Show the conflict, ask the user which to use or how to reconcile. Do not proceed until confirmed.

Invocation rules
- The `.claude/commands/specify.md` command is immutable and only accepts a single argument string.
- Construct that argument to begin with a short, branch‑friendly slug line, followed by a structured Context block that embeds PRD/FE excerpts.
- The slug MUST be the first line; keep it concise so branch naming remains clean.

Given the feature description provided as an argument, do this
1) If the feature description specifies a Story (e.g., "Epic 1, Story 2"):
   1. Verify the Story exists in docs/prd.md; STOP with a clear message if not found.
   2. Show the exact Story content and the selected FE excerpts to the user; ask for confirmation.
   3. When confirmed, invoke `.claude/commands/specify.md` with a single argument constructed as follows:

      First line (slug):
      "{epic_number}.{story_number} - {story_title}"

      Then a Context block:
      "
      Primary Sources:
      - PRD path: docs/prd.md#{anchor-if-available}
      - PRD excerpt:
      <<PRD_EXCERPT_START>>
      [Paste exact Story text (description, ACs)]
      <<PRD_EXCERPT_END>>
      - FE spec path: docs/front-end-spec.md#{anchor-or-section}
      - FE excerpt:
      <<FE_EXCERPT_START>>
      [Paste only relevant flow/IA/UX passages]
      <<FE_EXCERPT_END>>

      Constraints:
      - Treat PRD/FE excerpts as canonical for WHAT/WHY.
      - If any conflict with user free-text, prefer these excerpts and surface a clarification question.

      Open Questions:
      - [Optional list in “[NEEDS CLARIFICATION: …]” format]
      "

2) If the feature description is not a Story:
   1. Restate the feature and show the relevant PRD/FE excerpts that justify scope; ask for confirmation or refinement.
   2. When confirmed, invoke `.claude/commands/specify.md` with the same argument structure:
      - First line: a short slug that captures the feature succinctly.
      - Context block with PRD/FE paths and minimal, relevant excerpts.
      - Constraints + Open Questions as above.

Example argument payload (single argument string)
1.2 - Authenticated App Layout

Primary Sources:
- PRD path: docs/prd.md#Epic-1-Story-2
- PRD excerpt:
<<PRD_EXCERPT_START>>
[Paste the exact Story description and ACs]
<<PRD_EXCERPT_END>>
- FE spec path: docs/front-end-spec.md#Document-Creation-Flow
- FE excerpt:
<<FE_EXCERPT_START>>
[Paste the most relevant flow/IA passages about layout, navigation, and editor entry points]
<<FE_EXCERPT_END>>

Constraints:
- Treat PRD/FE excerpts as canonical WHAT/WHY sources.
- If the user description diverges, prefer excerpts and ask to reconcile.

Open Questions:
- [NEEDS CLARIFICATION: role distinctions in layout access?]
- [NEEDS CLARIFICATION: initial dashboard widgets?]
