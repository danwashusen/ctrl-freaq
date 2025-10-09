# Agent Notes — Conversational Co-Authoring Integration

- Always author failing Vitest specs before implementation: services in
  `apps/api/src/services/co-authoring`, Zustand store in
  `apps/web/src/features/document-editor/stores/co-authoring-store.ts`, and diff
  helpers in `packages/editor-core`.
- CLI parity is required: extend `packages/ai/src/cli.ts` so
  `pnpm --filter @ctrl-freaq/ai cli coauthor` can replay prompts using fixture
  payloads.
- Every provider call must include the entire completed document in the context
  payload; add regression tests ensuring the payload list contains all section
  paths.
- Never persist conversation transcripts beyond the active session; do not add
  database tables for chat history and guard against accidental logging of
  prompt/response text.
- Stream responses with SSE and expose progress events; write Playwright tests
  asserting progress indicator, cancel control, and fallback messaging when the
  provider errors or exceeds the clarified threshold.
- When applying proposals, reuse draft persistence queues and record enriched
  changelog entries; contract tests should verify audit metadata excludes raw
  content.
