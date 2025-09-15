Break down the plan into executable tasks.

Primary Sources (Canonical)

- Plan of record: the feature’s plan.md (immediate scope, sequencing, and task
  boundaries).
- Architecture (HOW): docs/architecture.md — services, boundaries, data flow,
  observability, error handling, auth, integration patterns, coding standards.
- UI Architecture (HOW): docs/ui-architecture.md — components, routing,
  state/data layer, accessibility, styling conventions.
- WHAT/WHY reference: the feature spec.md — scope, acceptance criteria, user
  value.
- Supporting artifacts (when present): data-model.md, contracts/, quickstart.md,
  research.md.
- Constitutional constraints: CONSTITUTION.md (or declared canonical if
  different).

Context preparation (required before calling /tasks)

1. Verify prerequisites:
   - Ensure the target feature directory exists and contains plan.md. STOP with
     a clear message if missing.
   - Run `.specify/scripts/check-task-prerequisites.sh --json` from repo root;
     parse FEATURE_DIR and AVAILABLE_DOCS. STOP on error.
2. Read the plan minimally:
   - Capture plan title, scope summary, execution status, and the sections that
     directly drive tasking (Phase 1 artifacts, TDD intent, quality gates).
3. Extract minimal, relevant Architecture/UI-Architecture constraints:
   - Architecture: services/boundaries/data contracts/observability/testing
     relevant to task grouping and outputs.
   - UI Architecture: components/routing/state/accessibility that influence
     decomposition and ordering.
   - Standards Constraints: read the "Standards Digest" (Backend) and, when
     frontend is in scope, the "UI Standards Digest" from plan.md or research.md
     to turn key rules into task acceptance criteria (e.g., Service Locator
     usage, Zod validation, structured logging, React hooks rules, accessibility
     checks).
4. Snapshot available artifacts (if present):
   - Entities from data-model.md
   - Contract files/endpoints from contracts/
   - Test scenarios from quickstart.md
   - Key decisions from research.md that affect tasks
5. Conflict handling:
   - Treat plan.md as the plan-of-record for what to build next and immediate
     task boundaries.
   - Treat Architecture/UI docs as canonical for HOW-level boundaries and
     conventions.
   - Treat spec.md as canonical for WHAT/WHY.
   - If conflicts arise, prefer Architecture/UI for HOW boundaries and spec.md
     for WHAT/WHY. Surface conflicts and ask the user to reconcile before
     proceeding.

When asked to invoke `.claude/commands/tasks.md`, do:

- Construct that argument to begin with a concise slug line, followed by a
  structured Context block that embeds curated excerpts and file paths.
- The base `.claude/commands/tasks.md` file incorporates this argument via the
  tasks template’s Technical Context ($ARGUMENTS). Keep the context concise and
  relevant.
- Use absolute repo‑root paths when referencing files.
- Read `.claude/commands/tasks.md`
- Invocation rules
- The `.claude/commands/tasks.md` command is immutable and only accepts a single
  argument string.
- Construct that argument to begin with a concise slug line, followed by a
  structured Context block that embeds curated excerpts and file paths.
- Use absolute repo-root paths for all file references.
- Keep excerpts minimal and include anchors when available to aid traceability.
- The base /tasks command consumes this via its template’s Technical Context
  ($ARGUMENTS).

Given the target feature directory or plan path provided as input, do this

1. Validate and summarize
   1. Confirm FEATURE_DIR and plan.md exist; STOP with a clear error if not
      found.
   2. Summarize the plan scope and show selected Architecture/UI excerpts and
      discovered artifacts; ask the user to confirm or refine.

2. When confirmed, invoke `.claude/commands/tasks.md` with a single argument
   constructed as follows:

   First line (slug): "Tasks for: <absolute-plan-path or absolute-feature-dir>"

