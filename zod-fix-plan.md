# Zod v4 Error Refactor Plan

- [✅] Inventory all `ZodError.errors` usages and capture required response
  shapes.
- [✅] Update `apps/api/src/core/errors.ts` to read `error.issues`. Preserve the
  `ValidationErrorDetail` shape and keep raw issues in context.
- [✅] Audit API helpers/routes for any direct `error.errors` usage and migrate
  to `error.issues`, including log payloads and response details.
- [✅] Update template validators to build string messages from `error.issues`.
- [✅] Update `packages/templates/src/parsers/index.ts` to surface
  `error.issues` while preserving the current error message format.
- [✅] Update `packages/editor-core/src/patch-engine.ts` to collect messages via
  `error.issues` when validating patches.
- [✅] Update documentation references to the Zod version within `./docs/**` to
  reflect the new API terminology.
- [✅] Review downstream consumers (CLI, web services) to confirm they still
  receive the same string arrays and adjust typings or mocks as needed.
- [✅] Update or add unit tests that cover the new `error.issues` flow across
  the API validation, template validators, and patch engine paths.
- [✅] Run targeted package tests: `pnpm --filter @ctrl-freaq/api test`,
  `pnpm --filter @ctrl-freaq/templates test`, and
  `pnpm --filter @ctrl-freaq/editor-core test`.
- [✅] Run workspace quality gates impacted by the change: `pnpm lint` and
  `pnpm typecheck`.
- [✅] Run the full gauntlet `pnpm test` before reporting the work complete.
