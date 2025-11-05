# Simple Auth Provider Design

This document outlines the changes required to introduce a configurable
authentication provider that supports a multi-user "simple" mode alongside the
existing Clerk integration.

## Overview

- Introduce an `AUTH_PROVIDER` setting with allowed values `simple` (test/local
  default) and `clerk` (production).
- Introduce `SIMPLE_AUTH_USER_FILE` for the path to a YAML file that enumerates
  local users.
- Preserve current Clerk behaviour while enabling a frictionless local login
  experience that allows selecting among multiple predefined users.

## Backend

- Extend configuration plumbing so `AUTH_PROVIDER` and `SIMPLE_AUTH_USER_FILE`
  reach `createDefaultAppConfig`, the service locator, and environment examples.
- Implement `SimpleAuthService` that loads the YAML on startup, validates the
  structure, caches user objects, and exposes helpers to list users and resolve
  a user by ID. Fail fast with descriptive errors when files are missing or
  invalid.
- Provide a `simpleAuthMiddleware` that accepts the service, reads
  `Authorization: Bearer simple:<userId>` tokens, rejects malformed or unknown
  IDs with a 401 response, and populates `req.auth` / `req.user` identically to
  the Clerk middleware.
- Register `/auth/simple` routes before `/api/v1`:
  - `GET /auth/simple/users` returns user metadata for the frontend selector.
  - `POST /auth/simple/logout` (204) allows the UI to clear local state.
- In `createApp`:
  - Instantiate `SimpleAuthService` when the provider is `simple`.
  - Keep `testAuthShim` for test runtimes.
  - Route `/api/v1` requests through Clerk when the provider is `clerk` with
    keys, falling back to the simple middleware otherwise.
  - Run `ensureTestUserMiddleware` both in test mode and when the simple
    provider is active so configured users exist in SQLite.
- Update `ensureTestUserMiddleware` to insert every user emitted by
  `SimpleAuthService`.
- Add unit tests for YAML validation, middleware token parsing, and API routes.
- Add integration tests that boot the app with `AUTH_PROVIDER=simple` and verify
  authenticated access to a protected endpoint using `Bearer simple:<userId>`.

## Frontend

- Create an auth provider selector (`apps/web/src/lib/auth-provider/index.ts`)
  that re-exports the shared surface (`ClerkProvider`, `SignedIn`, `SignedOut`,
  `RedirectToSignIn`, `useAuth`, `useUser`, `UserButton`) while choosing the
  Clerk implementation when `VITE_AUTH_PROVIDER=clerk` and a new simple
  implementation otherwise.
- Refactor imports across the web app (e.g. `App.tsx`, `api-context.tsx`,
  `main.tsx`) to use the selector module.
- Implement `SimpleAuthProvider`:
  - Fetch `/auth/simple/users` on mount and maintain the list in state.
  - Persist the selected user ID in `localStorage`, but handle stale IDs by
    forcing a reselect.
  - Expose `useAuth()` that returns `isSignedIn`, `userId`, `signOut`, and
    `getToken` resolving to `` `simple:${selectedUserId}` ``.
  - Expose `useUser()` returning the selected user's info shaped like Clerk's
    subset (ID, email, optional name and avatar).
  - Render children inside `SignedIn` only when a user is selected; render a
    login screen via `SignedOut` otherwise.
  - Implement `RedirectToSignIn` to toggle the login overlay without navigation.
  - Implement `UserButton` with a "Switch user" action that clears the current
    selection.
- Build `LoginScreen` (e.g.
  `apps/web/src/components/simple-auth/LoginScreen.tsx`) that lists configured
  users with avatars and metadata, lets the user select an identity, and
  displays a warning that simple mode is for local development.
- Update `main.tsx` so Clerk keys are required only when the provider is
  `clerk`.
- Add frontend unit tests covering the simple provider, and adjust existing
  tests and mocks to import from the new selector.

## Configuration & Documentation

