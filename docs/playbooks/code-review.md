# Code Review Playbook (S‑Tier)

Perform an S‑tier, non‑destructive code review for a feature, enforcing
constitutional and architectural standards, validating TDD evidence, and
confirming that changes fulfill planned tasks and acceptance criteria where
applicable.

Inputs

- Required: review scope via one of:
  - PR number, or
  - Commit range (e.g., `BASE..HEAD`), or
  - Feature branch to compare against default (merge‑base..HEAD)
- Optional:
  - File filters (globs) to narrow the review
  - `tasks.md` path for task mapping and completion audit
  - Known environment/reproduction notes
  - Baseline branch for dependency audit comparison (default: repository
    default)

Scope Determination

- If PR number provided: use the PR diff.
- Else if commit range provided: use `git diff <range>`.
- Else: compute diff from merge‑base with default branch to `HEAD`.
- If scope cannot be established and none provided: request PR or range and
  STOP.

Early Gates

- Network Access Gate
  - Check the execution environment (CLI context `network_access`, sandbox
    policy, or failed network-dependent commands).
  - If network access is restricted, STOP and warn the requestor: "Network
    access is restricted. This playbook requires full network access to run
    audits, installs, and tests. Please re-run with full access granted."
  - Do not proceed to subsequent gates or quality commands until full network
    access is available; otherwise the review will silently miss critical
    signals.

1. Context Gate
   - When mapping to tasks: verify sibling `plan.md` and `tasks.md` exist and
     feature scopes match.
   - If design docs needed by scope are missing (e.g., `research.md` for
     feature‑specific architecture decisions, `contracts/` for API): set Status:
     "Missing Design Docs" with the missing list. STOP.

2. TDD Evidence Gate
   - Tests added/updated for changed behavior; would have failed
     pre‑implementation (failing test commit or clear rationale). If absent, set
     Status: "TDD Violation". STOP.

3. Quality Controls Protection Gate
   - Do not modify quality‑control configuration files unless explicitly the
     PR’s primary intent with rationale. This includes (non‑exhaustive):
     `eslint.config.*`, `.eslintrc*`, `prettier.config.*`, `.prettierrc*`,
     `.editorconfig`, `tsconfig*.json`, `turbo.json`, `.github/workflows/**`,
     `.yamllint*`, `.husky/**`, and any `lint-staged` config.
   - If violated, set Status: "Quality Controls Violation". STOP.

4. Scope Gate
   - Changes align to declared tasks and plan anchors (if provided). If not, set
     Status: "Scope Mismatch" with examples. STOP.

5. Dependency Safety Gate
   - Run a workspace‑level audit at repo root:
     - `pnpm audit --prod --json` (preferred; respects the lockfile)
     - Optionally, `pnpm -r audit --prod --json` for per‑package detail
   - Establish a baseline from the default branch (or provided baseline):
     - Compare current results against baseline; fail if new vulnerabilities are
       introduced or severity increases (especially High/Critical).
   - Detect deprecated packages introduced by the change:
     - Inspect `pnpm ls -r --json --depth Infinity` for dependencies with a
       `deprecated` flag, or parse deprecation warnings from install logs.
   - Status on failure: "Dependency Vulnerabilities" | "Deprecated
     Dependencies".
   - STOP for Critical/High vulnerabilities. For Moderate/Low, require a
     remediation plan or a time‑boxed exception with rationale.

Review Framework

- Classification categories: Correctness, Security, Performance, Reliability,
  API/Contract, Observability, Testing, Accessibility, Maintainability, Style,
  Supply Chain.
- Evidence & reasoning for each finding:
  - File:line references with short code excerpts
  - Impact analysis and concrete fix plan
  - Map to architecture boundaries (HOW) and spec/plan acceptance criteria
    (WHAT/WHY) to detect scope drift or boundary violations
- Constitution & architecture alignment (enforced):
  - Service Locator only: no globals/singletons; dependencies resolved per
    request via `req.services` or equivalent.
  - Repository Pattern: no persistence in routes/controllers; data access in
    repositories; parameterized queries; transaction wrappers where needed.
  - Boundary validation: schema validation at API interfaces; reject unexpected
    fields; typed handlers.
  - Structured logging: Pino JSON with correlation/requestId propagation; never
    use `console`; redact sensitive data; client‑side logging uses redaction.
  - Error handling: safe error envelopes (no internal leaks), unique error_id,
    tests for error paths.
  - Library‑first: feature logic lives in libraries with CLIs; app layers are
    thin integrators.

Build Quality Signals (non‑gating)

- Always run the workspace quality commands below while executing this playbook.
  If any step fails, continue the review and log the failure as a finding.
  - Lint: `pnpm -w lint`
  - Type check: `pnpm -w typecheck`
  - Build: `pnpm -w build`
  - Tests: `pnpm -w test` (optionally with coverage and/or JSON reporter)
