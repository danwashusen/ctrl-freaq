# Research Findings — Streaming UX for Document Editor

## Streaming Queue Management

- **Decision**: Implement per-section queue manager that keeps only the newest
  pending interaction, cancelling older queued jobs via AbortController while
  preserving the active stream.
- **Rationale**: Guarantees newest author intent executes next without growing
  queues, avoids head-of-line blocking under 40+ concurrent interactions, and
  aligns with clarified requirement to replace prior pending requests.
- **Alternatives considered**:
  - FIFO queue retaining all pending interactions — rejected due to latency
    spikes and unnecessary processing for stale requests.
  - Rejecting additional requests outright — rejected because users expect their
    latest action to run automatically without manual retry.

## Accessibility Announcements

- **Decision**: Use ARIA live regions with `aria-live="polite"` for incremental
  progress updates and `aria-live="assertive"` for state changes (start,
  fallback, completion), paired with visually persistent status chips.
- **Rationale**: Matches WAI-ARIA guidance for frequent streaming updates,
  ensures screen-reader parity with visual cues, and satisfies FR-004 and
  success criteria for continuous progress awareness.
- **Alternatives considered**:
  - Single assertive region for all updates — rejected to avoid interrupting
    user reading with high-frequency announcements.
  - Relying solely on visual indicators — rejected as non-compliant with
    accessibility mandates.

## Telemetry Schema Enhancements

- **Decision**: Extend `StreamingInteractionSession` telemetry payloads to
  include `sessionId`, `sectionId`, queue disposition (`active`, `replaced`,
  `fallback`), concurrency slot counts, and latency metrics (time to first
  update, total duration).
- **Rationale**: Provides observability needed to verify SC-001 through SC-005,
  supports debugging of queue replacement, and documents fallback triggers for
  compliance reviews.
- **Alternatives considered**:
  - Logging only aggregate metrics — rejected because per-session detail is
    required for audit trails.
  - Capturing telemetry exclusively on the client — rejected; server-side
    logging is needed for authoritative analytics and Constitution logging
    requirements.

## System Context

- SSE transport served by `/apps/api/src/routes/co-authoring.ts` and
  `/apps/api/src/routes/sections.ts` on Node.js 20 with Express ensures
  low-latency streaming.
- AI processing delegates to the existing Vercel AI SDK adapters under
  `/apps/api/src/services/co-authoring/` and
  `/apps/api/src/modules/section-editor/services/`.
- Clerk authentication flows enforced via middleware in
  `/apps/api/src/middleware/auth.ts`; all streaming endpoints inherit
  bearer/session checks.
- Client telemetry is emitted through
  `/apps/web/src/lib/telemetry/client-events.ts` and mirrored server-side via
  `/apps/api/src/middleware/ai-request-audit.ts`.
- Fallback paths rely on environment toggles (e.g., `STREAMING_DISABLED`)
  sourced from `.env.local` and consumed in
  `/apps/api/src/services/co-authoring/ai-proposal.service.ts`.

## Codebase Summary

- Server logic lives in `/apps/api`, with domain services under
  `/apps/api/src/services/` and
  `/apps/api/src/modules/section-editor/services/`; Vitest suites sit alongside
  implementations.
- Frontend streaming UX resides in `/apps/web/src/features/document-editor/`
  with shared utilities in `/apps/web/src/lib/streaming/` and telemetry helpers
  in `/apps/web/src/lib/telemetry/`.
- Shared domain contracts are centralized in `/packages/shared-data/src`, while
  cross-cutting queue utilities will live in
  `/packages/editor-core/src/streaming/`.
- Contract definitions for this feature are tracked at
  `/specs/012-epic-2-story-7/contracts/streaming-openapi.yaml`; quick validation
  steps in `/specs/012-epic-2-story-7/quickstart.md`.
- Quality gates use pnpm workspaces—run from repository root `/` to cover lint,
  typecheck, unit, contract, and Playwright suites.
