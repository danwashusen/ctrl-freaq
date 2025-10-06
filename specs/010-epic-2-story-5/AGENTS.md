# Agent Notes — Section Draft Persistence

- Always add failing Vitest specs in `packages/editor-persistence` and
  `apps/web` before implementation.
- New CLI hooks in `packages/editor-persistence` must expose draft inspection
  (`pnpm --filter @ctrl-freaq/editor-persistence cli draft:list`).
- Do not send draft payloads over the network; tests should guard that
  `compliance.warning` telemetry omits content fields.
- Ensure accessibility snapshots assert visible text labels and ARIA live
  announcements using Playwright accessibility tree assertions.
- Record compliance warnings through `packages/qa` logging helpers so they feed
  existing audit reports.
