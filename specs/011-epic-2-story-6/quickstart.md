# Quickstart — Conversational Co-Authoring Integration

## Prerequisites

- `pnpm install`
- Clerk test user configured (see `/docs/front-end-spec.md`)
- AI provider key exported as `AI_SDK_API_KEY` (OpenAI or compatible via Vercel
  AI SDK)
- Optional: set `COAUTHORING_PROVIDER_MODE=mock` when you need deterministic
  local runs without an AI key (tests default to mock mode automatically)
- Seed architecture fixture loaded
  (`pnpm --filter @ctrl-freaq/templates cli validate specs/011-epic-2-story-6/spec.md`)

## Steps

1. **Launch services**
   - Run `pnpm dev:apps`.
   - Visit http://localhost:5173, sign in as the test author, and open a
     document section with populated content.
2. **Summon the assistant**
   - Open the co-author sidebar from the section editor toolbar.
   - Confirm scope banner lists the active section and selected knowledge
     sources.
3. **Request clarification**
   - Choose the `Explain` intent and ask for a summary of the current section.
   - Verify initial tokens begin streaming in roughly three seconds (95th
     percentile target) and that the progress indicator appears with elapsed
     time + cancel option whenever the response exceeds five seconds.
4. **Generate a proposal**
   - Switch to `Improve` intent, provide a prompt, and request a proposal.
   - Observe diff preview showing added/removed blocks with prompt-linked
     annotations.
   - Inspect developer tools → Network; confirm
     `POST /api/documents/:id/sections/:sectionId/co-author/proposal` payload
     includes `completedSections` metadata.
5. **Approve the proposal**
   - Click `Approve`, edit rationale if needed, and confirm.
   - Ensure draft persistence updates the local patch and a changelog toast
     reports the applied change.
   - Check `/api/projects/:projectSlug/documents/:documentId/changelog` (if
     stubbed) or the console audit log for `coauthor.approved` with proposal
     metadata.
6. **Test rejection & retry**
   - Request another proposal, then reject it. Confirm the diff preview clears
     and conversation history remains for the active session only.
7. **Validate fallback**
   - Temporarily unset `AI_SDK_API_KEY` or force the provider to return a 500
     using DevTools request overrides.
   - Trigger another prompt; ensure the UI surfaces a fallback message, offers
     retry/manual edit guidance, and logs `coauthor.intent` with an error code
     (no transcript text).

## Expected Results

- Assistant scope banner and citations reflect the entire document context.
- Diff previews map each change to the originating prompt and cite document
  decisions.
- Approving a proposal queues the draft save, emits a changelog entry, and logs
  audit metadata without transcript storage.
- Long-running requests display progress + cancel controls; failures fall back
  gracefully without breaking the conversation thread.

## Suggested Verification Commands

- `pnpm --filter @ctrl-freaq/api test -- run co-authoring` (unit + contract
  suites)
- `pnpm --filter @ctrl-freaq/web test -- run co-authoring` (Vitest
  component/store tests)
- `pnpm --filter @ctrl-freaq/web test:e2e:quick --grep "co-author"` (Playwright
  fixture coverage)
- `pnpm lint` / `pnpm typecheck` / `pnpm test` (gauntlet before merging)
