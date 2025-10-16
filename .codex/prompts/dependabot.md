# Playbook: Dependabot PRs — Scoped Upgrades with Effort Scoring, CI Auto‑Fix, and PR Comment History

This playbook describes a process to resolve open Dependabot PRs using the Dependabot comment commands
(e.g. `@dependabot rebase`) to trigger Dependabot actions.

## Notes

- Use the Dependabot comment commands (e.g. `@dependabot rebase`) to trigger Dependabot actions, prefer those over
  GitHub CLI commands.

## Process

- Use the Github CLI to list open Dependabot PRs (e.g., authored by 'apps/dependabot'), oldest first.
- Process each PR one at a time, in order. For each PR:
   - Read the PR description and comments to understand the context of the PR.
   - Extract the "compatibility score" from the PR description as a percentage.
   - Make sure the PR is up to date with the base branch.
   - Make sure the PR is passing CI, waiting for the CI to complete if it is not.
   - If the PR is not passing CI, fix any issues in a loop until CI reports green and record your activity as comments on the PR.
   - If the PR has a compatability score greater than or equal to 75% and CI is reporting green, squash and merge the PR.
- For each PR, read the Dependabot comment history to understand the context of the PR.

## Dependabot Comment Command Crib Sheet

You can trigger Dependabot actions by commenting on this PR:

- @dependabot rebase will rebase this PR
- @dependabot recreate will recreate this PR, overwriting any edits that have been made to it
- @dependabot merge will merge this PR after your CI passes on it
- @dependabot squash and merge will squash and merge this PR after your CI passes on it
- @dependabot cancel merge will cancel a previously requested merge and block automerging
- @dependabot reopen will reopen this PR if it is closed
- @dependabot close will close this PR and stop Dependabot recreating it. You can achieve the same result by closing it manually
- @dependabot show <dependency name> ignore conditions will show all of the ignore conditions of the specified dependency
- @dependabot ignore this major version will close this PR and stop Dependabot creating any more for this major version (unless you reopen the PR or upgrade to it yourself)
- @dependabot ignore this minor version will close this PR and stop Dependabot creating any more for this minor version (unless you reopen the PR or upgrade to it yourself)
- @dependabot ignore this dependency will close this PR and stop Dependabot creating any more for this dependency (unless you reopen the PR or upgrade to it yourself)
