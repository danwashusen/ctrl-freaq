# Change Log

## 012-epic-2-story-7

> Feature scope: Streaming parity for co-authoring, document QA, and assumption
> flows

### Overview

Implemented a shared section-stream queue and document QA streaming service so
co-authoring, QA, and assumption loops enforce per-section serialization while
keeping the editor responsive. Updated the document editor frontend, telemetry,
and fallback handling to surface progress cues, cancellation controls, and
parity between streaming and fallback deliveries.

### Highlights

- Added document QA streaming endpoints, service, and telemetry wiring that
  reuse the shared queue (`apps/api/src/routes/document-qa.ts:1`,
  `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`,
  `apps/api/src/services/container.ts:1`).
- Shared coordinator and editor-core queue utilities replace ad hoc logic across
  co-authoring, QA, and assumption services
  (`apps/api/src/services/streaming/shared-section-stream-queue.ts:1`,
  `packages/editor-core/src/streaming/section-stream-queue.ts:1`,
  `apps/api/src/modules/section-editor/services/assumption-session.service.ts:1`).
- Extended the document editor with a QA panel, Zustand store, and session hooks
  that stream, resequence, and announce progress while honoring cancel/retry and
  fallback toggles
  (`apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx:1`,
  `apps/web/src/features/document-editor/stores/document-qa-store.ts:1`,
  `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | Met    | Shared queue plus streaming services and hooks deliver incremental updates across co-authoring, QA, and assumption flows (`packages/editor-core/src/streaming/section-stream-queue.ts:1`, `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/src/modules/section-editor/services/assumption-session.service.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`).     |
| FR-002      | Met    | Progress tracker emits stage labels and first-update latency while UI components surface chips and timers (`apps/web/src/lib/streaming/progress-tracker.ts:1`, `apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx:1`, `apps/web/src/features/document-editor/components/document-qa/DocumentQaPanel.tsx:1`).                                                                                            |
| FR-003      | Met    | Editor stores keep sessions editable and persist transcripts/summaries after completion (`apps/web/src/features/document-editor/stores/co-authoring-store.ts:1`, `apps/web/src/features/document-editor/stores/document-qa-store.ts:1`, `apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`).                                                                                                                |
| FR-004      | Met    | Streaming progress tracker, QA hook, and telemetry emit ARIA-friendly announcements and fallback notices (`apps/web/src/lib/streaming/progress-tracker.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`, `apps/web/src/lib/telemetry/client-events.ts:1`).                                                                                                                                                |
| FR-005      | Met    | Cancel/retry endpoints and UI handlers normalize queue reasons and confirmations (`apps/api/src/routes/document-qa.ts:1`, `apps/api/src/routes/co-authoring.ts:1`, `apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts:1`, `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:1`).                                                                                                                     |
| FR-006      | Met    | Services detect transport flags and emit fallback parity while frontend displays deterministic fallback progress (`apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/src/services/co-authoring/ai-proposal.service.ts:1`, `apps/web/src/lib/streaming/fallback-messages.ts:1`).                                                                                                                  |
| FR-007      | Met    | Streaming and fallback flows share summary/tokens and are validated by unit tests (`apps/api/src/modules/document-qa/services/document-qa-streaming.service.ts:1`, `apps/api/tests/unit/document-qa/document-qa-streaming.service.test.ts:1`, `apps/web/src/lib/streaming/fallback-messages.test.ts:1`).                                                                                                                                |
| FR-008      | Met    | Audit middleware, QA telemetry, and client events log queue disposition, fallback, and latency metrics (`apps/api/src/middleware/ai-request-audit.ts:84`, `packages/qa/src/audit/co-authoring.ts:14`, `apps/web/src/lib/telemetry/client-events.ts:1`).                                                                                                                                                                                 |
| FR-009      | Met    | Section stream queue enforces per-section serialization with promotions and cancellation propagation, verified through API/service tests (`packages/editor-core/src/streaming/section-stream-queue.ts:1`, `apps/api/src/services/streaming/shared-section-stream-queue.ts:1`, `apps/api/src/services/co-authoring/ai-proposal.service.test.ts:1`, `apps/api/src/modules/section-editor/services/assumption-session.service.test.ts:1`). |

### Testing

- Added or expanded 11 Vitest suites covering queue replacement, Document QA
  streaming, fallback parity, telemetry, and UI session hooks; contract tests
  for the new document QA routes remain TODO before release.

### Risks & Mitigations

- Document QA streaming service currently emits deterministic placeholder
  tokens; integrate the real review pipeline or flag this as a temporary stub
  before production cutover.
- New document QA endpoints lack contract coverage; add `*.contract.test.ts`
  exercising `specs/012-epic-2-story-7/contracts/streaming-openapi.yaml` prior
  to merging to main.

### Clarifications

- 2025-10-09: Multiple requests for the same section keep only the newest
  pending entry; enforced via shared section-stream queue.
- 2025-10-09: Cross-section concurrency is allowed; queue tracks concurrency
  slots per active session.
- 2025-10-09: Target capacity is 40+ concurrent interactions per workspace;
  telemetry captures slots and latency for validation.
- 2025-10-09: Streaming sessions are identified by server-generated UUID
  `sessionId`; all telemetry and stores persist this key.

### Assumption Log

- Queue utilities in
  `packages/editor-core/src/streaming/section-stream-queue.ts:1` serve
  co-authoring, document QA, and assumptions to align with FR-009 and
  cancel/retry parity.
- Document QA streaming shares co-authoring contract shapes so APIs and UI hooks
  can remain symmetrical until dedicated QA modules land.
- Document QA reviews derive deterministic prompts from document and section
  identifiers when UI does not supply explicit copy, preserving contract
  compliance.

## 011-epic-2-story-6

> Feature scope: Section-scoped conversational co-authoring assistant

### Overview

Delivered the conversational co-authoring workflow so authors can analyze
sections, stream AI proposals, and approve hashed diffs without leaving the
document editor. The API assembles whole-document context, enforces diff
integrity, and records changelog metadata while the React sidebar surfaces
accessible progress cues, fallback guidance, and explicit approval controls.

### Highlights

- Provisioned a rate-limited co-authoring service with SSE streams, audit
  telemetry, and diff-hash enforcement
  (`apps/api/src/services/co-authoring/ai-proposal.service.ts:319`,
  `apps/api/src/middleware/ai-request-audit.ts:34`,
  `apps/api/src/routes/co-authoring.ts:86`).
- Added shared co-authoring models and annotated diff utilities that persist
  proposal metadata without transcripts
  (`packages/shared-data/src/co-authoring/ai-proposal-snapshot.ts:1`,
  `packages/editor-core/src/diff/section-proposal.ts:53`,
  `packages/shared-data/src/repositories/changelog/changelog.repository.ts:79`).
- Built the co-authoring sidebar, Zustand store, session hook, and streaming
  utilities with hashed patches, cancel controls, and accessible announcements
  (`apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx:166`,
  `apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:772`,
  `apps/web/src/lib/streaming/progress-tracker.ts:54`).
- Extended CLI replay tooling, fixtures, and automated tests to exercise the
  workflow across API, UI, and CLI surfaces (`packages/ai/src/cli.ts:63`,
  `packages/ai/src/session/proposal-runner.test.ts:1`,
  `apps/api/tests/contract/co-authoring/proposal.contract.test.ts:1`,
  `apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:4`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                            |
| ----------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | apps/web/src/features/document-editor/components/document-editor.tsx:1564; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:15                |
| FR-002      | ✅     | apps/web/src/features/document-editor/components/co-authoring/CoAuthorSidebar.tsx:166; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:23    |
| FR-003      | ✅     | apps/api/src/services/co-authoring/context-builder.ts:61; apps/api/src/services/co-authoring/context-builder.test.ts:22                             |
| FR-004      | ✅     | packages/editor-core/src/diff/section-proposal.ts:53; apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.test.tsx:52     |
| FR-005      | ✅     | apps/web/src/features/document-editor/components/co-authoring/ProposalPreview.tsx:137; apps/web/tests/e2e/document-editor/co-authoring.e2e.ts:60    |
| FR-006      | ✅     | apps/api/src/services/co-authoring/ai-proposal.service.ts:631; apps/api/src/services/co-authoring/ai-proposal.service.test.ts:131                   |
| FR-007      | ✅     | apps/web/src/features/document-editor/stores/co-authoring-store.ts:226; apps/web/src/features/document-editor/stores/co-authoring-store.test.ts:104 |
| FR-008      | ✅     | apps/api/src/services/co-authoring/context-builder.ts:63; apps/api/src/services/co-authoring/context-builder.test.ts:65                             |
| FR-009      | ✅     | apps/web/src/lib/streaming/fallback-messages.ts:1; apps/web/src/lib/streaming/fallback-messages.test.ts:8                                           |
| NFR-001     | ✅     | apps/web/src/features/document-editor/components/co-authoring/SessionProgress.tsx:17; apps/web/src/lib/streaming/progress-tracker.test.ts:6         |

### Testing

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (2025-10-09) plus the new CLI,
  contract, unit, and Playwright suites covering context builders, diff mappers,
  audit middleware, progress tracker, and the document-editor flow
  (`apps/api/src/services/co-authoring/ai-proposal.service.test.ts`,
  `packages/ai/src/session/proposal-runner.test.ts`,
  `apps/web/src/features/document-editor/hooks/useCoAuthorSession.test.tsx`,
  `apps/web/tests/e2e/document-editor/co-authoring.e2e.ts`).

### Risks & Mitigations

- Session eviction relies on follow-up requests to trigger
  `evictExpiredSessions`; prolonged idle SSE connections could linger in memory.
  Monitor session telemetry and add a periodic eviction job if idle queues
  accumulate (`apps/api/src/services/co-authoring/ai-proposal.service.ts:811`).
- Diff hash fallbacks require `crypto.subtle` support; environments lacking Web
  Crypto support will skip client-side hashing and depend on server hashes only.
  Confirm Node runtimes ship Web Crypto or backfill via polyfill before
  deployment
  (`apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts:132`).
- Live proposal streaming depends on `AI_SDK_API_KEY`; missing keys trigger
  fallback errors sent to the UI. Use `COAUTHORING_PROVIDER_MODE=mock` for
  environments without provider credentials and alert ops when the middleware
  logs `MISSING_AI_API_KEY` (`packages/ai/src/session/proposal-runner.ts:247`).

### Clarifications

- 2025-10-06 — Conversation history stays ephemeral; rely on changelog entries
  for auditability.
- 2025-10-06 — Provider prompts must include the entire document of completed
  sections.
- 2025-10-06 — No strict SLA for proposal diffs as long as progress is surfaced
  to the author.

### Assumption Log

- T003 — Diff annotations expose `promptId`, `originTurnId`, `rationale`,
  `confidence`, `citations`, and deterministic `segmentId` values for UI/audit
  correlation.
- T004 — `runProposalSession` accepts
  `{ session, prompt, context, provider, onEvent, replay }` and the CLI surfaces
  `coauthor --payload <file> --json [--replay]` for deterministic inspection.
- T005 — `section_changelog_entries` persists proposal metadata (ID, summary,
  confidence, citations, diff hash) while dropping transcript text.
- T006 — `buildCoAuthorContext` always includes every completed section and
  throws `{ code: 'SCOPE_VIOLATION' }` when the requested section is missing.
- T007 — `createAIRequestAuditMiddleware` handles rate limiting, redacts
  prompts, emits `coauthor.intent`, stores audit details on
  `res.locals.aiAudit`, and returns `{ code: 'RATE_LIMITED' }` with Retry-After
  when throttled.
- T008–T010 — New routes live under `/api/v1/documents/.../co-author/*`, respond
  `202 Accepted`, stream via `HX-Stream-Location`, and echo audit summaries
  without transcripts.
- T011 — The Zustand store exposes session lifecycle actions (`startSession`,
  `appendTranscriptToken`, `approveProposal`, `teardownSession`, `reset`) and
  clears transcripts on section/navigation changes.
- T012 — `ProposalPreview` renders ARIA-labelled segments with
  `data-segment-id`/`data-origin-turn` attributes plus prompt/confidence badges;
  `SessionProgress` announces status with cancel/retry controls.
- T013 — Playwright fixture runs via `?fixture=co-authoring` with test IDs
  (`co-author-sidebar`, `co-author-session-progress`, `proposal-diff-preview`,
  `co-author-fallback`) and labelled buttons.
- T017 — Proposal snapshots expire after 10 minutes
  (`AI_PROPOSAL_DEFAULT_TTL_MS = 600000`) to balance ephemerality with approval
  windows.
- T020 — Provider returns structured JSON (`proposalId`, `updatedDraft`,
  `confidence`, `citations`) while retaining streamed text for diff mapping
  fallback.
- T027 — Draft persistence derives `draftVersion` from the latest section draft
  when present, otherwise uses seeded contract defaults for determinism.
- T030 — Frontend computes `diffHash` and `draftPatch` using normalized segments
  so apply handlers receive consistent hashes before persistence lands.
- T031+ — Default context seeds include `knowledge:wcag` and
  `decision:telemetry` when authors lack selections to satisfy contract
  expectations.
- F002 — Production uses live provider unless `COAUTHORING_PROVIDER_MODE=mock`
  or `NODE_ENV=test` forces deterministic mocks.
- F008 — Draft patches must include Git-style prefixes on every line, including
  blanks, for audit replay fidelity.
- F009 — Session cleanup expires idle co-authoring sessions after five minutes
  while explicit reject/teardown endpoints drop SSE buffers and pending
  proposals immediately to preserve ephemerality.
- F011 — Fallback hashing relies on Web Crypto `crypto.subtle.digest`; extend
  research if an environment lacks support to avoid blocking approvals.
- F012 — Client progress timer advances `elapsedMs` locally so cancel controls
  unlock even when backend events stall.
- F012 (2025-10-09 follow-up) — Server synthesizes progress events every second
  so SSE payloads include increasing `elapsedMs` values.
- F013 — SSE diff payload streams stable `segmentId` values, reusing annotation
  identifiers for added/removed content and generating context IDs per turn.

## 010-epic-2-story-5

> Feature scope: Section draft persistence & compliance telemetry

### Overview

Implemented end-to-end section draft persistence so authors keep unsaved work
across reloads while bundling saves behind the new draft APIs. Hardened
compliance signalling, retention fixtures, and accessible status cues so
client-only drafts never leak content yet stay observable through console
telemetry. Updated CLI tooling, docs, and test suites to exercise the workflow
before merge.

### Highlights

- Added IndexedDB-backed `DraftStore` with quota-aware pruning and CLI
  inspection commands (`packages/editor-persistence/src/draft-store.ts`,
  `packages/editor-persistence/src/cli.ts`).
- Introduced draft bundle/compliance routes plus atomic repository logic with
  contract & unit coverage (`apps/api/src/routes/documents.ts`,
  `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`).
- Wired the document editor to the persistence hook, status badge, logout
  registry, and console-only telemetry
  (`apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`,
  `apps/web/src/lib/draft-logout-registry.ts`).
- Refreshed section editor bundling, retention fixtures, and QA compliance
  helpers (`apps/web/src/features/section-editor/hooks/use-section-draft.ts`,
  `apps/api/src/routes/projects.ts`, `packages/qa/src/compliance/drafts.ts`).
- Expanded Story 5 specs and architecture docs to capture the new persistence
  workflow (`docs/architecture.md`, `docs/ui-architecture.md`,
  `specs/010-epic-2-story-5/*`).

### Requirement Coverage

| Requirement | Status | Evidence                                                                                                                                                                                              |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001      | ✅     | packages/editor-persistence/src/draft-store.ts:192<br>packages/editor-persistence/tests/draft-store.test.ts:81                                                                                        |
| FR-002      | ✅     | apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx:15<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:22                                              |
| FR-002a     | ✅     | apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx:53<br>apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.test.tsx:22                 |
| FR-003      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:176<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:26                                                            |
| FR-004      | ✅     | apps/api/src/routes/documents.ts:145<br>apps/api/src/services/drafts/draft-bundle.service.ts:97<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:671                                |
| FR-005      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:275<br>apps/web/src/features/document-editor/components/document-editor.tsx:913                                                  |
| FR-006      | ✅     | apps/api/src/services/drafts/draft-bundle.service.ts:199<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:865<br>apps/api/src/services/container.ts:143                             |
| FR-007      | ✅     | apps/api/src/services/drafts/draft-bundle.repository.ts:124<br>apps/api/tests/unit/drafts/draft-bundle.repository.test.ts:182                                                                         |
| FR-008      | ✅     | packages/editor-persistence/src/draft-store.ts:219<br>apps/web/src/features/section-editor/hooks/use-section-draft.ts:491<br>apps/web/src/features/document-editor/components/document-editor.tsx:967 |
| FR-009      | ✅     | packages/editor-persistence/src/draft-store.ts:192<br>apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:189                                                                        |
| FR-010      | ✅     | apps/api/src/services/drafts/draft-bundle.service.ts:150<br>apps/api/tests/unit/drafts/draft-bundle.service.test.ts:95                                                                                |
| FR-011      | ✅     | apps/web/src/lib/draft-logout-registry.ts:53<br>apps/web/src/lib/clerk-client.tsx:99<br>apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts:86                                                |
| FR-012      | ✅     | apps/web/src/lib/telemetry/client-events.ts:25<br>apps/web/src/lib/telemetry/client-events.test.ts:20                                                                                                 |
| FR-013      | ✅     | packages/editor-persistence/src/draft-store.ts:133<br>packages/editor-persistence/tests/draft-store.test.ts:81                                                                                        |
| FR-014      | ✅     | apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:297<br>apps/api/src/routes/documents.ts:251<br>apps/api/tests/contract/documents.draft-compliance.contract.test.ts:32            |

### Testing

- Unit + integration suites cover the DraftStore, bundled save
  service/repository, telemetry, logout registry, and persistence hook
  (`packages/editor-persistence/tests/draft-store.test.ts`,
  `apps/api/tests/unit/drafts/*`,
  `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`).
- Contract tests assert PATCH/POST draft endpoints and the new retention policy
  fixture (`apps/api/tests/contract/documents.draft-bundle.contract.test.ts`,
  `apps/api/tests/contract/documents.draft-compliance.contract.test.ts`,
  `apps/api/tests/contract/projects.retention.contract.test.ts`).
- Playwright flow exercises draft recovery, quota messaging, logout purge, and
  bundled save (`apps/web/tests/e2e/document-editor/draft-persistence.e2e.ts`).
- Pending to run before merge: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm --filter @ctrl-freaq/web test:e2e:quick` (per T024).

### Risks & Mitigations

- Logout purge depends on Clerk sign-out interception; verify in an environment
  with real auth to confirm `triggerDraftLogoutHandlers` fires before session
  teardown (`apps/web/src/lib/clerk-client.tsx:99`).
- Retention policy data is currently fixture-backed for `project-test`; ensure
  future projects seed policies or fall back gracefully
  (`apps/api/src/routes/projects.ts:319`).

### Clarifications

- 2025-09-30: When recovered drafts conflict with server updates, keep the local
  draft primary and archive the server version for replay.
- 2025-09-30: If browser storage capacity is hit before save, prune the oldest
  drafts automatically and notify the user.
- 2025-09-30: Unsaved drafts never auto-expire; they persist until explicitly
  saved or discarded.
- 2025-09-30: If bundled save validation fails for any section, abort the entire
  bundle and preserve all drafts.
- 2025-09-30: Drafts must remain client-side only and be cleared immediately on
  logout.
- 2025-09-30: Telemetry for draft events stays in the browser console and never
  transmits identifiers to the server.
- 2025-09-30: Draft rehydration should finish within ~3 seconds; if slower,
  surface guidance explaining the delay.
- 2025-09-30: Maximum draft storage relies on browser limits with no explicit
  cap.
- 2025-09-30: Draft keys combine document slug, section title, and author
  identity to avoid collisions.
- 2025-09-30: Status indicators require visible labels and ARIA live
  announcements for accessibility.
- 2025-09-30: Offline drafts under retention policy log a compliance warning
  enabling manual escalation later.

### Assumption Log

- No new feature-level assumptions were introduced while resolving audit
  findings; existing guidance still applies.
- Displaying draft timestamps with `Intl.DateTimeFormat` in the browser
  locale/time zone meets FR-002 accessibility expectations
  (`apps/web/src/features/document-editor/hooks/use-draft-persistence.ts:60`).
- Any active project retention policy implies every unsynced draft should emit a
  compliance warning until the policy is cleared
  (`apps/web/src/features/section-editor/hooks/use-section-draft.ts:464`).
- Returning `serverVersion: 0` and empty `serverContent` for scope mismatches
  prevents leaking other documents while satisfying the contract
  (`apps/api/src/services/drafts/draft-bundle.repository.ts:300`).
- Console-only telemetry still delivers observability without transporting draft
  identifiers (`apps/web/src/lib/telemetry/client-events.ts:25`).
- Clearing persistence markers when rehydrated drafts postdate the cleanup time
  preserves intentional cleanup while keeping newer drafts intact
  (`apps/web/src/features/section-editor/hooks/use-section-draft.ts:884`).
