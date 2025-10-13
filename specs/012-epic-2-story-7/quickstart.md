# Quickstart — Streaming UX Validation

## Prerequisites

- Install dependencies: `pnpm install`
- Ensure `.env.local` contains valid Clerk and OpenAI/Vercel credentials
- Run database migrations (if pending):
  `pnpm --filter @ctrl-freaq/api db:migrate`

## Start Services

```bash
# Launch API + Web together
pnpm dev

# Alternative: run targeted apps
pnpm --filter @ctrl-freaq/api dev
pnpm --filter @ctrl-freaq/web dev
```

## Validate Streaming Co-Author Flow (User Story 1)

1. Open `http://localhost:5173` and load a document with multiple sections.
2. Trigger Co-Author guidance on Section A.
3. Within 0.3s confirm the sidebar shows streaming status chip and ARIA live
   announcements (screen reader: VoiceOver/NVDA).
4. While streaming, continue editing Section A or open the diff preview—editor
   must remain responsive.
5. Capture session telemetry via browser devtools (`window.__cfqTelemetry`) to
   confirm `timeToFirstUpdateMs` < 300.

## Validate Document QA Review Flow (User Story 1 parity)

1. Switch to the Document QA panel for Section B.
2. Start a QA review and verify the first update arrives within 0.3s.
3. Confirm resequencing works by throttling the network and observing buffered
   events arriving in order.
4. Cancel the QA session and check the UI surfaces cancel reasons and resets
   progress state.
5. Re-run the request to ensure retry builds a fresh stream and telemetry logs a
   new `sessionId`.

## Validate Assumptions Loop & Cross-Section Concurrency (User Story 2)

1. In Section A leave the original stream running.
2. Start an assumption loop in Section C (should stream concurrently).
3. Pause or defer the assumption flow, then resume and ensure progress bullets
   and ARIA announcements stay in sync.
4. Start a second request in Section C before the first completes—ensure newest
   request replaces the pending one and UI surfaces replacement notice.
5. Confirm telemetry records distinct `sessionId` values with unique
   `concurrencySlot` numbers.

## Validate Fallback Delivery Across Modes (User Story 3)

1. Simulate blocked streaming by disabling SSE in the browser devtools network
   tab or running API with one of:
   - `STREAMING_DISABLED=true` (global)
   - `COAUTHOR_STREAMING_DISABLED=true`
   - `DOCUMENT_QA_STREAMING_DISABLED=true`
   - `AI_STREAMING_DISABLED=true` (shared guard)
2. Trigger co-author assist, document QA review, and an assumption loop in
   separate sections.
3. Verify each UI announces fallback mode, shows deterministic progress
   indicator, and delivers final response once ready.
4. Confirm final transcripts for co-author and QA match streaming metadata
   (rationale, confidence, citations) and assumption bullets mirror the
   streaming order.
5. Inspect telemetry to ensure a single fallback event is logged per session
   with preserved tokens and root cause.

## Recommended Tests

```bash
# Lint / typecheck gate
pnpm lint && pnpm typecheck

# Unit + contract suites touching streaming
pnpm --filter @ctrl-freaq/api test -- --runInBand --grep streaming
pnpm --filter @ctrl-freaq/web test -- --runInBand --grep streaming

# Fixture Playwright flow covering P1–P3 scenarios
pnpm --filter @ctrl-freaq/web test:e2e:quick -- --grep streaming
```

## Troubleshooting

- Ensure only one active stream per section: check API logs for conflicts with
  code `PENDING_EXISTS`.
- Fallback not triggered when expected: confirm telemetry flag `fallbackReason`
  matches environment override.
- If time-to-first-update exceeds 300ms, profile the prompt assembly path in
  `apps/api/src/services/co-authoring/ai-proposal.service.ts`.
