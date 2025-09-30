# Playbook: Dependabot PRs — Scoped Upgrades with Effort Scoring, CI Auto‑Fix, and PR Comment History

Process Dependabot PRs one‑by‑one with **strict scope control**. For each PR:

1. **Assess** the required refactor scope (consult the `context7` MCP server for
   latest API docs),
2. **Score effort** (`low` | `medium` | `high`) and record it in a PR comment
   (machine‑readable),
3. **Only auto‑approve/merge** when the effort score is **`low`** **and** CI is
   green,
4. For `medium`/`high`, document findings, label, and hand‑off for manual
   review.

> Conventions
>
> - Target branch: `main`
> - Merge method: **squash**
> - History tag: `<!-- playbook:dependabot-ci -->`
> - State comment MUST include Markdown data list covering `phase`, `status`,
>   `effortScore?`, and key context.
> - Primary tools: `gh` (GitHub CLI) and Dependabot comment commands
>   (`@dependabot …`).
> - Discovery of API/behavior changes: **consult `context7` MCP server** for
>   authoritative docs.

---

## Prerequisites (one‑time)

1. **Auth & Context**
   - `gh auth status`
   - Work in repo root (or pass `--repo <owner/repo>`).

2. **Set required labels (idempotent)**
   - `blocked`, `needs-manual-review`, `auto-merge-ok`, `dependabot`.

---

## Step 1 — List and Queue Dependabot PRs (open only)

**Run**

```bash
gh pr list --state open --author app/dependabot \
  --json number,title,headRefName,baseRefName,isDraft,mergeable,url
```

**Output Contract**

- Ordered list of PRs: `number`, `url`, `headRefName`, `title`.

**Proceed**

- Process **one PR at a time**, but keep iterating until this list returns no
  results. Re-run the command after each completed PR to refresh the queue.

---

## Step 2 — Establish/Resume Playbook State (Comment‑as‑State)

**Inspect existing state**

```bash
gh pr view <PR> --comments --json comments | jq -r '
  .comments[]
  | select(.body | contains("playbook:dependabot-ci"))
  | [.createdAt, .author.login, .body] | @tsv
'
```

**Comment schema (all phases)**

```text
<!-- playbook:dependabot-ci -->
Phase: <phase-name>               # assessment | rebase | ci | ci-diagnostics | fix-* | approve | merge
Status: <pending|ok|failed|skipped>
EffortScore: <low|medium|high>    # present only for Phase: assessment
Detail: <one-line summary>
Data:
- Key: Value                      # primary key-value pairs
- Highlights:
  - key insight 1
  - key insight 2
```

