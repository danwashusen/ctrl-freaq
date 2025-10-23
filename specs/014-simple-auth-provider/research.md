# Research Findings

## Simple Auth YAML Loading and Validation

- Decision: Use `js-yaml` to parse the user file and validate the resulting
  objects with existing Zod schemas dedicated to `SimpleAuthUser` definitions.
- Rationale: `js-yaml` already ships in the workspace, interops with TypeScript
  typings, and Zod gives consistent validation/error messages that align with
  API boundary practices.
- Alternatives considered: The `yaml` package (lacks existing typings in repo);
  hand-written parsing (error-prone, duplicates validation logic).

## Persisting Simple Users in Local Datastore

- Decision: Extend `ensureTestUserMiddleware` to call a new
  `SimpleAuthService.listUsers()` helper and upsert each user into SQLite via
  the existing user repository before protected routes execute.
- Rationale: Reuses established middleware flow, keeps persistence in sync on
  each boot, and avoids introducing one-off seed scripts.
- Alternatives considered: Separate CLI seed command (adds extra step for
  developers); direct SQL migrations (tightly couples YAML changes to schema
  deployments).

## Frontend Provider Selector Strategy

- Decision: Introduce `apps/web/src/lib/auth-provider/index.ts` that exports the
  Clerk surface by default but switches to `SimpleAuthProvider` when
  `VITE_AUTH_PROVIDER` is `simple`; the simple provider caches the selected user
  in `localStorage` and supplies `simple:<userId>` tokens via a shared context.
- Rationale: Centralizes all auth imports, prevents widespread refactors, and
  lets the UI match Clerk ergonomics while remaining easily testable.
- Alternatives considered: Individual component toggles (error-prone and
  repetitive); feature flag hooks (would still require many call sites to change
  directly).

## Warning Signal for Simple Mode

- Decision: Emit a structured log warning (and optional UI banner) whenever
  `AUTH_PROVIDER` resolves to `simple`, regardless of environment, so production
  deployments are still alerted.
- Rationale: Matches clarification guidance, avoids brittle environment
  heuristics, and ensures observability pipelines capture the warning without
  suppressing simple mode in CI demos.
- Alternatives considered: Tying warnings to `NODE_ENV` (fragile, misses custom
  env names); requiring a separate override flag (extra configuration friction).

## System Context

- Simple auth mode runs alongside the existing Clerk integration inside
  `apps/api` and `apps/web`, toggled solely by environment variables
  (`AUTH_PROVIDER`, `SIMPLE_AUTH_USER_FILE`).
- Local developers operate both services via `pnpm dev`, with the API bound to
  port 5001 and the web app to 5173; SQLite persists user records accessible
  through `ensureTestUserMiddleware`.
- Logging infrastructure uses structured JSON via existing middleware, making it
  straightforward to surface warnings in log streams (stdout) consumed by dev
  tooling.
- Contract tests execute under `pnpm --filter @ctrl-freaq/api test`, while UI
  verification relies on Vitest and Playwright fixtures in `apps/web/tests`.

## Codebase Summary

- Backend auth modules live in `apps/api/src/modules/auth/` with middleware
  exported through `apps/api/src/middleware/`; service locator wiring occurs in
  `apps/api/src/createApp.ts`.
- Configuration helpers are defined under `apps/api/src/config/` and shared
  environment declarations often reference `.env.example` plus typed config
  objects in `packages/shared-data`.
- Frontend auth interactions are centralized via `apps/web/src/lib/` and
  environment handling in `apps/web/src/main.tsx`; new components should nest
  under `apps/web/src/components/`.
- Testing patterns: backend unit tests in `apps/api/tests/unit/`, contract tests
  in `apps/api/tests/contract/`; frontend unit tests colocated next to source
  files with `.test.tsx`, and Playwright fixture tests under
  `apps/web/tests/e2e/`.
