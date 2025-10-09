# Tasks: Conversational Co-Authoring Integration

**Input**: Design documents from `/specs/011-epic-2-story-6/` **Prerequisites**:
plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Confirm clarifications in spec.md and review plan.md for tech stack + structure.
2. Load research.md, data-model.md, contracts/, quickstart.md for decisions, entities, endpoints, and scenarios.
3. Generate tasks per constitution: tests first, library-first updates, CLI parity, observability, and documentation.
4. Validate each task respects TDD, library boundaries, and CLI requirements before returning.
```

## Phase 3.1: Setup

- [✓] T001 Scaffold co-authoring frontend directories and barrel exports in
  `/apps/web/src/features/document-editor/` (create `components/co-authoring/`,
  `hooks/useCoAuthorSession.ts`, `stores/co-authoring-store.ts`, update feature
  index).
- [✓] T002 Scaffold backend co-authoring module in `/apps/api/src/` (create
  `routes/co-authoring.ts` placeholder, `services/co-authoring/` directory, and
  register empty router with the Express app).

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

- [✓] T003 [P] Author failing Vitest coverage in
  `/packages/editor-core/src/diff/section-proposal.test.ts` asserting diff
  annotations include prompt IDs, rationale, and confidence metadata.
- [✓] T004 [P] Author failing Vitest + CLI snapshot tests in
  `/packages/ai/src/session/proposal-runner.test.ts` and
  `/packages/ai/src/cli.test.ts` to capture proposal runner inputs, streaming
  events, and CLI wiring.
- [✓] T005 [P] Author failing Vitest for changelog metadata in
  `/packages/shared-data/src/repositories/changelog/changelog.repository.test.ts`
  validating AI proposal fields persist without transcript text.
- [✓] T006 [P] Author failing Vitest for context builders in
  `/apps/api/src/services/co-authoring/context-builder.test.ts` ensuring
  full-document payload assembly and scope enforcement.
- [✓] T007 [P] Author failing Vitest for audit middleware in
  `/apps/api/src/middleware/ai-request-audit.test.ts` covering rate limiting,
  redaction, and telemetry emission.
- [✓] T008 [P] Add failing contract test for
  `POST /api/documents/:documentId/sections/:sectionId/co-author/analyze` in
  `/apps/api/tests/contract/co-authoring/analyze.contract.test.ts`.
- [✓] T009 [P] Add failing contract test for
  `POST /api/documents/:documentId/sections/:sectionId/co-author/proposal` in
  `/apps/api/tests/contract/co-authoring/proposal.contract.test.ts`.
- [✓] T010 [P] Add failing contract test for
  `POST /api/documents/:documentId/sections/:sectionId/co-author/apply` in
  `/apps/api/tests/contract/co-authoring/apply.contract.test.ts`.
- [✓] T011 [P] Add failing Vitest for the co-authoring store + hook in
  `/apps/web/src/features/document-editor/stores/co-authoring-store.test.ts`
  covering session state, streaming progress, approval events, and transcript
  purge when the active section or route changes.
- [✓] T012 [P] Add failing React component tests in
  `/apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.test.tsx`
  and `SessionProgress.test.tsx` validating diff mapping, prompt badges, and
  cancel controls.
- [✓] T013 [P] Add failing Playwright fixture flow in
  `/apps/web/tests/e2e/document-editor/co-authoring.e2e.ts` validating
  quickstart scenario (assist, proposal, approval, fallback).

## Phase 3.3: Core Implementation (ONLY after tests are failing)

- [✓] T014 Implement `SectionConversationSession` model + validators in
  `/packages/shared-data/src/co-authoring/section-conversation-session.ts`.
- [✓] T015 Implement `ConversationTurn` model + helpers in
  `/packages/shared-data/src/co-authoring/conversation-turn.ts`.
- [✓] T016 Implement `ProviderContextPayload` schema and sanitizer in
  `/packages/shared-data/src/co-authoring/provider-context-payload.ts`.
- [✓] T017 Implement `AIProposalSnapshot` value object in
  `/packages/shared-data/src/co-authoring/ai-proposal-snapshot.ts` including
  expiry rules.
- [✓] T018 Implement annotated diff utilities in
  `/packages/editor-core/src/diff/section-proposal.ts` producing
  `DiffPreviewAnnotation` segments per tests.
- [✓] T019 Extend changelog repository in
  `/packages/shared-data/src/repositories/changelog/` to persist AI proposal
  metadata and prompt summaries.
- [✓] T020 Implement proposal runner + CLI command in
  `/packages/ai/src/session/proposal-runner.ts` and expose replay flag in
  `/packages/ai/src/cli.ts` using Vercel AI SDK streaming APIs.
- [✓] T021 Implement context builder service in
  `/apps/api/src/services/co-authoring/context-builder.ts` consuming shared-data
  repositories and clarifications.
- [✓] T022 Implement AI proposal service in
  `/apps/api/src/services/co-authoring/ai-proposal.service.ts` orchestrating SSE
  streaming, provider invocation, and error downgrades.
- [✓] T023 Implement diff mapper utility in
  `/apps/api/src/services/co-authoring/diff-mapper.ts` generating audit-ready
  payloads and proposal hashes.
- [✓] T024 Implement AI request audit middleware + rate limiter in
  `/apps/api/src/middleware/ai-request-audit.ts` and register with the Express
  app pipeline.
- [✓] T025 Implement analyze endpoint handler in
  `/apps/api/src/routes/co-authoring.ts` streaming conversational guidance.
- [✓] T026 Implement proposal endpoint handler in
  `/apps/api/src/routes/co-authoring.ts` returning annotated diffs and audit
  metadata.
- [✓] T027 Implement apply endpoint handler in
  `/apps/api/src/routes/co-authoring.ts` queuing draft persistence, changelog
  entry, and QA logging.
- [✓] T028 Implement co-authoring API client with SSE handling in
  `/apps/web/src/features/document-editor/api/co-authoring.client.ts`.
- [✓] T029 Implement Zustand co-authoring store with selectors in
  `/apps/web/src/features/document-editor/stores/co-authoring-store.ts`,
  including teardown logic that clears transcripts on section switch,
  navigation, or logout.
- [✓] T030 Implement `useCoAuthorSession` hook in
  `/apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts`
  coordinating TanStack Query, store, streaming abort signals, and session
  cleanup events.
- [✓] T031 Implement `CoAuthorSidebar` component in
  `/apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx`
  (intent switching, context toggles, explicit approval path).
- [✓] T032 Implement `ProposalPreview` component in
  `/apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.tsx`
  rendering diff summaries, prompt backlinks, and rationale list.
- [✓] T033 Implement `SessionProgress` component in
  `/apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx`
  showing elapsed time, fallback messaging, cancel/retry controls.
- [✓] T034 Integrate co-authoring UI into
  `/apps/web/src/features/document-editor/components/document-editor.tsx` and
  related shells, wiring events, scope banner, and diff approvals.

## Phase 3.4: Integration

- [✓] T035 Wire backend apply flow to draft persistence + QA logging in
  `/apps/api/src/services/co-authoring/ai-proposal.service.ts` and
  `/packages/qa/src/` ensuring audit events emit without transcript text.
- [✓] T036 Extend frontend streaming utilities in `/apps/web/src/lib/streaming/`
  to surface progress metrics, accessibility announcements, and failure
  downgrades for co-authoring.
- [✓] T037 Update Playwright fixtures in `/apps/web/src/lib/fixtures/e2e/` to
  provide document content, knowledge selections, and expected audit outputs for
  co-authoring tests.

## Phase 3.5: Polish

- [✓] T040 Run verification commands (`pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm --filter @ctrl-freaq/web test:e2e:quick`) and record
  outcomes in review notes.

## Dependencies

- T003–T013 must complete (failing tests in place) before starting any
  implementation task from T014 onward.
- T014–T019 provide shared models and repositories; complete before T020–T027
  consume them.
- T020 precedes T021–T023, which precede T025–T027.
- T024 must complete before executing T025–T027 to guarantee middleware
  availability.
- T028–T034 depend on completion of backend endpoints (T025–T027) and shared
  utilities (T018–T023).
- T035–T037 depend on earlier implementation tasks to integrate logging and
  fixtures.
- Polish tasks (T038–T040) require prior phases to finish successfully.

## Parallel Execution Examples

```
# Kick off backend/infra test suite together once scaffold exists
task run T003 T004 T005 T006 T007