> Tip: Build multi-line comments with `--body-file` here-docs and escape the
> Markdown sequences (```text, nested bullets) so Bash does not interpret them
> as command substitution. Indent nested list items with two spaces for
> consistent rendering.

Resume from latest comment if present.

---

## Step 3 — Assessment & Effort Scoring (Scope Gate)

**Goal**

- Determine if upgrade is _trivial (`low`)_ or needs broader refactor
  (`medium`/`high`).

**Inputs**

- Diff of PR (deps changed, lockfile changes).
- Release notes / changelog / migration guide for the bumped dependency.
- **`context7` MCP server**: query latest API docs and breaking change
  advisories.
  - Example (pseudocode; adapt to your MCP client):
    - `context7.apidocs.search(packageName, versionRange)`
    - `context7.apidocs.changelog(packageName, from=oldVersion, to=newVersion)`
    - `context7.apidocs.migrations(packageName, to=newVersion)`

**Heuristic rubric**

- **LOW**: version pin bumps only (package.json/lockfile/config) where release
  notes call out no breaking API or migration work. This includes ecosystem
  suites (e.g. Milkdown plugins/themes like PR #36) when no repo code must
  change, even if the new package advertises newer peer versions. Expect CI to
  stay green after a rebase.
- **MEDIUM**: minor API or types changes that require local shims/test updates,
  or cases where we must touch source/test files but work remains mechanical and
  scoped.
- **HIGH**: breaking API/behavior changes requiring non-trivial refactors;
  multi-module impact; runtime semantics or security-sensitive areas.

**Record assessment**

```bash
HIGHLIGHTS=$(jq -r '.[] | "  - " + .' <<'EOF'
["..."]
EOF
)

cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: assessment
Status: ok
EffortScore: <low|medium|high>
Detail: assessed upgrade scope via context7 + changelog
Data:
- Package: <name>
- From: <x.y.z>
- To: <a.b.c>
- Highlights:
$HIGHLIGHTS
EOF
```

**Gate**

- If **EffortScore ≠ `low`** → **do not auto‑approve/merge**. Proceed to Step 4
  (update/CI) to validate status, but end in **manual hand‑off**.

---

## Step 4 — Ensure Branch is Up to Date

**Preferred**

```bash
gh pr comment <PR> --body "@dependabot rebase"
```

**Fallback**

```bash
gh pr update-branch <PR>
```

**State**

```bash
cat <<'EOF' | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: rebase
Status: pending
Detail: requested rebase/update-branch
Data:
- Requested by: <operator>
- Command: @dependabot rebase
EOF
```

---

## Step 5 — Trigger/Monitor CI

**Annotate start**

```bash
HEAD_SHA=$(gh pr view <PR> --json headRefOid -q .headRefOid)
cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: ci
Status: pending
Detail: waiting for checks on $HEAD_SHA
Data:
- Head SHA: $HEAD_SHA
EOF
```

**Watch to terminal state (success/failure)**

- Poll `statusCheckRollup` until all required checks complete.

**On success**

```bash
CHECK_LINES=$(gh pr view <PR> --json statusCheckRollup \
  -q '.statusCheckRollup | map(
    "  - " + (.name // .context)
    + ": " + (.conclusion // .state)
    + (if .workflowName then " [" + .workflowName + "]" else "" end)
    + (if .detailsUrl then " (" + .detailsUrl + ")" else "" end)
  ) | join("\n")')
cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: ci
Status: ok
Detail: all required checks passed
Data:
- Head SHA: $HEAD_SHA
- Checks:
$CHECK_LINES
EOF
```

**On failure → Step 6 (Diagnostics & First‑Aid)**

---

## Step 6 — CI Failure Diagnostics & Conservative First‑Aid

**Snapshot diagnostics**

```bash
CHECK_LINES=$(gh pr view <PR> --json statusCheckRollup \
  -q '.statusCheckRollup | map(
    "  - " + (.name // .context)
    + ": " + (.conclusion // .state)
    + (if .detailsUrl then " (" + .detailsUrl + ")" else "" end)
  ) | join("\n")')

cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: ci-diagnostics
Status: pending
Detail: collected statusCheckRollup details
Data:
- Checks:
$CHECK_LINES
EOF
```

**Heuristics (conservative only)**

- Lint/format → run fixer; commit minimal changes.
- Lockfile issues → refresh lockfile only.
- Snapshot/test flake → update snapshots; no prod code changes.
- Transient infra → rerun failed jobs.

**After any fix**

- Comment phase `fix-*` with outcome and return to **Step 5**.

**If risky/non‑trivial**

- Label and hand‑off:

```bash
gh pr edit <PR> --add-label needs-manual-review,blocked
cat <<'EOF' | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: ci-diagnostics
Status: failed
Detail: requires manual refactor; auto-fix out of scope
Data:
- Next action: manual-review
EOF
```

---

## Step 7 — Approval & Merge (Guarded by Effort Score)

**Pre‑conditions**

- Latest assessment comment shows `EffortScore: low`.
- CI phase is `ok`.

**Approve & auto‑merge (squash)**

```bash
gh pr review <PR> --approve --body "LGTM — low-effort Dependabot upgrade after green CI [playbook]"
gh pr merge  <PR> --squash --delete-branch --auto
gh pr edit   <PR> --add-label auto-merge-ok
cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: approve
Status: ok
Detail: approved (low effort) and enabled auto-merge
Data:
- Head SHA: $HEAD_SHA
- Review: LGTM — low-effort Dependabot upgrade after green CI [playbook]
- Labels:
  - auto-merge-ok
EOF
```

**If EffortScore is `medium` or `high`**

- **Do not approve**. Ensure labels and hand‑off note:

```bash
gh pr edit <PR> --add-label needs-manual-review
cat <<'EOF' | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: approve
Status: skipped
Detail: effortScore not low; awaiting manual review
Data:
- Labels:
  - needs-manual-review
- Reason: effort>low
EOF
```

---

## Step 8 — Verify Merge or Park

**Merged path**

- Poll until merged; final comment:

```bash
MERGED_AT=$(gh pr view <PR> --json mergedAt -q .mergedAt)
cat <<EOF | gh pr comment <PR> --body-file -
<!-- playbook:dependabot-ci -->
Phase: merge
Status: ok
Detail: PR merged via squash and branch deleted
Data:
- Merged at: $MERGED_AT
EOF
```

**Manual path**

- For `medium`/`high`, ensure actionable summary exists in the assessment
  comment and CI diagnostics; assign reviewers/owners as needed.

---

## Step 9 — Iterate

- Re-run the Step 1 listing command. If any Dependabot PRs remain, pick the next
  entry and resume from **Step 2**. Stop only when the list is empty.

---

## Effort Scoring Reference (Quick Rubric)

- **LOW** — Config/lockfile only, no API changes, no prod code edits, trivial
  lint/snapshot adjustments at most.
- **MEDIUM** — Minor code edits limited to tests/types/shims; narrow blast
  radius; no behavioral changes.
- **HIGH** — Breaking API or runtime behavior changes; broad refactor;
  security‑sensitive code paths.

---

## Quick Commands (crib)

- Rebase: `@dependabot rebase`
- Recreate: `@dependabot recreate`
- Approve (guarded): `gh pr review <PR> --approve`
- Merge (auto): `gh pr merge <PR> --squash --delete-branch --auto`
- CI status: `gh pr view <PR> --json statusCheckRollup`
- Rerun jobs: `gh run rerun <run-id>`
- Labels: `needs-manual-review`, `blocked`, `auto-merge-ok`
