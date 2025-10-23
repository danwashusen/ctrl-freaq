# Quickstart: Simple Auth Provider Mode

## Prerequisites

- Node.js 20.x and pnpm installed per repository guidelines.
- Clerk credentials on hand if you plan to switch back after testing.
- A YAML file matching `docs/examples/simple-auth-users.yaml` with at least one
  user entry. Copy that file to `./local/simple-auth-users.yaml` (or any path)
  and adjust as needed.

## Configure the Environment

1. Copy `.env.example` to `.env.local` if you have not already.
2. Add the following entries:
   ```dotenv
   AUTH_PROVIDER=simple
   SIMPLE_AUTH_USER_FILE=./local/simple-auth-users.yaml
   ```
3. Place your YAML file at the referenced path. Use relative paths from the
   workspace root or provide an absolute path.

## Run the Stack

1. Install dependencies if necessary: `pnpm install`.
2. Start the backend and frontend: `pnpm dev` (or `pnpm dev:apps` for web/api
   only).
3. Watch the API logs. On startup you should see a single structured warning
   indicating simple auth mode is active, the configured user count, and which
   YAML file was loaded.

## Sign In with Simple Auth

1. Visit the web app (`http://localhost:5173`).
2. The simple auth login screen lists users from your YAML file and surfaces an
   in-app banner reminding you that this flow is for local development.
3. Select a user. The app unlocks protected routes and uses `simple:<userId>`
   tokens for API calls. Keyboard users can tab through each card; the selected
   state is announced via ARIA.
4. Use the header user menu to switch accounts or sign out, which clears the
   stored selection and calls `POST /auth/simple/logout`.

## Validate API Access

- Use a REST client or curl:
  ```bash
  curl -H "Authorization: Bearer simple:user_alice" \
    http://localhost:5001/api/v1/projects
  ```
- Requests with malformed or unknown IDs should return `401 Unauthorized`.
- Inspect available identities directly:
  ```bash
  curl http://localhost:5001/auth/simple/users | jq
  ```
  The payload should mirror the YAML contents after validation.

## Verification Checklist

Run these commands before capturing PR evidence. Each command should exit
successfully.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ctrl-freaq/web test:e2e:quick
```

## Switch Back to Clerk

1. Stop running services.
2. Update `.env.local`:
   ```dotenv
   AUTH_PROVIDER=clerk
   CLERK_PUBLISHABLE_KEY=...
   CLERK_SECRET_KEY=...
   ```
3. Restart with `pnpm dev`. Confirm the Clerk sign-in flow renders and no
   simple-mode warnings remain.

## Troubleshooting

- **Missing YAML file**: API fails fast with descriptive error; verify the path
  and permissions.
- **Duplicate IDs**: Update the YAML to ensure each `id` is unique, then restart
  the API.
- **Stale selections**: Clear browser storage or use the "Switch user" action to
  reset the local state.
- **No warning in logs**: Confirm `AUTH_PROVIDER` truly resolves to `simple`;
  the warning emits on every boot.