Then a Context block: " Primary Sources:

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
    - Backend standards: <<STANDARDS_EXCERPT_START>> [Turn rules into acceptance
      criteria: Service Locator only; Zod validation at API boundaries;
      structured Pino logging with requestId; no raw SQL in routes; TDD tests
      first; no console in app code] <<STANDARDS_EXCERPT_END>>
    - UI standards (if frontend-involved): <<UI_STANDARDS_EXCERPT_START>>
      [Acceptance criteria: React hooks rules; a11y alt-text and role-based
      queries; immutable state updates; code-splitting for routes; browser Pino
      logging w/ redaction; RTL best practices] <<UI_STANDARDS_EXCERPT_END>>

Artifacts snapshot:

- Entities (from data-model): <<DM_SUMMARY_START>>[List key
  entities/domains]<<DM_SUMMARY_END>>
- Contracts (from contracts/): <<CONTRACTS_LIST_START>>[List files /
  endpoints]<<CONTRACTS_LIST_END>>
- Test scenarios (from quickstart): <<QUICKSTART_EXCERPT_START>>[List
  scenarios]<<QUICKSTART_EXCERPT_END>>

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

- [Optional list in "[NEEDS CLARIFICATION: …]" format] "

Task generation emphasis (for the base /tasks command)

- Respect TDD ordering: write tests before implementation; plan
  contract/integration tests to fail first.
- Parallelization rules: different files → [P] allowed; shared files →
  sequential (no [P]).
- Map artifacts to task types:
  - Each contract file → contract test task [P]
  - Each entity in data-model → model creation task [P]
  - Each endpoint → implementation task (sequential if shared files)
  - Each user story (from spec) → integration test task [P]
- Output should include:
  - Numbered tasks (T001, T002, …)
  - File-path specificity and dependency notes
  - Parallel execution examples and Task agent command hints

Example argument payload (single argument string) Tasks for:
/absolute/path/specs/002-1-1-auth-layout/plan.md

Primary Sources:

- Plan path: /absolute/path/specs/002-1-1-auth-layout/plan.md#Tasks-Scope
- Architecture path: docs/architecture.md#Services-and-Boundaries
- UI Architecture path: docs/ui-architecture.md#Routing-and-State
- Spec path: /absolute/path/specs/002-1-1-auth-layout/spec.md#Acceptance
- Available artifacts:
  - Data model: /absolute/path/specs/002-1-1-auth-layout/data-model.md
  - Contracts dir: /absolute/path/specs/002-1-1-auth-layout/contracts
  - Quickstart: /absolute/path/specs/002-1-1-auth-layout/quickstart.md

Plan excerpt: <<PLAN_EXCERPT_START>>

- Scope: Authenticated app shell + dashboard + projects list
- TDD: contract tests for /projects, /dashboard overview, then components
  <<PLAN_EXCERPT_END>>

Architecture excerpt: <<ARCH_EXCERPT_START>>

- Services: Projects service (read-only); Auth via Clerk; Structured logging
  required <<ARCH_EXCERPT_END>>

UI Architecture excerpt: <<UI_EXCERPT_START>>

- Routes: /dashboard, /projects
- State: client-side store, react-query fetch; a11y: keyboard navigation, ARIA
  landmarks <<UI_EXCERPT_END>>

Artifacts snapshot:

- Entities: <<DM_SUMMARY_START>>Project, User<<DM_SUMMARY_END>>
- Contracts:
  <<CONTRACTS_LIST_START>>/contracts/projects.yaml<<CONTRACTS_LIST_END>>
- Test scenarios: <<QUICKSTART_EXCERPT_START>>Dashboard loads; Projects list
  paginates<<QUICKSTART_EXCERPT_END>>

Constraints:

- Plan is source of task scope; Architecture/UI define HOW boundaries
- Absolute paths only; [P] for independent files

Open Questions:

- [NEEDS CLARIFICATION: pagination size and empty states?]

Notes

- Keep excerpts minimal and directly relevant; avoid pasting entire sections.
- Prefer section anchors to aid traceability.
- Ensure all file paths are absolute from the repository root.
- If Constitution has multiple versions, use the declared canonical and note the
  choice.