- Capture command output (pass/fail, key warnings) and record failures as
  aggregated findings, creating one remediation task per category (Linting, Type
  Check, Build, Test Failures), rather than per individual issue.
- Deprecation warnings (from test output):
  - Capture and list distinct warning messages observed during test runs (e.g.,
    "React Router Future Flag Warning"); treat as non‑gating signals.
  - Create one remediation task per distinct warning message with concrete steps
    to migrate or configure away the warning; avoid suppressing logs.

Backend Review Checklist (Express 5.1 + better‑sqlite3)

- Routes/controllers thin: validation → service → repository; no raw SQL in
  boundary layers.
- Prepared statements (optionally cached); transactions for multi‑step writes;
  SOC 2 audit fields respected; soft deletes per policy.
- Pino logger injected via DI; requestId propagated; error middleware unified;
  rate limiting present and memory‑safe when configured.
- AuthN/AuthZ (Clerk): JWT verified; RBAC enforced; 401/403 flows tested.
- TypeScript types/interfaces complete; no commented‑out code; lint/typecheck
  clean.

Frontend Review Checklist (React 18 + Vite + shadcn/ui + Tailwind)

- Hooks rules followed; components as pure as practical; immutable state.
- Accessibility: labels/roles/alt text; focus management; role‑based queries in
  tests.
- Performance: lazy routes/code‑splitting; memoization where warranted; avoid
  unnecessary re‑renders.
- Client logging with redaction; no secrets; no `console`.
- RTL tests assert behavior, handle async correctly; new code paths covered.

Security & SOC 2

- AuthN/AuthZ before data access; least privilege default.
- Input validation and sanitization; parameterized queries; XSS mitigation on
  render paths.
- Audit logging for CRUD with user/resource context; request IDs present;
  rate‑limit enforcement and logging.
- Error redaction to clients; detailed server logs with unique `error_id`.
- Supply chain safety:
  - No newly introduced Critical/High vulnerabilities per `pnpm audit`.
  - No newly introduced deprecated packages; if unavoidable, include a
    replacement/upgrade plan.
  - Prefer safe upgrades or replacements over pinning; if pins/overrides are
    used, document rationale and timeframe to remove.

Testing & TDD

- Tests precede implementation for changed behavior; if not, clear rationale.
- Unit, integration, and contract tests added where applicable; error paths
  covered; minimum coverage targets met for new code.
- Contract tests for touched endpoints; client↔server type alignment verified.

Task Mapping & Completion Audit (optional when `tasks.md` provided)

- For each `T###`, perform intent‑based analysis:
  - Determine expected artifacts and behavior
  - Verify presence and completeness via primary/secondary/tertiary signals
  - Classify: ✅ Complete | 🟡 Partial | 🔶 Stub | ❌ Not Started with evidence
- Produce a completion map and overall completion percentage.

Quickstart Verification (optional when `quickstart.md` present)

- Parse verification steps and map scenarios to tests/implementation:
  - Health endpoints, CLI checks, frontend flows, DB operations, build/test
    commands
- Compute coverage. If < 80%, set Status: "Insufficient Quickstart Coverage".
- If no integration tests reference quickstart scenarios, set Status: "Missing
  Quickstart Integration Tests".

Output

- Summary: Approved | Changes Requested | Blocked: Missing Design Docs | TDD
  Violation | Quality Controls Violation | Scope Mismatch | Dependency
  Vulnerabilities | Deprecated Dependencies | Insufficient Quickstart Coverage |
  Missing Quickstart Integration Tests | Review Complete (XX% tasks implemented)
  | Review Pending (no scope).
- Findings: for each → Category, Severity (Critical | Major | Minor), Evidence
  (file:lines + excerpt), Impact, Fix Plan (tests then implementation), Links
  (spec/plan/research anchors).
- Task Completion (if tasks mapped): totals and per‑phase breakdown; completed
  with evidence; incomplete with reasons.
- Quickstart Coverage (if applicable): covered vs missing; recommended tests.
- Strengths: concise positives to preserve.
- Open Questions: remaining items in "[NEEDS CLARIFICATION: …]" format.
- Dependency Audit:
  - Baseline vs current severity counts (Critical/High/Moderate/Low)
  - Newly introduced CVEs/packages with advisories and upgrade paths
  - Deprecated packages introduced and proposed replacements
- Build Quality Signals (non‑gating):
  - Lint: summary of errors/warnings if available
  - Type check: summary of errors if available
  - Tests: pass/fail summary and coverage delta if available
  - Deprecation warnings: list distinct messages with counts and primary source
    (e.g., "React Router Future Flag Warning" from test output)

Write‑Back Behavior (conditional)

- Stay read-only unless the review scope includes changes to a `tasks.md` file.
- When no `tasks.md` diff is present, capture findings in the review without
  modifying files.