# After tests are failing, parallelize contract specs for each endpoint
task run T008 T009 T010

# Frontend test scaffolding can run concurrently
task run T011 T012 T013
```

## Notes

- Respect clarifications: include the entire completed document in provider
  payloads and keep session transcripts ephemeral.
- Maintain library-first boundaries by implementing shared logic inside packages
  before consuming from apps.
- Ensure every task follows TDD—do not begin implementation tasks until
  corresponding tests are failing.

## Assumption Log

- [ASSUMPTION] T003 expects `generateProposalDiff` to emit per-segment
  annotations containing `promptId`, `originTurnId`, `rationale`, `confidence`,
  `citations`, and deterministic `segmentId` strings following the
  `turnId::type::index` pattern so UI and audit layers can correlate diff output
  to prompts.
- [ASSUMPTION] T004 models `runProposalSession` as accepting
  `{ session, prompt, context, provider, onEvent, replay }` and returning
  `{ proposalId, annotations, events }`, while the CLI exposes a
  `coauthor --payload <file> --json [--replay]` command that loads JSON fixture
  input and prints the aggregated session snapshot.
- [ASSUMPTION] T005 defines a `section_changelog_entries` table without any
  transcript column; repository methods persist `proposalId`, `promptSummary`,
  `confidence`, `citations` (stored as JSON), `diffHash`, and approval metadata
  while explicitly dropping transcript strings from inputs.
- [ASSUMPTION] T006 introduces a `buildCoAuthorContext` helper with dependencies
  `{ fetchDocumentSnapshot, fetchActiveSectionDraft, fetchDecisionSummaries, fetchKnowledgeItems, clarifications }`,
  returning provider payloads that always include every completed section and
  throw `{ code: 'SCOPE_VIOLATION' }` when the requested section is absent.
- [ASSUMPTION] T007 frames `createAIRequestAuditMiddleware` around async
  rate-limit checks returning `{ allowed, remaining, retryAfterMs }`, redacts
  `prompt` bodies to `[REDACTED]`, emits telemetry event `coauthor.intent`,
  stores audit details on `res.locals.aiAudit`, and issues
  `{ code: 'RATE_LIMITED' }` JSON with 429 responses.
- [ASSUMPTION] T008–T010 assert new endpoints live under
  `/api/v1/documents/.../co-author/*`, respond with `202 Accepted`, set
  `HX-Stream-Location` headers pointing to
  `/api/v1/co-authoring/sessions/{sessionId}/events`, and echo audit/context
  summaries without leaking transcript text.
- [ASSUMPTION] T011 expands the Zustand store interface with `startSession`,
  `recordTurn`, `appendTranscriptToken`, `updateStreamProgress`,
  `setPendingProposal`, `approveProposal`, `teardownSession`, and `reset`,
  maintaining `session`, `turns`, `transcript`, `progress`, `pendingProposal`,
  and `approvedHistory` state while clearing transcripts on section changes.
- [ASSUMPTION] T012 requires `ProposalPreview` to render an ARIA-labelled diff
  region exposing `data-segment-id` and `data-origin-turn` attributes plus
  prompt/confidence badges, and `SessionProgress` to surface accessible status
  text with cancel/retry buttons governed by elapsed time and error flags.
- [ASSUMPTION] T013 exercises a Playwright fixture served via
  `?fixture=co-authoring` with UI elements tagged by `data-testid` values
  (`co-author-sidebar`, `co-author-session-progress`, `proposal-diff-preview`,
  `co-author-fallback`) and buttons labelled “Open Co-Author”, “Ask Assistant”,
  “Generate Proposal”, and “Approve Proposal”.
- [ASSUMPTION] T017 treats proposal snapshots as expiring 10 minutes after
  creation (`AI_PROPOSAL_DEFAULT_TTL_MS = 600000`) to keep sessions ephemeral
  while giving authors time to approve diffs; adjust in research if product
  requires a shorter or longer window.
- [ASSUMPTION] T020 instructs the Vercel AI provider to return structured JSON
  containing `proposalId`, `updatedDraft`, `confidence`, and `citations`; raw
  streamed text is retained so the diff mapper can build final previews if the
  provider omits diff metadata.
- [ASSUMPTION] T027 derives the queue’s `draftVersion` from the most recent
  section draft when available, defaulting to the seeded contract value to keep
  responses deterministic in tests.
- [ASSUMPTION] T030 computes front-end `diffHash` and `draftPatch` values by
  hashing the normalized diff segment payload and formatting a Git-style preview
  so apply handlers receive consistent inputs even before persistence wiring
  lands.
- [ASSUMPTION] T031+ bootstrap co-authoring context with `knowledge:wcag` and
  `decision:telemetry` selections from fixtures when the author has not curated
  sources, ensuring scope banners and payloads satisfy contract expectations.
- [ASSUMPTION] F002 configures real proposal streaming whenever
  `COAUTHORING_PROVIDER_MODE` is unset or set to `vercel`; tests and local
  fixtures can opt into deterministic mocks by setting the mode to `mock` (or
  running under `NODE_ENV=test`), keeping provider behaviour aligned with spec
  expectations.
- [ASSUMPTION] F008 enforces Git-style prefixes on every diff segment line so
  draft patches stay valid for audit playback and persistence, including blank
  lines.
- [ASSUMPTION] F009 session cleanup expires idle co-authoring sessions after
  five minutes while explicit reject/teardown endpoints drop SSE buffers and
  pending proposals immediately to preserve ephemerality without leaking server
  memory.
- [ASSUMPTION] F011 fallback hashing relies on Web Crypto `crypto.subtle.digest`
  being available in browser and Node test environments; if an environment lacks
  Web Crypto support we must extend research.md before shipping to avoid
  blocking approvals.
- [ASSUMPTION] F012 keeps a client-side progress timer wired through the
  co-author session hook so `elapsedMs` advances each second while streaming,
  unlocking cancel controls even when backend progress events stay at `0` during
  provider stalls.
- [ASSUMPTION] F012 (2025-10-09 follow-up) synthesizes server-side progress
  events every second based on the proposal session start time so SSE payloads
  include increasing `elapsedMs` values even when the provider is idle, ensuring
  cancel controls and ARIA announcements unlock reliably.
- [ASSUMPTION] F013 streams diff segments with stable `segmentId` values,
  reusing annotation identifiers for added/removed content and generating
  `context` IDs per turn to keep front-end previews and diff hashes aligned.

## Phase 4.R: Review Follow-Up

- [✓] F001 Finding F001: Gauntlet failing due to template auto-upgrade timeout
  as described in audit.md.
- [✓] F002 Finding F002: Co-authoring service bound to mock provider in
  production container as described in audit.md.
- [✓] F003 Finding F003: Co-author approval records trust client-supplied diff
  hashes as described in audit.md.
- [✓] F004 Finding F004: Draft version normalization defaults to version 7 for
  first approvals as described in audit.md.
- [✓] F005 Finding F005: Playwright read-only regression keeps gauntlet red as
  described in audit.md.
- [✓] F006 Finding F006: Diff preview segments drop content due to normalizeDiff
  mapping as described in audit.md.
- [✓] F007 Finding F007: Approval fallback omits canonical diff hash from HTTP
  error details as described in audit.md.
- [✓] F008 Finding F008: Multi-line draftPatch lines miss diff prefixes as
  described in audit.md.
- [✓] F009 Finding F009: Server retains co-authoring session payloads after
  teardown as described in audit.md.
- [✓] F010 Finding F010: Rate limiter state never evicts per-user keys as
  described in audit.md.
- [✓] F011 Finding F011: Diff hash fallback uses non-SHA256 stub as described in
  audit.md.
- [✓] F012 Finding F012: Streaming progress never surfaces cancel controls as
  described in audit.md.
- [✓] F012 Finding F012: Streaming progress never surfaces cancel controls
  (2025-10-09 follow-up) as described in audit.md.
- [✓] F013 Finding F013: SSE diff payload omits segment identifiers as described
  in audit.md.
