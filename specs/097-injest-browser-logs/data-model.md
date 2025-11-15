# Data Model – Browser Log Ingestion Endpoint

## BrowserLogBatch

| Field        | Type                   | Constraints                                                           | Notes                                         |
| ------------ | ---------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `source`     | string                 | Required; must equal `browser`                                        | Reject any other string early (spec FR-002)   |
| `sessionId`  | string                 | Required, non-empty, ≤128 chars                                       | Helps tag server logs & correlate retries     |
| `userId`     | string \| null         | Optional; if present must match authenticated user                    | Default to `req.user?.userId` if client omits |
| `logs`       | BrowserLogEntry[]      | Required array length 1–100                                           | Array length validates before entry parsing   |
| `metadata`   | object?                | Optional future-proof container; pass-through only if shape validated | Drop/ignore unknown props when logging        |
| `receivedAt` | ISO timestamp (server) | Set on ingestion                                                      | Added server-side, not client input           |
| `clientIp`   | string                 | Derived from `req.ip`                                                 | Emitted only in enriched event                |
| `userAgent`  | string                 | Derived from `req.get('User-Agent')`                                  | Emitted only in enriched event                |

## BrowserLogEntry

| Field        | Type                                               | Constraints                                                    | Notes                                                 |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `timestamp`  | string                                             | Required ISO 8601; must be within ±24h of server clock         | Reject invalid/NaN dates                              |
| `level`      | enum                                               | Required; `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`            | Use entry level to decide server log severity         |
| `message`    | string                                             | Required, non-empty, ≤2 KB                                     | Trim whitespace before logging                        |
| `requestId`  | string                                             | Required; request/operation identifier from client             | Enables ops correlation                               |
| `sessionId`  | string                                             | Optional override; falls back to batch sessionId               | Allows per-entry overrides during multi-tab scenarios |
| `event_type` | string?                                            | Optional; kebab-case describing event                          | Validate length ≤100                                  |
| `context`    | Record<string, string \| number \| boolean>        | Optional shallow object, ≤20 keys                              | Reject nested objects to keep logs flat               |
| `attributes` | Record<string, unknown>                            | Optional; must be JSON-serializable and ≤5 KB once stringified | Later sanitized/redacted before logging               |
| `error`      | { name: string; message: string; stack?: string }? | Optional structured error                                      | Max stack length 10 KB                                |
| `index`      | number                                             | Server-added (0-based)                                         | Used in error responses (`details.path`)              |

## EnrichedLogEvent

| Field            | Type            | Constraints                                                           | Notes                                   |
| ---------------- | --------------- | --------------------------------------------------------------------- | --------------------------------------- |
| `event`          | string          | Always `browser.log`                                                  | Helps Pino filtering / log shipping     |
| `apiRequestId`   | string          | Required; `req.requestId`                                             | Shared with HTTP response               |
| `entryRequestId` | string          | Required; original entry `requestId`                                  | Maintains correlation                   |
| `sessionId`      | string          | Batch sessionId or entry override                                     | Stored to help ops correlate sessions   |
| `userId`         | string \| null  | Authenticated user when available                                     | Derived from middleware                 |
| `ip`             | string          | Derived from `req.ip`                                                 | Null-safe; respect trust proxy settings |
| `userAgent`      | string \| null  | Derived from headers                                                  | Truncated to 512 chars                  |
| `ingestedAt`     | ISO timestamp   | Server-set at log emission                                            | Helps TTL/ordering                      |
| `level`          | enum            | Mirrors entry `level`; server may downgrade DEBUG to INFO for storage |                                         |
| `payload`        | BrowserLogEntry | Original entry (after validation)                                     | Stored as sanitized copy                |

## State Transitions

1. **Received → Validated**: Request passes auth/rate limiter and body parser;
   batch schema validated. Failure returns 401/429/400 before any enrichment.
2. **Validated → Enriched**: Server attaches requestId, userId, network
   metadata; entry indexes computed. If any enrichment step fails, respond 500
   and log fatal (guarded by tests).
3. **Enriched → Logged**: Each entry emits structured `browser.log` event at
   severity derived from entry level. Ops tooling consumes logger output; no
   persistence occurs.
4. **Enriched → Responded**: After all entries log successfully, respond HTTP
   202 with `requestId`. If logging throws, respond 500 and mark batch as failed
   in audit log.

No server-side storage objects are created, so lifecycle consists purely of
request processing. The only repeatable identifier is the client-supplied
`requestId` plus server `apiRequestId`.