- When a `tasks.md` diff is present:
  - Build a draft amendment containing:
    - Updated checkboxes reflecting completion state (preserve original text).
    - A new section
      `## Phase 3.<N>: Code Review Feedback from <YYYY‑MM‑DD HH:MM>` where `<N>`
      is one higher than the current maximum `3.<n>`.
    - Newly numbered tasks continuing from the highest existing `T###` (keep
      zero padding).
    - For each finding, a task entry in the form
      `TXYZ: [Category] Summary — File: path[:line-range]` with:
      - Why: brief impact rationale.
      - Severity: Critical | Major | Minor.
      - Fix: concrete steps, starting with tests, then implementation.
      - Links: relevant specs, architecture anchors, commits/PRs.
    - Dependency remediation tasks when required, covering package upgrades,
      follow-up testing, documentation of pins/overrides, and any needed
      exceptions with expirations.
    - Aggregated quality remediation tasks (one per category) when lint,
      typecheck, test, or other quality signals fail, reusing the acceptance
      criteria below.
    - Deprecation warning remediation tasks (one per distinct warning message)
      including the command emitting the warning and the acceptance condition
      for clearing it.
  - Present the draft to the requestor and ask whether to apply it; include the
    rendered section so they can approve or decline.
  - Apply the write-back only after explicit approval; otherwise leave the file
    untouched and keep the findings summarized in the review notes.
  - When applying, use the same acceptance criteria as before:
    - `TXYZ: [Maintainability] Resolve linting issues (aggregate) — Command: pnpm -w lint`
      - Why: Lint errors reduce maintainability and mask defects.
      - Severity: Major (unless CI-blocking).
      - Fix: Eliminate all ESLint errors across touched workspaces; remove stray
        `console.*`; avoid `eslint-disable` without justification and ticket
        reference.
      - Acceptance: `pnpm -w lint` returns 0 errors; no `.only`/`.skip` in
        tests; no new global disables.
    - `TXYZ: [Correctness] Resolve type check issues (aggregate) — Command: pnpm -w typecheck`
      - Why: Type errors indicate potential runtime failures and contract drift.
      - Severity: Major (Critical if affecting boundary contracts).
      - Fix: Resolve type errors without introducing `// @ts-ignore` salvo;
        prefer precise types; update public types/fixtures as needed.
      - Acceptance: `pnpm -w typecheck` returns 0 errors; no new justified
        `@ts-ignore`.
    - `TXYZ: [Testing] Resolve test failures (aggregate) — Command: pnpm -w test`
      - Why: Failing tests block reliability and conceal regressions.
      - Severity: Critical if core paths fail; Major otherwise.
      - Fix: Repair failing unit/integration/contract tests; update snapshots
        only for intentional behavior changes; remove `.only`/`.skip`; ensure
        coverage meets project thresholds.
      - Acceptance: `pnpm -w test` passes; coverage targets met; no
        `.only`/`.skip`.
    - `TXYZ: [Maintainability] Resolve deprecation warning — <warning source>`
      - Why: Indicates forthcoming breaking change; unresolved warnings add
        noise and risk.
      - Severity: Major (Critical if already breaking flows).
      - Fix: Adopt recommended APIs/configuration or upgrade affected package;
        avoid silencing logs; add a test that exercises the path without
        emitting the warning.
      - Acceptance: Tests and builds run without reproducing the warning.
- If edits are not permitted, emit ready‑to‑apply patch diffs instead.

Important

- Enforce constitutional requirements and architectural boundaries rigorously.
- Provide precise, minimal diffs and tests in proposed fixes.
- Keep reviews non‑destructive unless explicit permission to write back is
  granted.

How To Run (Dependency Safety Gate)

The following commands help generate baseline vs current dependency audit data
and compare them.

Baseline (default branch or chosen baseline)

```
# Replace <BASELINE_BRANCH> with your default branch (e.g., main)
git fetch origin
git checkout <BASELINE_BRANCH>
pnpm install --frozen-lockfile
pnpm audit --prod --json > audit-baseline.json
pnpm ls -r --json --depth Infinity > deps-baseline.json
```

Current (feature branch / HEAD)

```
git checkout -
pnpm install --frozen-lockfile
pnpm audit --prod --json > audit-current.json
pnpm ls -r --json --depth Infinity > deps-current.json
```

Compare results

```
# Raw JSON diff (vulnerabilities)
diff -u audit-baseline.json audit-current.json | less

# Raw JSON diff (dependency tree)
diff -u deps-baseline.json deps-current.json | less

# Quick severity count without jq
rg -o '"severity"\s*:\s*"[a-z]+"' audit-*.json | sort | uniq -c

# Show deprecated entries in current tree
rg -n '"deprecated"' deps-current.json
```

Optional jq helpers (if jq is available)

```
# Summarize deprecated packages
jq -r '.. | objects | select(has("deprecated")) | "\(.name)@\(.version): \(.deprecated)"' deps-current.json | sort -u

# List vulnerabilities by severity (shape may vary by pnpm version)
jq -r '.. | objects | select(has("severity")) | .severity' audit-current.json | sort | uniq -c
```
