# Phase 0 Research: Section Editor & WYSIWYG Capabilities

## Technical Context Clarifications

### Coding Standards & Quality Gates

- **Decision**: Follow the repository's TypeScript-first standards, enforced
  lint rules, Prettier configuration, and constitutional quality gate
  protections documented in `docs/architecture.md` and `CONSTITUTION.md`.
- **Rationale**: These artifacts define mandatory guardrails (library-first, CLI
  exposure, lint/type/test gates) that every feature must inherit; aligning with
  them removes ambiguity around "critical rules" noted in the context.
- **Alternatives Considered**: None. Deviating from constitutional quality gates
  is prohibited without a dedicated governance process.

### Test Strategy and Standards

- **Decision**: Apply Vitest for unit/integration coverage, Playwright for E2E,
  and contract testing via the persistence/API layers as prescribed by the
  architecture docs. Maintain TDD with failing tests preceding implementation.
- **Rationale**: `docs/ui-architecture.md` and the constitution mandate TDD,
  Vitest, React Testing Library patterns, and contract coverage before backend
  changes. Using the existing stack keeps alignment with CI gates and avoids
  redundant tooling.
- **Alternatives Considered**: Jest or Cypress were rejected because migrating
  away from the standardized Vitest/Playwright toolchain would violate the
  established governance and slow delivery.

## Feature Research Topics

### Rich Text Editing Stack Alignment

- **Decision**: Extend the Milkdown v7.15.5 editor already recorded in the
  backend architecture change log, layering custom section-aware scaffolding and
  Markdown parity controls.
- **Rationale**: Milkdown offers React bindings, Markdown fidelity, and plugin
  hooks for formatting controls, matching FR-003/FR-009 requirements without
  replacing existing investments.
- **Alternatives Considered**: TipTap and Slate.js were noted but dismissed
  since they would duplicate existing editor work, complicate Markdown
  compatibility, and stray from documented architecture history.

### Draft Persistence & Autosave Strategy

- **Decision**: Persist editor state through the existing persistence package
  with optimistic autosave snapshots tied to section drafts, triggered on
  debounced input and editor blur.
- **Rationale**: Requirements demand draft preservation (FR-008) and conflict
  detection (FR-006). Leveraging the persistence layer keeps consistency with
  current document tracking and supports reconciliation flows.
- **Alternatives Considered**: Local storage only or manual save operations were
  rejected because they jeopardize cross-session recovery and conflict auditing.

### Conflict Detection & Reconciliation

- **Decision**: Implement versioned section drafts with server-side comparison
  against the latest approved content; surface conflicts via a modal offering
  merge, overwrite, or discard options.
- **Rationale**: FR-004 and FR-006 require diff visibility and safe handling of
  overlapping edits. Version-based comparison aligns with repository patterns in
  `docs/architecture.md` and supports audit logging.
- **Alternatives Considered**: Last-write-wins or lock-based editing were
  rejected because they reduce collaboration flexibility and violate the
  constitution's emphasis on audit trails.

### Accessibility & Input Modality Support

- **Decision**: Enforce WCAG 2.1 AA compliance with full keyboard navigation,
  ARIA annotations on toolbar controls, and screen reader-friendly preview
  panes.
- **Rationale**: FR-007 and the UI spec highlight accessibility as non-
  negotiable. Milkdown's accessible primitives combined with custom focus traps
  satisfy the requirement.
- **Alternatives Considered**: Relying solely on browser defaults was declined
  because complex editor toolbars often become unusable without explicit
  accessibility handling.

### Large Section Performance Management

- **Decision**: Use deferred rendering for non-visible blocks, virtualize the
  section navigator, and chunk diff generation to keep interactions under 200ms
  for sections up to the documented 500-section target.
- **Rationale**: Edge cases call out very large sections. Applying
  virtualization and incremental diffing maintains responsiveness without
  breaking Markdown fidelity.
