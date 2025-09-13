Plan how to implement the specified feature.

Primary Sources (Canonical)
- docs/architecture.md is the authoritative source for system/backend architecture: boundaries, services, data flow, integration patterns, coding standards, and non‑functional constraints.
- docs/ui-architecture.md is the authoritative source for frontend architecture: component model, routing, state/data layer, accessibility, and styling conventions.
- Do not proceed unless both documents have been read and the most relevant sections for this feature are identified.

Context preparation (required before calling /plan)
1. Verify the implementation details document (spec) exists; STOP with a clear message if not found.
2. Output a concise summary of the spec and ask the user to confirm or refine scope.
3. From docs/architecture.md, identify only the sections that constrain or inform this feature (services, boundaries, data contracts, observability/testing requirements). Extract minimal, relevant excerpts.
4. From docs/ui-architecture.md, identify only the sections that constrain or inform the UI for this feature (components, routing, state patterns, accessibility). Extract minimal, relevant excerpts.
5. If any conflict exists between the spec and the architecture docs:
   - Treat architecture docs as canonical for HOW‑level boundaries and constraints.
   - Treat the spec as canonical for WHAT/WHY.
   - Surface the conflict and ask the user how to reconcile; do not proceed until confirmed.

Invocation rules
- The `.claude/commands/plan.md` command is immutable and only accepts a single argument string.
- Construct that single argument to begin with a short, branch‑friendly slug or a clear "Plan for: <spec-path>" line, followed by a structured Context block that embeds Architecture/UI‑Architecture excerpts.
- Use absolute repo‑root paths when referencing files.
- The base /plan command incorporates this argument via the plan template’s Technical Context ($ARGUMENTS). Keep the context concise and relevant.

Given the implementation details document path provided as an argument (e.g. "specs/002-1-1-something/spec.md"), do this
1) Validate and summarize
   1. Confirm the file exists; STOP with a clear error if not.
   2. Summarize the spec and show the selected architecture excerpts; ask the user to confirm.

2) When confirmed, invoke `.claude/commands/plan.md` with a single argument constructed as follows:

   First line (slug):
   "Plan for: <absolute-spec-path>"

   Then a Context block:
   "
   Primary Sources:
   - Architecture path: docs/architecture.md#<anchor-or-section>
   - Architecture excerpt:
   <<ARCH_EXCERPT_START>>
   [Paste only the most relevant passages: services/boundaries/data‑flows/constraints]
   <<ARCH_EXCERPT_END>>
   - UI Architecture path: docs/ui-architecture.md#<anchor-or-section>
   - UI Architecture excerpt:
   <<UI_EXCERPT_START>>
   [Paste only the most relevant passages: components/routing/state/accessibility/styling]
   <<UI_EXCERPT_END>>

   Constraints:
   - Treat Architecture/UI‑Architecture excerpts as canonical for HOW‑level boundaries, integrations, observability, error handling, and auth.
   - Treat the spec as canonical for WHAT/WHY. If conflicts arise, pause and reconcile before proceeding.

   Open Questions:
   - [Optional list in "[NEEDS CLARIFICATION: …]" format]
   "

Notes
- Keep excerpts minimal and directly relevant; avoid pasting entire sections.
- Prefer section anchors to aid traceability.
- Ensure all file paths are absolute from the repository root.
