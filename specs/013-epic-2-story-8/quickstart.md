# Quickstart — Quality Gates Integration

## Prerequisites

1. Install dependencies: `pnpm install`
2. Build shared packages (ensures QA engine available): `pnpm build`
3. Start local stack when testing UI flows: `pnpm dev` (web on 5173, api
   on 5001)

## Section Validation Loop (User Story 1)

1. Edit a section in the document editor; pause typing to trigger the debounce.
2. Observe the sidebar chip copy:
   - `Validating section…` (animated ring during first 2 s)
   - `Still checking—this may take another moment` if execution exceeds SLA.
3. When a blocker appears, review remediation cards (severity badge, summary,
   bullet actions, optional policy link) and use the inline `Re-run validation`
   control after applying fixes.
4. CLI parity: `pnpm --filter @ctrl-freaq/qa cli run-section --section-id <id>`
   echoes the same `runId` surfaced in the UI.

## Document Dashboard (User Story 2)

1. Open the quality dashboard from a document with mixed statuses.
2. Confirm summary tiles show counts by severity and matching iconography.
3. Attempt to publish; observe disabled controls with helper copy
   `Publishing blocked: resolve X blocker issues first`.
4. Trigger a batch re-run via the dashboard or CLI
   (`pnpm --filter @ctrl-freaq/qa cli run-document --document-id <id>`).
5. Within 5 s the dashboard clears blockers, updates the footer metadata
   (`Last run by`, `Completed at`, `Request ID`), and enables publishing.

## Traceability Matrix (User Story 3)

1. Modify a requirement-linked section and resolve validation warnings.
2. Open the traceability matrix:

- Each row shows two-line content preview, status badge, last validated time.
- Use filter chips (`Blockers`, `Warnings`, `Neutral/Not Run`, `Covered`) to
  prioritize work.

3. Remove requirement coverage to trigger orphan banner:
   `Traceability gap detected: N requirements need reassignment.` Follow the
   `Resolve now` link to jump to the `Neutral / Not Run` filter and reassign
   coverage before publishing. The backend logs the orphan event via
   `POST /documents/:documentId/traceability/orphans`.
4. Optional: Run
   `pnpm --filter @ctrl-freaq/api test -- --run traceability.contract` to verify
   contract coverage for the traceability endpoints.

## Testing Strategy

- Author failing tests first:
  - `packages/qa` unit tests for rule engines
    (`pnpm --filter @ctrl-freaq/qa test`)
  - `apps/api` contract/unit suites (`pnpm --filter @ctrl-freaq/api test:quick`)
  - `apps/web` component hooks + Playwright fixtures
    (`pnpm --filter @ctrl-freaq/web test:e2e:quick`)
- After implementation, run gauntlet before merge:
  ```
  pnpm lint
  pnpm typecheck
  pnpm test
  ```
  Capture notable deltas in PR notes per Constitution requirements.

## Telemetry & Audit Verification

1. Trigger section validation and inspect audit log entry for `runId`,
   `triggeredBy`, rule failures, and remediation state.
2. Confirm telemetry pipeline emits frequency/failure metrics (QA dashboards).
3. Verify ARIA live region announces status changes; use screen reader to ensure
   focus moves to the newest blocker card.