- **Alternatives Considered**: Full eager rendering or hard section limits were
  rejected as they either degrade performance or block legitimate large
  documents noted in the UX spec.

### Side-by-Side Diff & Preview UX

- **Decision**: Drive the comparison view with unified diff data from the API,
  rendering Markdown previews with syntax highlighting and change indicators in
  a split-pane layout.
- **Rationale**: FR-004 and acceptance scenario #2 require confirming edits
  before save. Performing diffs server-side ensures consistency with approval
  logs and enables reuse in review workflows.
- **Alternatives Considered**: Client-only diffing was rejected due to increased
  risk of drift from canonical server content and lack of persisted audit data.

## Additional Research

### Backend Architecture Alignment Summary

- The backend architecture mandates a modular monolith with Express.js, SQLite,
  and library-first packages. The section editor must expose CLI entry points
  via the `editor` and `persistence` packages and respect repository-pattern
  data access to enable future DynamoDB migration.
- Observability and logging requirements (structured logs, request IDs) apply to
  autosave and approval endpoints, ensuring conflicts and approvals feed audit
  trails defined in the constitution.

### Frontend Architecture Alignment Summary

- The UI architecture commits to React 18 with shadcn/ui, TanStack Query, and
  Milkdown. Section editor components should live within the documented feature
  module boundaries, leverage streaming patterns, and maintain Storybook
  coverage for new UI states.
- State management uses a mix of TanStack Query for server state and Zustand for
  local editor state; the plan must preserve these conventions to avoid
  architecture drift.

### UI/UX Specification Alignment Summary

- The UX spec emphasizes section-based editing, diff previews, and AI-assisted
  collaboration. The implementation must support conversational AI hooks,
  responsive layouts across breakpoints, and transparent AI reasoning cues.
- Usability goals (60-minute draft, two revision cycles) inform performance
  targets and workflow ergonomics, reinforcing the need for intuitive editing
  and quick conflict resolution.

## Phase 3 Readiness Notes

- Contract coverage spans five endpoints (section fetch, draft save, diff,
  review, approval) and underpins the TDD plan outlined in tasks.md.
- Frontend integration focuses on TanStack Query hooks and Milkdown extensions;
  accessibility and performance considerations remain active watch items during
  implementation.
- Backend observability work (request IDs, audit logging) is critical for
  constitutional compliance and should be validated once routes are wired.

## System Context

- Feature scope: Section-level WYSIWYG editing with autosave, diffs, review.
- Runtime: TypeScript 5 on Node.js 20; React 18 frontend; Express API server.
- Core deps: Milkdown 7.15.5, TanStack Query, Zustand, Zod, Vitest, Playwright.
- Data model: DocumentSection, SectionDraft, ReviewSummary; optimistic locking.
- Contracts: GET section, POST drafts, GET diff, POST review, POST approve.
- TDD flow: contracts -> unit hooks -> integration UI -> Playwright E2E.
- Non functional: WCAG 2.1 AA, autosave <1 s, interactions <200 ms, logging.
- Observability: request IDs, structured logs, CLI parity per constitution.
- Quality gates: pnpm lint/typecheck/test/test:contracts stay green pre-PR.

## Codebase Summary

- Monorepo: pnpm workspace with apps/api, apps/web, packages, specs hierarchy.
- API app: apps/api/src/app.ts wires CORS, request-id, service locator, SQLite.
- API routes: sections.ts depends on SectionRepository and pending-change repo.
- Service locator: core/service-locator.ts scopes logger and database per req.
- Web UI: document-editor feature shows React stores, diff view, Milkdown.
- Section editor feature is skeletal with placeholder helpers tucked under lib.
- Persistence lib: exports PersistenceManager, LocalStorageProvider, CLI stub.
- Tests: apps/web/tests house Vitest integration and Playwright e2e harness.
- Shared data: routes expect @ctrl-freaq/shared-data SectionRepository impls.
