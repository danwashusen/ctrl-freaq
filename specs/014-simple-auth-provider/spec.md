# Feature Specification: Simple Auth Provider Mode

**Feature Branch**: `[014-simple-auth-provider]`  
**Created**: 2025-10-20  
**Status**: Draft  
**Input**: User description: "docs/simple-auth.md – Simple Auth Provider Design"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select a Local Test User (Priority: P1)

Local developers running the stack in simple mode need to pick from a list of
predefined accounts so they can access protected product areas without external
auth dependencies.

**Why this priority**: Without a frictionless sign-in path, local work is
blocked; enabling selection of a valid user is the core objective of the
feature.

**Independent Test**: Launch the web app with the simple provider configured,
confirm the login screen lists configured users, choose a user, and verify
protected pages render with that user's identity.

**Acceptance Scenarios**:

1. **Given** the environment is set to use the simple auth provider and a valid
   user YAML is present, **When** the developer selects a user from the login
   screen, **Then** the app grants authenticated access and surfaces the
   selected user's profile.
2. **Given** the environment is set to simple mode but no user has been
   selected, **When** the developer navigates the app, **Then** protected views
   remain gated behind the login overlay until a valid selection is made.

---

### User Story 2 - Exchange Simple Tokens for API Access (Priority: P2)

Backend services must recognize `simple:<userId>` bearer tokens so developers
can exercise authenticated API flows without Clerk.

**Why this priority**: The backend must trust the same identity as the frontend;
otherwise local testing fails even if the UI shows a signed-in user.

**Independent Test**: Start the API in simple mode, issue a request with
`Authorization: Bearer simple:<knownUserId>`, and validate the response succeeds
while malformed or unknown IDs are rejected.

**Acceptance Scenarios**:

1. **Given** the API is running with the simple auth provider, **When** a
   request supplies `Authorization: Bearer simple:<configuredUserId>`, **Then**
   the request succeeds and the user context matches the configured profile.
2. **Given** the API is running with the simple auth provider, **When** a
   request supplies a malformed or unknown `simple:` token, **Then** the request
   is rejected with an unauthorized response and no user context is attached.

---

### User Story 3 - Switch Between Auth Providers (Priority: P3)

Team members occasionally need to revert to Clerk for parity checks or demos, so
switching providers must be controlled via configuration with clear
documentation.

**Why this priority**: Auth selection should never require code edits;
config-driven switching keeps local and shared environments reliable.

**Independent Test**: Update environment variables to toggle between simple and
Clerk providers, restart services, and verify each mode behaves as documented
without manual code changes.

**Acceptance Scenarios**:

1. **Given** the stack is using the simple provider, **When** the team updates
   configuration to `AUTH_PROVIDER=clerk` with valid Clerk credentials, **Then**
   the system resumes Clerk login flows without residual simple-mode UI.
2. **Given** the stack is using Clerk, **When** the team sets
   `AUTH_PROVIDER=simple` and points to a valid user file, **Then** the simple
   login screen appears and Clerk-specific requirements (like API keys) are no
   longer mandatory.

### Edge Cases

- Missing or unreadable simple user files must surface a startup error with
  guidance instead of booting into a broken state.
- Duplicate user IDs in the YAML should be detected and reported before serving
  the login screen.
- Previously selected user IDs stored locally must be revalidated on load; stale
  selections should trigger a prompt to choose again.
- Requests that present a `simple:` token while Clerk mode is active must still
  be rejected to prevent accidental bypass.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The platform MUST accept an `AUTH_PROVIDER` configuration value
  limited to `clerk` or `simple`, defaulting to Clerk when unspecified.
- **FR-002**: When `AUTH_PROVIDER=simple`, the platform MUST require
  `SIMPLE_AUTH_USER_FILE` to reference a readable YAML file describing at least
  one user and refuse to start when validation fails.
- **FR-003**: Simple-mode user files MUST enforce unique, non-empty `id` and
  `email` fields per user and reject entries with invalid or duplicate
  identifiers.
- **FR-004**: When simple mode is active, the backend MUST expose an
  authenticated user listing endpoint that returns every configured user's
  metadata needed by the frontend selector (ID, email, optional profile fields).
- **FR-005**: In simple mode, the backend MUST interpret
  `Authorization: Bearer simple:<userId>` tokens, reject malformed or unknown
  values with unauthorized responses, and attach matching user context to
  downstream handlers.
- **FR-006**: The backend MUST seed or verify the presence of every simple-mode
  user within local persistence so downstream features depending on user records
  function without manual setup.
- **FR-007**: When simple mode is active, the backend MUST provide a logout
  interaction that clears client state without affecting other sessions.
- **FR-008**: The frontend MUST centralize auth imports behind a provider
  selector so the same components (`SignedIn`, `useAuth`, etc.) resolve to Clerk
  or simple implementations based on configuration.
- **FR-009**: In simple mode, the frontend MUST fetch the configured user list
  on load, display a login screen to choose a user, and block protected views
  until a valid selection is made.
- **FR-010**: The simple auth frontend experience MUST persist the selected user
  locally, supply `simple:<userId>` tokens for API requests, and offer a visible
  switch-user control.
- **FR-011**: Switching between providers MUST only require updating documented
  environment variables and (for Clerk) supplying key material; no code changes
  or rebuild-only steps can be necessary beyond standard restarts.
- **FR-012**: Documentation and example assets MUST guide developers through
  simple-mode setup, including a reference user YAML and updates to environment
  examples.
- **FR-013**: Whenever simple mode is active, the platform MUST emit a prominent
  warning explaining that simple auth is intended for non-production usage.

### Key Entities _(include if feature involves data)_

- **SimpleAuthUser**: Represents a predefined local identity with fields for ID,
  email, first/last name, display image, and optional organization metadata;
  must be unique per ID and provide enough information for UI display and
  authorization checks.
- **AuthProviderConfig**: Captures the active provider selection, required
  environment inputs, and derived settings consumed by both backend services and
  the frontend so they stay in sync during runtime.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With a valid simple user file, developers can launch the stack,
  select a user, and reach the dashboard within 60 seconds without third-party
  auth dependencies.
- **SC-002**: 100% of API requests that present valid `simple:<userId>` tokens
  succeed against protected endpoints in simple mode, while invalid tokens are
  rejected with standardized unauthorized responses.
- **SC-003**: At least 90% of simple-mode login attempts succeed on the first
  try during QA dry runs, demonstrating that stale or misconfigured user
  selections are gracefully recovered.
- **SC-004**: Switching between simple and Clerk providers, including updating
  environment variables and restarting services, can be completed in under 5
  minutes following the documented procedure.

## Assumptions

- Simple mode always surfaces a conspicuous warning so operators understand it
  is intended for non-production convenience even if launched in production
  environments.
- Local storage is an acceptable mechanism for persisting the selected
  simple-mode user between sessions.
- Existing authorization and role checks can map to the metadata provided in the
  simple user YAML without additional schema changes.

## Clarifications

### Session 2025-10-20

- Q: Should the simple auth provider be restricted in production environments? →
  A: Allow simple auth everywhere but emit an explicit warning in production.
- Q: What runtime signal should we use to detect “production” for simple-mode
  warnings? → A: Log warning when simple.
