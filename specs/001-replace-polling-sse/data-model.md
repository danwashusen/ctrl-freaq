# Data Model: Unified SSE Event Hub

**Date**: 2025-11-03  
**Spec**: [spec.md](/specs/001-replace-polling-sse/spec.md)  
**Decisions Referenced**: D001–D006 (see `research.md`)

## Entity Catalogue

### EventEnvelope

| Field         | Type                                  | Required | Notes                                                                | Validation/Constraints                                                      |
| ------------- | ------------------------------------- | -------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `topic`       | enum                                  | Yes      | Logical channel (`project.lifecycle`, `quality-gate.progress`, etc.) | Must match brokers’ registered topic list; lowercase dot-delimited          |
| `resourceId`  | string                                | Yes      | Domain identifier (projectId, documentId, sectionId, runId)          | Non-empty; max 120 chars; must pass authorization checks before publish     |
| `sequence`    | 64-bit integer                        | Yes      | Monotonic counter per topic/resource                                 | Strictly increasing, resets only on broker restart with fresh snapshot flag |
| `emittedAt`   | ISO 8601 timestamp (ms)               | Yes      | UTC timestamp of publication                                         | Generated server-side; within ±5 seconds of system clock                    |
| `payload`     | JSON object                           | Yes      | Event-specific body                                                  | Validated against topic schema (see Contracts)                              |
| `kind`        | enum (`event`,`snapshot`,`heartbeat`) | Yes      | Distinguishes replay snapshot vs live event vs keep-alive comment    | `heartbeat` payload is `{}`; `snapshot` indicates replay recovery           |
| `lastEventId` | string \| null                        | No       | Mirrors `Last-Event-ID` for diagnostics                              | Populated on retransmit to trace replays                                    |
| `metadata`    | Record<string,string> \| null         | No       | Optional extras (e.g., `runId`, `sequenceGroup`)                     | Keys kebab-case; values <= 120 chars                                        |

### TopicReplayBuffer

| Field          | Type                  | Required | Notes                                   | Validation/Constraints                                        |
| -------------- | --------------------- | -------- | --------------------------------------- | ------------------------------------------------------------- |
| `topic`        | string                | Yes      | Topic identifier                        | Unique per buffer                                             |
| `resourceId`   | string                | Yes      | Resource scope (or `*` for global)      | Combined (`topic`,`resourceId`) forms composite key           |
| `maxItems`     | integer               | Yes      | Configured replay depth                 | Default 100; min 10; env override `EVENT_STREAM_REPLAY_LIMIT` |
| `items`        | EventEnvelope[]       | Yes      | Ordered stored events                   | Trimmed oldest-first when length exceeds `maxItems`           |
| `lastSequence` | integer               | Yes      | Latest sequence issued for this scope   | Ensures replay order fidelity                                 |
| `snapshot`     | EventEnvelope \| null | No       | Most recent snapshot for stale recovery | `kind` must equal `snapshot` when present                     |
| `updatedAt`    | timestamp             | Yes      | Last mutation time                      | Used for eviction/cleanup metrics                             |

### StreamSubscription

| Field            | Type                                     | Required | Notes                                               | Validation/Constraints                                                    |
| ---------------- | ---------------------------------------- | -------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `connectionId`   | UUID                                     | Yes      | Unique server-side identifier for active SSE stream | Generated on connect; used for telemetry                                  |
| `userId`         | UUID                                     | Yes      | Authenticated user                                  | Derived from Clerk/simple session                                         |
| `workspaceId`    | UUID                                     | Yes      | Workspace context                                   | Ensures multi-tenant isolation                                            |
| `topics`         | Array<{topic,resourceId}>                | Yes      | Subscribed scopes                                   | Defaults to all authorized topics when empty (D002)                       |
| `lastEventIds`   | Map<string,string>                       | Yes      | Last dispatched sequence per topic/resource         | Updated on each send; used for replay requests                            |
| `status`         | enum (`healthy`,`recovering`,`degraded`) | Yes      | Server-tracked channel state mirroring client hub   | `recovering` when replay in-flight; `degraded` after max retries exceeded |
| `retryCount`     | integer                                  | Yes      | Current exponential backoff attempt                 | Reset to 0 on successful message                                          |
| `connectedAt`    | timestamp                                | Yes      | Initial connect time                                | Logged for metrics                                                        |
| `lastActivityAt` | timestamp                                | Yes      | Last event or heartbeat delivered                   | Drives idle disconnect threshold                                          |

### HubHealthState (client-side)

| Field             | Type                                     | Required | Notes                                         | Validation/Constraints                               |
| ----------------- | ---------------------------------------- | -------- | --------------------------------------------- | ---------------------------------------------------- |
| `status`          | enum (`healthy`,`recovering`,`degraded`) | Yes      | Mirrors broker subscription status            | Derived from EventSource callbacks                   |
| `lastEventAt`     | timestamp \| null                        | Yes      | When last event (non-heartbeat) was processed | Null until first event                               |
| `lastHeartbeatAt` | timestamp \| null                        | No       | Last keep-alive comment                       | Used to detect silent drops                          |
| `retryAttempt`    | integer                                  | Yes      | Current reconnect attempt                     | Resets on success; triggers fallback after threshold |
| `fallbackActive`  | boolean                                  | Yes      | Indicates polling is re-enabled               | Tied to spec FR-008                                  |
| `listeners`       | Map<string,number>                       | Yes      | Count of active topic/resource subscribers    | Helps release unused scopes                          |

