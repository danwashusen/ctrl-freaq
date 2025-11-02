# Quickstart: Unified SSE Event Hub

**Date**: 2025-11-03  
**Spec**: [spec.md](/specs/001-replace-polling-sse/spec.md)  
**Decisions Referenced**: D001–D006 (see `research.md`)

## Prerequisites

- pnpm workspace bootstrapped (`pnpm install`)
- Clerk or simple auth configured (`ENABLE_SIMPLE_AUTH=1` or Clerk keys)
- Feature flags disabled by default:
  - Backend: `ENABLE_EVENT_STREAM=false`
  - Frontend: `VITE_ENABLE_SSE_HUB=false`
- Local dev ports free (API 5001, web 5173)

## Environment Setup

1. Start backend with feature flag:
   ```bash
   ENABLE_EVENT_STREAM=true EVENT_STREAM_REPLAY_LIMIT=100 pnpm --filter @ctrl-freaq/api dev
   ```
2. In a new terminal, start frontend with hub enabled:
   ```bash
   VITE_ENABLE_SSE_HUB=true pnpm --filter @ctrl-freaq/web dev
   ```
3. Sign in via simple auth or Clerk. Confirm `/api/v1/events` responds with HTTP
   200 (network tab should show pending SSE request).

## Validation Scenarios

### US1 – Project lifecycle updates stream instantly (D001, D002, D004, D005)

1. Open `/projects/:id` in two browser tabs (Tab A = viewer, Tab B = actor).
2. In Tab B, archive the project. Observe Tab A:
   - Project banner updates within 2s.
   - Polling interval remains paused while hub status `healthy`.
3. Kill the API temporarily (`Ctrl+C`). Tab A should enter degraded mode, resume
   1.5s polling, and show toast about fallback.
4. Restart API; Tab A should reconnect, replay missed events, disable polling,
   and mark hub as healthy.
5. Verification hooks:
   - Run contract test once implemented:
     `pnpm --filter @ctrl-freaq/api test -- projects-api.contract --runInBand`.
   - Run new hub unit test:
     `pnpm --filter @ctrl-freaq/web test -- useProjectEvents-hub`.

### US2 – Quality gate progress streams to editors (D003, D004, D005)

1. In the editor, kick off a document quality gate run.
2. Observe the quality gate panel:
   - Progress stages update in real time without 200ms polling (verify console
     logs show `hub: event` messages).
   - Once run completes, summary arrives and polling remains disabled.
3. Force a retry by disconnecting network briefly; ensure panel message
   indicates fallback and resumes updates once stream recovers.
4. Verification hooks:
   - Supertest SSE test (after implementation):
     `pnpm --filter @ctrl-freaq/api test -- quality-gates.stream`.
   - Frontend hook test:
     `pnpm --filter @ctrl-freaq/web test -- useQualityGates-hub`.

### US3 – Section draft conflicts alert collaborators (D003, D004, D005)

1. Tab A edits a section and saves draft version N.
2. Tab B edits same section and triggers conflict (e.g., by saving mismatched
   base version).
3. Ensure Tab A receives `section.conflict` warning instantly and diff drawer
   opens with latest approved content.
4. While hub degraded (simulate network drop), confirm diff polling resumes
   (check devtools network for `diff` requests).
5. Verification hooks:
   - Contract test after wiring SSE:
     `pnpm --filter @ctrl-freaq/api test -- section-editor.conflict.stream`.
   - Frontend store test:
     `pnpm --filter @ctrl-freaq/web test -- editor-store-conflict`.

## Telemetry & Observability (D006)

- Tail backend logs to confirm structured SSE events:
  ```bash
  pnpm --filter @ctrl-freaq/api dev | jq '. | select(.msg | test("Event stream"))'
  ```
- Validate metrics counters increment:
  - `connection.opened`, `connection.closed`
  - `fallback.activated`, `fallback.recovered`
- Ensure fewer than 2% of connections emit `auth_error` under normal runs
  (Success Criterion SC-004).

## Rollback & Fallback

- Disable frontend flag (`VITE_ENABLE_SSE_HUB=false`) to restore legacy polling
  without redeploying backend.
- If backend instability detected:
  1. Set `ENABLE_EVENT_STREAM=false` and redeploy API.
  2. Clients automatically fall back to polling; monitor telemetry for lingering
     degraded states.

## Cleanup

- Stop dev servers (`Ctrl+C`).
- Reset feature flags to defaults in `.env.local`.
- If mock data was seeded for tests, run `pnpm clean` to remove caches before
  next session.
