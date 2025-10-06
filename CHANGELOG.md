# Change Log

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
