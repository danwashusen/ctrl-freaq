---
name: Resolve Dependabot PRs
description:
  Process to resolve open Dependabot PRs using comment commands, CI auto-fixes,
  and PR comment history.
---

# Playbook: Dependabot PRs — Scoped Upgrades with Effort Scoring, CI Auto‑Fix, and PR Comment History

This playbook describes a process to resolve open Dependabot PRs using the
Dependabot comment commands (e.g. `@dependabot rebase`) to trigger Dependabot
actions. After ingesting the entire playbook, follow the steps in the 'Process'
section to handle each open Dependabot PR one at a time **until you have
attempted to resolve all open Dependabot PRs**.

## Process

1. Queue the Dependabot work:
   - `gh pr list --author app/dependabot --state open --sort created --json number,title`
     to confirm the backlog.
   - Tackle the PRs oldest first so upgrades land deterministically.
   - Exclude PRs that have a 'needs-manual-review' or 'help wanted' label.
2. For each PR, work through the following loop before moving on:
   1. Understand the change:
      - Read the current PR description and the first Dependabot comment (they
        update together when metadata changes).
      - Skim the timeline for prior attempts or manual edits.
      - When you need more detail on the dependency update, query the context7
        MCP server.
   2. Sync with the base branch:
      - If the branch is behind run `gh pr update-branch --rebase` and make sure
        it succeeds.
   3. Ensure CI is green:
      - Watch `gh pr checks` until all required checks complete.
      - If CI fails, address the failure (rerun, apply fixes, or leave guidance)
        and document each action in a PR comment using
        `gh pr comment --body-file <note>`.
      - Repeat the fix-and-recheck loop until the checks succeed or you conclude
        the change needs manual intervention.
   4. Perform a documented code review once CI is green:
      - Record the review as a PR comment that covers scope (packages bumped,
        files touched, change size) and risk factors (security patches, breaking
        changes, runtime impact).
   5. Decide on the outcome:
      - If the change is low risk and fully understood, remove the
        `awaiting-review` label, then squash-merge with
        `gh pr merge --squash --delete-branch`.
      - If the risk is unclear or high, note the blockers in a comment, keep the
        PR open, and tag the appropriate owner for human follow-up.

## Dependabot Comment Command Crib Sheet

You can trigger Dependabot actions by commenting on this PR:

- @dependabot rebase will rebase this PR
- @dependabot recreate will recreate this PR, overwriting any edits that have
  been made to it
- @dependabot merge will merge this PR after your CI passes on it
- @dependabot cancel merge will cancel a previously requested merge and block
  automerging
- @dependabot reopen will reopen this PR if it is closed
- @dependabot close will close this PR and stop Dependabot recreating it. You
  can achieve the same result by closing it manually
- @dependabot show <dependency name> ignore conditions will show all of the
  ignore conditions of the specified dependency
- @dependabot ignore this major version will close this PR and stop Dependabot
  creating any more for this major version (unless you reopen the PR or upgrade
  to it yourself)
- @dependabot ignore this minor version will close this PR and stop Dependabot
  creating any more for this minor version (unless you reopen the PR or upgrade
  to it yourself)
- @dependabot ignore this dependency will close this PR and stop Dependabot
  creating any more for this dependency (unless you reopen the PR or upgrade to
  it yourself)

## GitHub CLI Command Crib Sheet

- gh pr create: open PR for current branch; -t/--title, -b/--body,
  -F/--body-file, --fill, -B/--base, -H/--head, -d/--draft, -a/--assignee,
  -r/--reviewer, -l/--label, -p/--project, -m/--milestone, --no-maintainer-edit,
  --dry-run, -w/--web.
- gh pr edit: modify metadata; add/remove assignees (--add-assignee,
  --remove-assignee), reviewers, labels, projects, milestone; change title/body
  (-t, -b, -F); update base (-B).
- gh pr update-branch: sync with base; default merge commit, --rebase for
  rebase.
- gh pr ready / gh pr ready --undo: flip draft/ready state.
- gh pr close: close with optional comment (-c) and branch deletion (-d); gh pr
  reopen reopens with optional comment.
- gh pr merge: complete PR; choose strategy (-m, -s, -r), toggle auto-merge
  (--auto, --disable-auto), guard head (--match-head-commit), delete branch
  (-d), admin bypass (--admin).
- gh pr list: list PRs; filter by --author, --assignee, --base, --head, --label,
  --state, --search, --draft; adjust page size (-L); --json/--template/--jq; -w
  opens web list.
- gh pr status: summarize assigned/authored/relevant PRs; -c shows conflict
  status; supports --json/--template/--jq.
- gh pr view: inspect PR details; add -c for comments, --json/--template/--jq
  for custom output; -w for browser.
- gh pr diff: show diff; --patch, --name-only, --color; -w for browser.
- gh pr checks: CI overview; --watch (with optional --interval), --fail-fast,
  --required, web view (-w), or structured output (--json, --template, --jq).
- gh pr comment: add/edit/delete latest comment; supply body via -b, -F, -e, or
  browser (-w); --edit-last, --delete-last (with --yes), --create-if-none.
- gh pr review: submit review; choose stance -a/--approve, -c/--comment,
  -r/--request-changes; add body via -b/-F.
- gh pr checkout: fetch branch locally; rename (-b), force reset (-f), detach
  (--detach), update submodules (--recurse-submodules).
- gh pr checks, gh pr comment, gh pr review, gh pr diff, gh pr merge, gh pr
  update-branch, gh pr view default to the PR tied to current branch when no
  argument is given.
- gh pr lock / gh pr unlock: restrict conversation; optionally provide reason
  (--reason off_topic|resolved|spam|too_heated).
- gh pr checks, gh pr list, gh pr status, gh pr view share formatting helpers
  (--json, --template, --jq); see gh help formatting.
- Any PR identifier can be number, URL, or head branch (some commands require
  explicit number/URL); specify other repo with -R/--repo HOST/OWNER/REPO.

### Notes

- Make sure the intended formatting is preserved, prefer arguments that allow
  you to provide a file over inline (e.g., when adding comments use the
  `--body-file <FILE_PATH>` argument instead of `--body <BODY>` arg to ensure
  formatting is preserved).
