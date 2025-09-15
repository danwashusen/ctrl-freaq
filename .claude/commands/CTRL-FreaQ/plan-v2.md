# Plan how to implement the specified feature.

Prepare the single argument payload for `.claude/commands/plan.md` (an LLM
instruction file). Do not execute any commands in this step.

Intent and Contract

- Purpose: Build exactly one plain-text argument string consumed by
  `.claude/commands/plan.md` via $ARGUMENTS.
- Output Contract:
  - Produce exactly ONE plain-text argument string.
  - First line must be: Plan for: <absolute-spec-path>
  - Follow with the Context block structure defined below (Primary Sources,
    Standards Digests, Constraints, Open Questions).
  - Do not include any surrounding commentary before/after the payload.
  - Do not wrap in code fences (no ```), no JSON/YAML, no CLI prefixes.
  - Use markers like <<ARCH_EXCERPT_START>> literally for the orchestrator.
- Prohibited Actions (wrapper step only):
  - Do NOT run shell commands.
  - Do NOT attempt to execute `.claude/commands/plan.md` (it is not a shell
    script).
  - Do NOT prefix with a CLI invocation (e.g., “.claude/commands/plan.md …”).
- Template Reference:
  - Treat `.claude/commands/plan.md` as an LLM instruction template. A separate
    orchestrator will invoke it, and that file may run shell scripts as part of
    its flow. Your responsibility here is only to construct the single argument
    string.

Inputs and Preconditions

- Input: A path to the feature specification (e.g.,
  specs/004-1-3-authentication/spec.md).
- Preconditions:
  1. Verify the spec file exists; STOP with a clear message if not.
  2. Read docs/architecture.md and docs/ui-architecture.md; identify only
     sections relevant to this feature.
  3. Extract minimal, relevant excerpts (services/boundaries/data
     contracts/observability/testing for backend;
     components/routing/state/accessibility for frontend).
  4. Extract Standards Digests (see below) and tailor them to the spec scope.
  5. If conflicts exist between spec and architecture docs:
     - Architecture/UI docs are canonical for HOW (boundaries, integrations,
       logging, errors, security).
     - The spec is canonical for WHAT/WHY.
     - Surface the conflict and ask the user to reconcile; do not emit the
       payload until confirmed.

Standards Digests (Tailored)

- Backend Standards Digest (always include):
  - Coding Standards from docs/architecture.md#coding-standards (AI Assistant
    Coding Guidelines).
  - When applicable: Logging Standards (#logging-standards), Error Handling
    Strategy (#error-handling-strategy), Security (#security), SOC 2
    (#soc2-guidelines).
  - Include only rules relevant to the feature; prefer short bullets with
    bad/good examples.
  - Size cap: ≤ 1500 tokens or 200 lines.

- UI Standards Digest (include if frontend is in scope):
  - From docs/ui-architecture.md:
    - Frontend Developer Standards (#frontend-developer-standards)
    - Linting & Formatting (UI) (#linting-formatting-ui)
    - Accessibility Standards (#accessibility-standards)
    - Performance & Budgets (#performance-standards)
    - Security Controls (UI) (#security-standards-ui)
    - Observability & Telemetry (UI) (#observability-standards-ui)
    - Testing Requirements (#testing-requirements) and Best Practices
      (#testing-best-practices)
    - Browser Logging with Pino (#browser-logging-pino)
  - Tailor to the feature; prefer short bullets with bad/good examples.
  - Size cap: ≤ 1500 tokens or 200 lines.

Frontend Scope Detection

- Treat the feature as “frontend-involved” if the spec or plan mentions any of:
  React, UI, apps/web, component, page, routing, hooks, shadcn, Tailwind, .tsx.
- If frontend-involved → include the UI Standards Digest. Otherwise note “N/A”.

Confirmation Step (before emitting payload)

- Present: a concise spec summary, selected Architecture/UI excerpts, and the
  two Standards Digests (backend always, UI when applicable).
- Ask the user to confirm or refine scope. Only after confirmation, emit the
  final argument payload (see structure below).

Argument Payload Structure

- First line (slug): Plan for: <absolute-spec-path>

- Then the Context block (no additional commentary): Primary Sources:
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
  - Additional excerpts: <<ADDL_STANDARDS_EXCERPT_START>> [Minimal,
    spec‑relevant bullets only] <<ADDL_STANDARDS_EXCERPT_END>>

  UI Standards Digest (Frontend, when in scope):
  - FE Standards path: docs/ui-architecture.md#frontend-developer-standards
  - UI Standards excerpt: <<UI_STANDARDS_EXCERPT_START>> [React hooks rules,
    a11y, state immutability, performance, UI security, observability, testing —
    only items relevant to this spec, with short bad/good examples]
    <<UI_STANDARDS_EXCERPT_END>>

  Constraints:
  - Treat Architecture/UI‑Architecture excerpts and Standards Digest(s) as
    canonical for HOW‑level boundaries, integrations, observability, error
    handling, and auth.
  - Treat the spec as canonical for WHAT/WHY; pause and reconcile conflicts.
  - The “Standards Digest” (Backend) MUST be copied into Phase 0 research.md as
    a top‑level section named “Standards Digest” (implement‑tasks does not read
    docs/).
  - If frontend is in scope, the “UI Standards Digest” MUST be copied into Phase
    0 research.md as a top‑level section named “UI Standards Digest”.
  - Use absolute repo‑root paths only.

  Open Questions:
  - [Optional list in “[NEEDS CLARIFICATION: …]” format]

Selection Rules (Tailoring)

- Authentication/API features: Input Validation, Auth & Authorization, Logging,
  Error Handling, rate‑limiting memory safety, Service Locator, Repository
  Pattern, TDD.
- Data layer/migrations: Repository Pattern, migration strategy, DB
  logging/transactions, Zod schemas, Validation/Conflict mapping.
- Frontend/UI features: React hooks rules, a11y basics, import/TS rules,
  structured client logging, RTL/Vitest patterns, lazy routes.

Correct vs Incorrect (for the wrapper step)

- Correct (argument only; no fences; no CLI prefix): Plan for:
  /abs/path/specs/004-1-3-authentication/spec.md Primary Sources:
  - Architecture path: docs/architecture.md#Services-and-Boundaries
  - Architecture excerpt: <<ARCH_EXCERPT_START>> … <<ARCH_EXCERPT_END>>
  - UI Architecture path: docs/ui-architecture.md#Routing-and-State
  - UI Architecture excerpt: <<UI_EXCERPT_START>> … <<UI_EXCERPT_END>> Standards
    Digest (Backend):
  - Coding Standards path: docs/architecture.md#coding-standards
  - Coding Standards excerpt: <<STANDARDS_EXCERPT_START>> …
    <<STANDARDS_EXCERPT_END>> UI Standards Digest (Frontend, when in scope):
  - FE Standards path: docs/ui-architecture.md#frontend-developer-standards
  - UI Standards excerpt: <<UI_STANDARDS_EXCERPT_START>> …
    <<UI_STANDARDS_EXCERPT_END>> Constraints:
  - … Open Questions:
  - …

- Incorrect:
  ```bash
  .claude/commands/plan.md "Plan for: /abs/path/specs/004-1-3-authentication/spec.md ..."
  ```

  - Any fenced block, CLI prefix, JSON/YAML formatting, or commentary outside
    the argument.

Notes

- Keep excerpts minimal; avoid pasting entire sections.
- Prefer anchors to aid traceability.
- If docs/architecture.md lacks coding standards, fallback to CONSTITUTION.md
  and AGENTS.md; note the fallback in the digest.
- Total digest length should be concise and immediately actionable for
  implementers.
