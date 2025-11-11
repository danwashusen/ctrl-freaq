# Playbook: Post-task quality checklist

This playbook helps confirm a task is integration-ready after implementation.
Ingest the entire playbook, then follow the steps in the 'Process' section
until all steps have been completed.

## Process

1. Run `CI=1 pnpm install` to sync workspace dependencies.
2. Run the `pnpm format` command.
3. Ensure the `pnpm lint:fix` command succeeds, fix any linting errors and warnings.
   - Prefer re-writing code over adding suppressions.
4. Ensure the `pnpm typecheck` command succeeds, fix any errors and warnings.
5. Ensure the `pnpm test` command succeeds, analyze the failures and suggest fixes.
   - The command takes several minutes to complete; plan accordingly.
   - The command generates a lot of output; pipe the output to a file.
6. Prepare a summary of all the previous steps.
