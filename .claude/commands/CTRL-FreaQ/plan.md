Plan how to implement the specified feature.

Primary Sources (Canonical)

- docs/architecture.md is the authoritative source for system/backend
  architecture: boundaries, services, data flow, integration patterns, coding
  standards, and non‑functional constraints.
- docs/ui-architecture.md is the authoritative source for frontend architecture:
  component model, routing, state/data layer, accessibility, and styling
  conventions.
- Do not proceed unless both documents have been read and the most relevant
  sections for this feature are identified.

Context preparation (required before calling /plan)

1. Verify the implementation details document (spec) exists; STOP with a clear
   message if not found.
2. Output a concise summary of the spec and ask the user to confirm or refine
   scope.
3. From docs/architecture.md, identify only the sections that constrain or
   inform this feature (services, boundaries, data contracts,
   observability/testing requirements). Extract minimal, relevant excerpts. 3.1
   Extract Standards (Backend):
   - Coding Standards (docs/architecture.md#coding-standards), specifically the
     AI Assistant Coding Guidelines. Include only rules relevant to this feature
     and keep excerpts concise with bad/good examples when available.
   - Related HOW-level standards to include when relevant: Logging Standards
     (docs/architecture.md#logging-standards), Error Handling Strategy
     (docs/architecture.md#error-handling-strategy), Security
     (docs/architecture.md#security), SOC 2 Guidelines
     (docs/architecture.md#soc2-guidelines).
4. From docs/ui-architecture.md, identify only the sections that constrain or
   inform the UI for this feature (components, routing, state patterns,
   accessibility). Extract minimal, relevant excerpts. 4.1 Extract UI Standards
   (Frontend, when UI is in scope):
   - Frontend Developer Standards
     (docs/ui-architecture.md#frontend-developer-standards)
   - Linting & Formatting (UI) (docs/ui-architecture.md#linting-formatting-ui)
   - Accessibility Standards (docs/ui-architecture.md#accessibility-standards)
   - Performance & Budgets (docs/ui-architecture.md#performance-standards)
   - Security Controls (UI) (docs/ui-architecture.md#security-standards-ui)
   - Observability & Telemetry (UI)
     (docs/ui-architecture.md#observability-standards-ui)
   - Testing Requirements and Best Practices
     (docs/ui-architecture.md#testing-requirements,
     docs/ui-architecture.md#testing-best-practices)
   - Browser Logging with Pino (docs/ui-architecture.md#browser-logging-pino)
     Select only items relevant to the feature and prefer short bullets with
     concrete bad/good examples.
5. If any conflict exists between the spec and the architecture docs:
   - Treat architecture docs as canonical for HOW‑level boundaries and
     constraints.
   - Treat the spec as canonical for WHAT/WHY.
   - Surface the conflict and ask the user how to reconcile; do not proceed
     until confirmed.

When asked to invoke `.claude/commands/plan.md`, do:

- Construct that single argument to begin with a short, branch‑friendly slug or
  a clear "Plan for: <spec-path>" line, followed by a structured Context block
  that embeds Architecture/UI‑Architecture excerpts.
- The base `.claude/commands/plan.md` file incorporates this argument via the
  plan template’s Technical Context ($ARGUMENTS). Keep the context concise and
  relevant.
- Use absolute repo‑root paths when referencing files.
- Read `.claude/commands/plan.md`

Given the implementation details document path provided as an argument (e.g.
"specs/002-1-1-something/spec.md"), do this

1. Validate and summarize
   1. Confirm the file exists; STOP with a clear error if not.
   2. Summarize the spec and show the selected architecture excerpts; ask the
      user to confirm.

2. When confirmed, invoke `.claude/commands/plan.md` with a single argument
   constructed as follows:

   First line (slug): "Plan for: <absolute-spec-path>"

Then a Context block: " Primary Sources:

- Architecture path: docs/architecture.md#<anchor-or-section>
- Architecture excerpt: <<ARCH_EXCERPT_START>> [Paste only the most relevant
  passages: services/boundaries/data‑flows/constraints] <<ARCH_EXCERPT_END>>
- UI Architecture path: docs/ui-architecture.md#<anchor-or-section>
- UI Architecture excerpt: <<UI_EXCERPT_START>> [Paste only the most relevant
  passages: components/routing/state/accessibility/styling] <<UI_EXCERPT_END>>

Standards Digest (Backend):

- Coding Standards path: docs/architecture.md#coding-standards
- Coding Standards excerpt: <<STANDARDS_EXCERPT_START>> [Top rules with bad/good
  examples relevant to this spec] <<STANDARDS_EXCERPT_END>>
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
  items relevant to this spec, with brief bad/good examples]
  <<UI_STANDARDS_EXCERPT_END>>

Constraints:

- Treat Architecture/UI‑Architecture excerpts as canonical for HOW‑level
  boundaries, integrations, observability, error handling, and auth.
- Treat the spec as canonical for WHAT/WHY. If conflicts arise, pause and
  reconcile before proceeding.
- The Standards Digest (Backend) is normative for HOW‑level implementation
  choices and MUST be copied into Phase 0 research.md as a top‑level section
  named "Standards Digest" (implement‑tasks does not read docs/).
- If the feature includes frontend scope, the UI Standards Digest MUST be
  included as a top‑level section named "UI Standards Digest" in Phase 0
  research.md.

Open Questions:

- [Optional list in "[NEEDS CLARIFICATION: …]" format] "

Notes

- Keep excerpts minimal and directly relevant; avoid pasting entire sections.
- Prefer section anchors to aid traceability.
- Ensure all file paths are absolute from the repository root.
- Always include a Standards Digest (Backend). Include a UI Standards Digest
  when the spec has frontend scope (any mention of React/UI/apps/web/components
  routing/hooks/shadcn/Tailwind). If not applicable, note N/A.
- Each digest should be ≤ 1500 tokens or 200 lines. Prefer bullets and short
  bad/good examples.
- If docs/architecture.md lacks coding standards, fall back to CONSTITUTION.md
  and AGENTS.md; note the fallback in the digest.

Selection Rules (for digest tailoring)

- Authentication/API features: Input Validation, Auth & Authorization, Logging
  Standards, Error Handling, rate‑limiting memory safety, Service Locator,
  Repository Pattern, TDD.
- Data layer/migrations: Repository Pattern, migration strategy, DB logging /
  transactions, error mapping to Validation/Conflict, Zod types.
- Frontend/UI features: React hooks rules, a11y basics, import/TS rules,
  structured client logging, RTL/Vitest patterns, code splitting performance.
