# Data Model: Simple Auth Provider Mode

## SimpleAuthUser (configuration source)

- **Fields**:
  - `id` (string, required, unique) — canonical identifier used in tokens and
    database seeding.
  - `email` (string, required) — used for display and downstream authorization
    checks.
  - `first_name` (string, optional) — presented in UI when available.
  - `last_name` (string, optional) — presented in UI when available.
  - `image_url` (string URI, optional) — relative or absolute path for avatar
    rendering.
  - `org_role` (string, optional) — maps to existing authorization roles in
    persistence.
  - `org_permissions` (string[], optional) — enumerated permission codes
    forwarded to authorization middleware.
- **Validation Rules**:
  - `id` and `email` must be non-empty strings.
  - `org_permissions`, when present, must be an array of non-empty strings.
  - IDs must be unique across the `users` array.
- **Lifecycle**:
  - Defined in YAML → validated during app bootstrap → cached by
    `SimpleAuthService`.
  - Updates require restarting the API (or explicit reload hook) to refresh the
    cache.

## StoredUser (existing persistence record)

- **Relationship**: Each `SimpleAuthUser` is ensured to exist as a `users` table
  record (via `ensureTestUserMiddleware`).
- **Fields**: Delegates to existing schema (`id`, `email`, `first_name`,
  `last_name`, `avatar_url`, roles/permissions columns, timestamps).
- **Lifecycle**:
  - On simple mode startup, missing records are inserted; existing records are
    patched to match YAML metadata.
  - On logout, no database changes occur (clients clear local state only).

## AuthProviderConfig (runtime configuration)

- **Fields**:
  - `provider` (enum: `clerk` | `simple`, required) — resolved from
    `AUTH_PROVIDER`, defaults to `clerk`.
  - `simpleAuthUserFile` (string path, required when `provider === simple`).
  - `warnOnSimpleUsage` (boolean, default `true`) — drives logging/banner when
    simple mode active.
- **Lifecycle**:
  - Resolved during app bootstrap via configuration loader.
  - Accessed by service locator to instantiate the correct auth middleware
    stack.

## SimpleAuthSession (frontend state)

- **Fields**:
  - `selectedUserId` (string | null) — currently active simple user.
  - `token` (string | null) — generated as `simple:${selectedUserId}` for API
    requests.
  - `expiresAt` (Date | null) — optional TTL for future enhancements; defaults
    to `null` meaning session persists until manual sign-out.
- **Lifecycle**:
  - Initialized from `localStorage` on provider mount.
  - Updated when user selects a different identity or signs out.
  - Cleared on logout, invalid selection, or provider switch.

## SimpleAuthAuditEvent (logging payload)

- **Fields**:
  - `event` (enum: `SIMPLE_MODE_WARNING`, `SIMPLE_LOGIN`, `SIMPLE_LOGOUT`,
    `SIMPLE_TOKEN_REJECTED`).
  - `userId` (string | null) — associated user when applicable.
  - `timestamp` (ISO string) — event capture time.
  - `context` (object) — includes request ID, environment, and reason codes.
- **Lifecycle**:
  - Emitted by API middleware whenever simple mode is activated, users
    authenticate, or invalid tokens arrive.
  - Consumed by existing logging infrastructure for observability.

## Relationships Summary

- `SimpleAuthUser` → `StoredUser`: 1:1 mapping enforced at startup.
- `SimpleAuthUser` → `SimpleAuthSession`: Selected user populates session state;
  session inherits display metadata for UI components.
- `SimpleAuthSession` → API middleware: Token composed from session drives
  authorization for `/api/v1` resources.
- `AuthProviderConfig` influences whether `SimpleAuthService` is constructed and
  whether Clerk middleware is bypassed.
