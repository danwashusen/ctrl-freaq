# Playbook: Create Story Specification Argument

## Meta Instructions

- Always produce exactly one plain-text argument string for
  `.claude/commands/specify.md` and assign it to `ARGUMENTS`.
- Always follow the slug-plus-Context structure and keep the headings exactly as
  specified.
- Always reference repo files with absolute paths and include anchors when
  available.
- Always keep PRD and FE excerpts minimal, verbatim, and treated as canonical
  for WHAT/WHY.
- Always surface clarification questions when PRD/FE excerpts conflict with user
  free text.
- Never wrap the payload in code fences, add commentary, or output multiple
  argument strings.

## Reusable Blocks (Functions)

## Steps

1. Identify story type and prepare the slug line.
   - If the item is a Story, format the first line as
     `Story: "{epic_number}.{story_number} - {story_title}"`.
   - If the item is not a Story, format the first line as
     `"<short-branch-friendly slug>"`.
2. Gather PRD source details.
   - Locate the relevant section in `docs/prd.md` and capture its anchor (if one
     exists).
   - Extract the exact story description and acceptance criteria to paste
     between `<<PRD_EXCERPT_START>>` and `<<PRD_EXCERPT_END>>`.
3. Gather FE specification details.
   - Locate the matching section in `docs/front-end-spec.md` and capture its
     anchor or section label.
   - Extract only the minimal flow, IA, or UX passages needed and place them
     between `<<FE_EXCERPT_START>>` and `<<FE_EXCERPT_END>>`.
4. Document constraints and open questions.
   - Record the standing rule that PRD/FE excerpts define scope for WHAT/WHY.
   - If conflicts exist between PRD/FE excerpts and user free text, add an entry
     in `[NEEDS CLARIFICATION: …]` format and avoid resolving it without
     confirmation.
5. Assemble the `Context:` block immediately after the slug line.
   - Add a line `Context:` followed by the sections below.
   - List `Primary Sources:` with the PRD path, PRD excerpt block, FE path, and
     FE excerpt block in that order.
   - Add a `Constraints:` section repeating the canonical-source rule and any
     additional constraints discovered.
   - Add an `Open Questions:` section containing any clarification items or
     leave it blank if none exist.
6. Assign the payload string.
   - Concatenate the slug line and Context block with newline separators and no
     additional commentary.
   - Set `ARGUMENTS` equal to that multi-line string.