### BrokerMetrics (telemetry snapshot)

| Field                 | Type      | Notes                                             |
| --------------------- | --------- | ------------------------------------------------- |
| `totalConnections`    | integer   | Active SSE connections                            |
| `authorizedRejects`   | integer   | Count of auth failures                            |
| `avgReplayWindow`     | integer   | Rolling average of stored events per topic        |
| `fallbackActivations` | integer   | Number of client fallbacks triggered (aggregated) |
| `uptimeSeconds`       | integer   | Broker uptime for diagnostics                     |
| `lastRotationAt`      | timestamp | When broker buffers were rotated/cleared          |

## Relationships

- `StreamSubscription.topics` references `TopicReplayBuffer (topic, resourceId)`
  entries; subscriptions default to all buffers (D002) filtered by
  authorization.
- `TopicReplayBuffer.items` consist exclusively of `EventEnvelope` objects where
  `topic` & `resourceId` align with buffer identity.
- `HubHealthState` is maintained per browser tab and references server-side
  `StreamSubscription.connectionId` for logging correlation.
- `BrokerMetrics` aggregates across all `StreamSubscription` records and replay
  buffers to feed telemetry and Success Criterion SC-004.

## Lifecycle & State Transitions

### Server-side subscription

```
connect → healthy → recovering → healthy
                 ↘ degraded (after max retries) ↘ disconnect
```

- **connect**: Authenticated request accepted; broker registers subscription,
  replays any buffered events based on `Last-Event-ID`.
- **healthy**: Normal operation; broker sends heartbeat every
  `EVENT_STREAM_HEARTBEAT_INTERVAL_MS` (default 15s) when idle.
- **recovering**: Triggered after transient network error; broker attempts
  replay with exponential backoff (e.g., 1s, 2s, 4s, max 30s).
- **degraded**: Entered when retry exceeds configurable limit
  (`EVENT_STREAM_MAX_RETRIES`, default 5); broker keeps emitting heartbeats but
  flags subscription for fallback.
- **disconnect**: Client closes or server evicts after idle timeout; metrics
  capture reason (`client_close`, `auth_revoked`, `timeout`, `error`).

### Client hub fallback

```
healthy → recovering → degraded → fallbackActive
                                ↘ healthy (after successful reconnect)
```

- Polling resumes once `fallbackActive=true`; hooks watch this flag to re-enable
  existing timers.
- On successful reconnect, hub drains replay buffer, toggles polling off, resets
  `retryAttempt`, and broadcasts `healthy`.

## Validation Rules

| Rule                     | Applies To                | Details                                                                                           |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------- |
| Topic registration       | Broker init               | Only allow topics declared in configuration to prevent arbitrary publish attempts.                |
| Authorization gating     | Event publish & subscribe | Publisher must supply actor/account context; broker validates resource-level access before send.  |
| Replay window saturation | TopicReplayBuffer         | When `items.length > maxItems`, emit snapshot before trimming to ensure clients rehydrate.        |
| Heartbeat cadence        | EventEnvelope             | Heartbeat (`kind=heartbeat`) must send at least every 15s; clients treat >30s gap as degraded.    |
| Sequence monotonicity    | EventEnvelope             | Sequences must never decrease; broker resets only after restart and informs clients via snapshot. |
| Fallback notification    | HubHealthState            | When `status=degraded`, hub dispatches `stream.degraded` event so hooks re-enable polling.        |

## Derived Views & DTOs

- **Server-Sent Event payload**: Each SSE line encodes `event: <topic>` and
  `data: <EventEnvelope JSON>` with optional `id: <sequenceKey>` and
  `retry: <ms>` hints.
- **Snapshot DTO**: For topics where replay gaps exist, broker issues
  `kind="snapshot"` payload containing latest authoritative state (e.g., full
  project lifecycle object) to resync clients.
- **Telemetry Event DTO**: Structured log schema
  `{ connectionId, userId, topic, eventType, sequence, durationMs, retryCount }`
  persisted via Pino for SC-004 auditing.

## Configuration & Environment Inputs

| Variable                             | Purpose                                       | Default          |
| ------------------------------------ | --------------------------------------------- | ---------------- |
| `ENABLE_EVENT_STREAM`                | Backend feature flag for SSE endpoint         | `false`          |
| `EVENT_STREAM_REPLAY_LIMIT`          | Max buffered events per topic/resource        | `100`            |
| `EVENT_STREAM_HEARTBEAT_INTERVAL_MS` | Idle heartbeat delay                          | `15000`          |
| `EVENT_STREAM_MAX_RETRIES`           | Broker retry attempts before marking degraded | `5`              |
| `VITE_ENABLE_SSE_HUB`                | Frontend flag enabling event hub              | `false`          |
| `VITE_EVENT_STREAM_PATH`             | Optional override for EventSource path        | `/api/v1/events` |

## Open Questions / Implementation Notes

- Confirm whether broker module belongs directly in `apps/api` or shared
  package; current assumption keeps it local to reduce coupling.
- Evaluate back-pressure handling for extremely active topics; spec assumes
  low-throughput MVP but metrics should highlight saturation.
