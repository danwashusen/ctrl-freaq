# Development Workflow

This workflow supplements the standard development implementation process.

## Task Code Quality Gates

- Run the 'bulk apply lint fixes' command for each package that contains changes
  and address any issues found
- Run the 'typecheck a specific package' command for each package that contains
  changes and address any issues found

## Phase Code Quality Gates

- Run the 'bulk apply lint fixes' command and address any issues found
- Run the 'concise global typecheck output' command and address any issues found

## Code Quality Gate Command Crib Sheet

Use these commands to target specific scopes without overwhelming the
implementation transcript:

- `pnpm typecheck -- --pretty false | rg -i 'error'` — concise global typecheck
  output
- `pnpm exec turbo run typecheck --filter=packages/<name>` — typecheck a
  specific package
- `pnpm lint:repo -- --format compact | rg -i 'error|warning'` — lint output
  trimmed to issues
- `pnpm exec turbo run lint --filter=@ctrl-freaq/web` — lint only the web app
  package trimmed to issues
- `pnpm --filter <package> test -- --runInBand` — isolate tests to the impacted
  package
- `pnpm lint:fix` / `pnpm --filter <package> lint -- --fix` — bulk apply lint
  fixes
- `pnpm lint:fix:check` — dry-run lint fixes to capture only what needs
  attention
