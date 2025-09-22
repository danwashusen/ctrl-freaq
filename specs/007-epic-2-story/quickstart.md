# Quickstart: Validating Section Editor & WYSIWYG Capabilities

This guide exercises the planned test suites to confirm rich text editing,
diffing, and approval workflows work end to end.

## Prerequisites

- `pnpm install`
- Test database seeded with sample project, document, and sections
- Clerk test user with section edit and approval permissions

## Step 1: Contract Tests

1. `pnpm test --filter section-editor.contract` (expected RED)
2. Implement API handlers until contract tests pass (GREEN)
3. Refactor while keeping schemas stable (REFACTOR)

## Step 2: Unit Tests

1. Target Milkdown extensions and toolbar state reducers with Vitest
2. Cover autosave debounce, optimistic locking error presentation, and keyboard
   shortcuts

## Step 3: Integration Tests

1. Use Vitest + React Testing Library to mount the section editor feature module
2. Mock API responses to exercise read-only view, edit mode toggling, diff
   display, and conflict banner states
3. Assert accessibility via `axe-core` helper utilities

## Step 4: End-to-End Tests

1. Run Playwright scenario `tests/section-editor/primary.story.ts`
2. Validate user journey: view section → edit → autosave → request review →
   approve with side-by-side diff confirmation

## Step 5: Quality Gates

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm test:contracts`

Document all findings in research.md Phase 3 updates and capture screenshots for
UI regressions.
