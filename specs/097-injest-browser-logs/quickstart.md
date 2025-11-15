# Quickstart – Browser Log Ingestion Endpoint

Follow these scenarios to validate `/api/v1/logs` end-to-end using fixture data.

## Prerequisites

1. Install dependencies: `pnpm install`
2. Load fixture profile (ensures deterministic auth + users):
   ```sh
   CTRL_FREAQ_PROFILE=fixture pnpm dev:apps:e2e
   ```
   This command boots both API (port 5001) and web client (5173) using
   `.env.fixture`.
3. Export a bearer token from the simple auth fixture (already seeded via the
   dev command) or call the `POST /auth/simple/login` helper to obtain
   `Authorization: Bearer mock-jwt-token`.

## US1 – Browser flush receives acknowledgement (D001, D002)

Goal: Confirm authenticated clients can submit ≤10-entry batches and receive
HTTP 202 with a server `requestId`.

Browser instrumentation accumulates at most **10 entries** or **5 seconds** of
logs before posting to `/api/v1/logs`. The flow below mirrors that policy.

1. Send a valid payload (≤1 MB) using curl:
   ```sh
   curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: application/json' \
     -d @- <<'JSON'
   {
     "source": "browser",
     "sessionId": "sess_fixture",
     "logs": [
       {
         "timestamp": "2025-11-14T19:10:00.000Z",
         "level": "INFO",
         "message": "fixture flush sent",
         "requestId": "req_fixture_1"
       }
     ]
   }
   JSON
   ```
2. Verify response:
   ```json
   {
     "requestId": "req_xxx",
     "status": "accepted",
     "receivedCount": 1
   }
   ```
   Ensure the `x-request-id` response header matches the JSON body.
3. Tail API logs (`pnpm --filter @ctrl-freaq/api dev` or separate terminal) and
   confirm a `browser.log` entry is emitted with `sessionId`, `userId`, `ip`,
   and `userAgent`.
4. Verify the `text/plain` sendBeacon path by sending stringified JSON:
   ```sh
   curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: text/plain' \
     -d '{"source":"browser","sessionId":"sess_fixture","logs":[{"timestamp":"2025-11-14T19:11:00.000Z","level":"INFO","message":"beacon flush","requestId":"req_send_beacon"}]}'
   ```
   The response mirrors the JSON sample, proving that browsers can flush from
   `navigator.sendBeacon` while tabs unload.

## US2 – Ops teams correlate browser issues (D003)

Goal: Validate that enriched server logs include both client and server context.

1. Repeat the curl command but include crash details:
   ```sh
   curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: application/json' \
     -d @- <<'JSON'
   {
     "source": "browser",
     "sessionId": "sess_fixture",
     "logs": [
       {
         "timestamp": "2025-11-14T19:12:00.000Z",
         "level": "ERROR",
         "message": "crash",
         "requestId": "req_fixture_2",
         "attributes": {
           "stack": "Error: boom"
         },
         "error": {
           "name": "Error",
           "message": "boom",
           "stack": "Error: boom\n    at ..."
         }
       }
     ]
   }
   JSON
   ```
2. In API logs, confirm the emitted JSON includes:
   - `event: "browser.log"`
   - `apiRequestId` (server)
   - `entryRequestId: "req_fixture_2"`
   - `sessionId`, `userId`, `ip`, `userAgent`
   - The original entry payload under `payload`
3. Record the `requestId` for correlating with frontend telemetry.

## US3 – Clients receive actionable rejections (D001, D004)

Goal: Validate schema/rate-limit failures produce machine-readable errors.

### Validation failure

1. Send a payload missing `requestId`:
   ```sh
   curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: application/json' \
     -d '{"source":"browser","sessionId":"sess_fixture","logs":[{"timestamp":"2025-11-14T19:15:00.000Z","level":"INFO","message":"invalid"}]}'
   ```
2. Expect HTTP 400 with
   ```json
   {
     "code": "INVALID_PAYLOAD",
     "message": "logs[0].requestId is required",
     "details": {
       "path": "logs[0].requestId"
     }
   }
   ```

### Body size / entry limit failure

1. Create a >1 MB payload and post it:

   ```sh
   python - <<'PY' | curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: application/json' \
     --data-binary @-
   import json

   payload = {
     "source": "browser",
     "sessionId": "sess_fixture",
     "logs": [
       {
         "timestamp": "2025-11-14T19:17:00.000Z",
         "level": "INFO",
         "message": "x" * (1024 * 1024 + 1),
         "requestId": "req_too_large"
       }
     ]
   }
   print(json.dumps(payload))
   PY
   ```

   Expect HTTP 413 with

   ```json
   {
     "code": "PAYLOAD_TOO_LARGE",
     "message": "Batch body must be ≤1MB",
     "requestId": "req_server"
   }
   ```

2. For `logs.length > 100`, run:
   ```sh
   node - <<'JS' | curl -X POST http://localhost:5001/api/v1/logs \
     -H 'Authorization: Bearer mock-jwt-token' \
     -H 'Content-Type: application/json' \
     --data-binary @-
   const payload = {
     source: 'browser',
     sessionId: 'sess_fixture',
     logs: Array.from({ length: 101 }, (_, index) => ({
       timestamp: new Date().toISOString(),
       level: 'INFO',
       message: `entry ${index}`,
       requestId: `req_${index}`,
     })),
   };
   console.log(JSON.stringify(payload));
   JS
   ```
   The response is HTTP 413 with `details.path: "logs"` and the logger spy shows
   zero emitted events.

### Rate limiting

1. Run a loop to send >`RATE_LIMIT_MAX` requests within the configured window:
   ```sh
   for i in $(seq 1 110); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -H 'Authorization: Bearer mock-jwt-token' \
       -H 'Content-Type: application/json' \
       -d '{"source":"browser","sessionId":"sess_fixture","logs":[{"timestamp":"2025-11-14T19:16:00.000Z","level":"INFO","message":"spam","requestId":"req_spam_'${i}'"}]}' \
       http://localhost:5001/api/v1/logs
   done
   ```
2. Observe HTTP 429 responses with `Retry-After` headers once the limit trips.
   Clients must back off for the indicated number of seconds before retrying.

## Rollback / Cleanup

- Stop dev servers with `Ctrl+C`.
- Remove any temporary payload files.
- Clear terminal logs to avoid leaking sensitive crash stacks.