- Update `.env.example` and README to surface `AUTH_PROVIDER` and
  `SIMPLE_AUTH_USER_FILE`, defaulting both apps to simple auth for tests.
  Document how to switch providers, describe the login flow, and note local-only
  security expectations.
- Add `templates/simple-auth-user.yaml` as a reference YAML file.
- Create or update developer docs to explain running the stack in simple mode
  and the semantics of the `simple:<userId>` bearer token.

## Configuration Steps

1. Copy `.env.example` to `.env.local` (or `.env`) if you have not already.
2. Set `AUTH_PROVIDER=simple` for local development and automated tests. Switch
   to `AUTH_PROVIDER=clerk` only when validating production parity.
3. When using simple mode, define `SIMPLE_AUTH_USER_FILE` with an absolute or
   workspace-relative path to your YAML file. The API refuses to start if the
   file cannot be read or the schema validation fails.
4. Restart the API after changing providers so the new configuration is picked
   up. The frontend reads `VITE_AUTH_PROVIDER` during build/startup; align
   values between apps.
5. Revert to Clerk by restoring `AUTH_PROVIDER=clerk` and supplying valid Clerk
   keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).

## Switching Providers

Follow these steps whenever you swap authentication modes:

1. Stop the running dev processes (`pnpm dev` or `pnpm dev:apps`).
2. Update both environment files:
   - API: `AUTH_PROVIDER=clerk` or `simple`
   - Web: `VITE_AUTH_PROVIDER=clerk` or `simple`
   - When using simple mode, also set `SIMPLE_AUTH_USER_FILE` in the API env.
     The canonical fixture lives at
     `apps/api/tests/shared/simple-auth/users.yaml`.
3. Run `pnpm install` if new environment files introduce dependency changes.
4. Restart the stack (`pnpm dev`) and confirm the startup warning matches the
   chosen provider.
5. For Clerk mode, verify the publishable and secret keys are present; for
   simple mode, verify the login selector and banner render.

## Troubleshooting

- **API exits immediately:** Check the resolved path printed in the warning and
  ensure the YAML file exists and is readable.
- **`401 Unauthorized` with valid simple token:** Restart the API so the YAML
  changes are recached; the middleware only accepts IDs present in the file.
- **Frontend still requests Clerk keys in simple mode:** Confirm
  `VITE_AUTH_PROVIDER` is set to `simple` and restart Vite—env values are only
  read during startup.
- **Simple banner missing:** Ensure both apps read consistent provider values.
  The banner is controlled entirely by `VITE_AUTH_PROVIDER`.

## Local-Mode Warning Guidance

- The API emits a structured warning on startup whenever `AUTH_PROVIDER=simple`
  so logs clearly indicate the environment is using non-production auth.
- The frontend surfaces a banner when simple mode is active reminding developers
  that simple auth is intended for local workflows only.
- Keep these warnings enabled in every environment; simple mode is intentionally
  loud so accidental production deployments are caught quickly.

## YAML Schema

- Expected file shape:

  ```yaml
  users:
    - id: user_alice
      email: alice@example.com
      first_name: Alice
      last_name: Example
      image_url: ./avatars/alice.png
      org_role: template_manager
      org_permissions:
        - templates:manage
  ```

- Validation rules:
  - `users` must be a non-empty array.
  - Each user must define non-empty `id` and `email`.
  - `org_permissions`, when present, must be an array of strings.
  - User IDs must be unique.

## Testing

- Backend unit tests for `SimpleAuthService`, middleware, and routes.
- Backend integration tests covering authentication flows in simple mode.
- Frontend unit tests verifying the simple auth provider and login screen
  interactions.
- E2E smoke tests that launch with `AUTH_PROVIDER=simple` to ensure the login
  screen appears and selecting a user unlocks the app.

## Migration Notes

- Repository tests now run with `AUTH_PROVIDER=simple` by default. Shared CI
  workflows export the canonical fixture path
  (`apps/api/tests/shared/simple-auth/users.yaml`) to guarantee deterministic
  personas across suites. Update any downstream automation to mirror those env
  variables before invoking `pnpm` commands.
