# Phase 0 Research — Conversational Co-Authoring Integration

## Provider Context Assembly

- **Decision**: Build provider payloads on the backend using
  `packages/shared-data` repositories to load the approved document, then merge
  the active section draft and user-selected knowledge items before sending to
  the AI provider.
- **Rationale**: Backend already has authenticated access to canonical content,
  can enforce scope checks, and keeps model payload construction testable
  outside the UI.
- **Alternatives Considered**:
  - _Frontend concatenation_: risks outdated data and leaks unpublished drafts
    if client cache is stale.
  - _Provider-side retrieval_: externalizes document access and complicates
    audit guarantees.

## Streaming Transport Strategy

- **Decision**: Use the Vercel AI SDK streaming helpers on the backend to emit
  Server-Sent Events (SSE) that the frontend consumes through the existing fetch
  streaming utilities.
- **Rationale**: SSE aligns with current streaming patterns in the codebase,
  keeps backpressure handling inside the API, and integrates directly with the
  AI SDK abstractions.
- **Alternatives Considered**:
  - _WebSockets_: heavier handshake and additional infrastructure for a single
    duplex stream.
  - _Polling_: violates responsiveness goals and complicates progress updates.

## Diff Preview Generation & Annotation

- **Decision**: Extend `packages/editor-core` diff functions to accept prompt
  IDs and confidence metadata so diff segments can reference the originating
  chat turn.
- **Rationale**: Centralizes diff math in the shared library, keeps history
  consistent across web and CLI, and allows future reuse for CLI workflows.
- **Alternatives Considered**:
  - _Reimplement diffing in the frontend_: duplicates logic and risks divergent
    output formatting.
  - _Third-party diff service_: adds latency and external dependency.

## Changelog & Audit Logging

- **Decision**: Augment the changelog repository to accept AI proposal metadata
  (prompt ID, confidence, citation summary) while logging the action through
  `packages/qa` without storing transcript text.
- **Rationale**: Satisfies audit requirements, respects the clarification that
  conversations are ephemeral, and keeps history tied to existing changelog
  mechanisms.
- **Alternatives Considered**:
  - _Persist entire transcript_: contradicts clarifications and retention
    expectations.
  - _Skip changelog enrichment_: fails to meet traceability requirements.

## Accessibility & Progress Feedback

- **Decision**: Broadcast streaming updates through ARIA live regions, display a
  progress indicator once generation exceeds five seconds, and surface cancel /
  retry controls bound to the streaming request ID.
- **Rationale**: Aligns with WCAG guidance, matches clarified performance
  policy, and keeps authors in control when responses take longer than expected.
- **Alternatives Considered**:
  - _Spinner-only feedback_: provides no duration context and frustrates users.
  - _Auto-timeout_: risks aborting legitimately long proposals without user
    consent.

## Security & Rate Limiting

- **Decision**: Reuse existing Clerk-authenticated middleware, add intent-level
  rate limiting (e.g., five proposal requests per minute per section), and
  redact sensitive fields from request logs.
- **Rationale**: Prevents prompt abuse, preserves SOC 2 logging constraints, and
  keeps audit records focused on metadata.
- **Alternatives Considered**:
  - _No throttling_: invites accidental or malicious prompt storms.
  - _Global rate limits only_: punishes concurrent authors beyond the section
    scope.

## System Context

- CTRL FreaQ is a pnpm/Turborepo monorepo combining React 19 (`apps/web`) with
  an Express 5 API (`apps/api`) and shared TypeScript packages (`packages/*`).
- Conversational co-authoring lives inside the document editor feature
  (`/apps/web/src/features/document-editor/`), tapping Zustand stores, TanStack
  Query, and existing diff viewers for proposal previews.
- Backend responsibilities concentrate in `/apps/api/src/routes/co-authoring.ts`
  and `/apps/api/src/services/co-authoring/`, which orchestrate provider calls
  via the `@ctrl-freaq/ai` library, enforce Clerk-authenticated access, and
  write enriched changelog entries through `@ctrl-freaq/shared-data`.
- AI integration must send the entire completed document context on every
  provider call (per clarifications) while keeping conversation transcripts
  ephemeral; only proposal metadata and changelog entries persist.
- Streaming responses should use the Vercel AI SDK SSE helpers already stubbed
  in `packages/ai`, with client consumption through
  `/apps/web/src/lib/streaming/` utilities and progress indicators surfaced when
  latency exceeds ~5s.
- Draft persistence and changelog application reuse existing infrastructure in
  `packages/editor-persistence`, `packages/editor-core`, and
  `packages/shared-data`; approvals queue diffs through the same pathways as
  manual edits.
- Compliance, audit logging, and fallback messaging must align with
  `packages/qa` helpers and CHANGELOG conventions (Story 5 precedent) so
  reviewers can trace AI contributions without storing transcripts.
- Testing expectations mirror the constitution: Vitest for unit/contract,
  Playwright fixture suites for end-to-end flows, and the gauntlet (`pnpm lint`,
  `pnpm typecheck`, `pnpm test`) prior to merge.

## Codebase Summary

- **/apps/web/src/features/document-editor/**: hosts UI shells, diff preview
  components, and will gain a co-authoring sidebar (`components/co-authoring/`),
  hook (`hooks/useCoAuthorSession.ts`), API client
  (`api/co-authoring.client.ts`), and Zustand store
  (`stores/co-authoring-store.ts`). Unit tests live beside components;
  integration and E2E flows sit under `/apps/web/tests/`.
- **/apps/api/src/**: route modules (`routes/`), service layer (`services/`),
  middleware, and contract tests (`tests/contract/`). New co-authoring endpoints
  mount here, backed by provider runners in `services/co-authoring/` and request
  auditing middleware.
- **/packages/ai/**: Vercel AI SDK abstraction that needs concrete
  session/proposal runners plus CLI support (`src/cli.ts`) for replaying prompts
  and verifying outputs.
- **/packages/editor-core/**: Shared diff and patch helpers extended to annotate
  diff segments with prompt IDs, confidence, and rationales consumed by both web
  UI and CLI.
- **/packages/shared-data/**: Repositories for documents, sections, and
  changelog entries; enhancements capture AI proposal metadata without storing
  transcript text.
- **/packages/qa/** & **/packages/editor-persistence/**: Supply compliance
  logging utilities and draft persistence queues that approvals must reuse;
  regression coverage already exists for Story 5 persistence flows.
- **Testing Tooling**: Vitest config shared repo-wide, Playwright fixture server
  reachable via `pnpm --filter @ctrl-freaq/web test:e2e:quick`, and CLI parity
  ensured through the `@ctrl-freaq/ai` commands.
