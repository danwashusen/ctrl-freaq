`# Code Review Playbook (S-Tier, Scope-Driven)

Run an S-tier, non-destructive review for any caller-defined scope (module
audit, subsystem sweep, repo health check) while enforcing CTRL FreaQ
constitutional standards.

## Constitutional Foundations (MANDATORY)

1. Read and internalize `CONSTITUTION.md` and `docs/architecture.md` before
   evaluating code.
2. If the scope includes any UI or frontend paths, also study
   `docs/ui-architecture.md` and `docs/front-end-spec.md`.
3. Treat these documents as authoritative. Call out any deviations with explicit
   justification.

## Inputs

- **Required**: Human-language scope description (e.g. `package exporter`,
  `entire backend`, `full codebase`,
  `file apps/api/src/services/template-upgrade.service.ts`).
- **Optional**: PR number, commit range, or branch (for diff context);
  supporting docs (plan/spec/tasks/research/quickstart); focus questions; risk
  register; baseline branch/tag for historical comparison (default `main`).

## Scope Resolution

1. Normalize the description into concrete paths (e.g. `full codebase` →
   repository root, `package exporter` → `packages/exporter/**/*`).
2. Union multiple hints if provided; log the resolved scope.
3. Use diff hints when available (`git diff <hint> -- <paths>`); otherwise
   inspect current `HEAD`.
4. If the scope cannot be resolved (missing paths, ambiguous intent), pause and
   request clarification.

## Environment & Network Gate

- Record sandbox mode, network access, and approval policy before running
  commands.
- If any required command is blocked (installs, audits, tests), STOP and request
  elevation.
- When network access is restricted, STOP: "Network access is restricted. This
  playbook requires full network access to run audits, installs, and tests.
  Please re-run with full access granted."

## Context Gate

- Verify that supporting design docs referenced by the request exist. Missing
  critical context → Status: "Blocked: Missing Design Docs" (STOP).
- If docs exist but do not cover the scope, note the gap and proceed with
  reduced confidence.

## TDD Evidence Gate

- Confirm that each behavioral change is backed by tests that would have failed
  pre-implementation (failing test commit or clear rationale).
- Missing or insufficient evidence → Status: "TDD Violation" (STOP until author
  supplies proof or remediation plan).

## Quality Controls Protection Gate

- Ensure guardrail configuration files (`eslint.config.*`, `.editorconfig`,
  `tsconfig*.json`, `.github/workflows/**`, `.yamllint*`, `.husky/**`, etc.) are
  untouched unless the scope explicitly targets them with rationale.
- Unauthorized changes → Status: "Quality Controls Violation" (STOP).

## Safety Gate

- Assess whether excluding adjacent modules or tests undermines confidence. Flag
  residual risk when appropriate and expand scope if needed.

## Dependency Safety Gate

1. Establish a baseline on the default branch (or provided baseline):
   ```bash
   pnpm install --frozen-lockfile
   pnpm audit --prod --json > audit-baseline.json
   pnpm ls -r --json --depth Infinity > deps-baseline.json
   ```
2. Capture the current state on the working tree:
   ```bash
   pnpm install --frozen-lockfile
   pnpm audit --prod --json > audit-current.json
   pnpm ls -r --json --depth Infinity > deps-current.json
   ```
3. Compare results and STOP on:

- Newly introduced Critical/High vulnerabilities (Status: "Dependency
  Vulnerabilities").
- Newly introduced deprecated packages without mitigation (Status: "Deprecated
  Dependencies").

4. Require remediation plans or time-boxed exceptions for Moderate/Low issues.
5. For each newly introduced dependency, document justification, maintenance
   quality, transitive footprint, and version currency
   (`npm view <package> version`).

### Command Reference

Use these helpers when analyzing dependency diffs:

```bash
# Raw JSON diff (vulnerabilities)
diff -u audit-baseline.json audit-current.json | less

# Raw JSON diff (dependency tree)
diff -u deps-baseline.json deps-current.json | less

# Quick severity count without jq
rg -o '"severity"\s*:\s*"[a-z]+"' audit-*.json | sort | uniq -c

# Show deprecated entries in current tree
rg -n '"deprecated"' deps-current.json
```

Optional `jq` helpers:

```bash
jq -r '.. | objects | select(has("deprecated")) | "\(.name)@\(.version): \(.deprecated)"' deps-current.json | sort -u
jq -r '.. | objects | select(has("severity")) | .severity' audit-current.json | sort | uniq -c
```

## Quality Commands (REPO-WIDE, REQUIRED)

Run from the repository root. Report pass/fail and key diagnostics; do not scope
these commands down.

```bash
pnpm -w lint
pnpm -w typecheck
pnpm -w build
pnpm -w test
```

## Review Framework

Analyze all files in scope, reading supporting modules as needed. Classify
findings under:

- Correctness, Security, Performance, Reliability, API/Contract
- Observability, Testing, Accessibility, Maintainability, Style, Supply Chain

Each finding must include:

1. Category and Severity (Critical | Major | Minor)
2. Confidence level (High | Medium | Low)
3. Evidence (path:line + succinct excerpt)
4. Impact analysis
5. Fix plan (tests first, then implementation steps)
6. Links to specs/tasks/docs/history where relevant
7. Note any deviation from the constitution or architecture and explain the root
   cause.

### Constitutional Enforcement Checklist

Confirm the following for in-scope changes:

- Service Locator only: no globals/singletons; dependencies resolved per request
  via `req.services` (or equivalent).
- Repository Pattern: no persistence logic in routes/controllers; data access
  sits in repositories with parameterized queries and appropriate transactions.
- Boundary validation: schema validation at API edges; reject unexpected fields;
  maintain typed handlers.
- Structured logging: Pino JSON with correlation/request IDs; never use
  `console`; redact sensitive data; client logging follows the same rules.
- Error handling: safe error envelopes, unique `error_id`, and tests for error
  paths.
- Library-first architecture: business logic resides in libraries with CLI entry
  points; app layers remain thin integrators.

## Scope-Specific Checklists (Apply When Relevant)

### Backend Service Checklist (Express 5.x + better-sqlite3)

- Routes/controllers stay thin: validation → service → repository; no raw SQL in
  boundary layers.
- Prepared statements (optionally cached); transactions for multi-step writes;
  SOC 2 audit fields respected; soft deletes per policy.
- Pino logger injected via dependency injection; `requestId` propagated; error
  middleware unified; rate limiting present and memory-safe when configured.
- AuthN/AuthZ (Clerk): JWT verified; RBAC enforced; 401/403 flows tested.
- TypeScript surfaces are sound; no commented-out code; lint/typecheck pass.

### Frontend Feature Checklist (React 18 + Vite + shadcn/ui + Tailwind)

- Hooks rules followed; components remain as pure/isolated as practical;
  immutable state updates.
- Accessibility: labels/roles/alt text; focus management; queries in tests
  prefer accessible roles.
- Performance: lazy routes or code-splitting where warranted; memoization
  applied thoughtfully; avoid unnecessary re-renders.
- Client logging redacts sensitive data; no secrets; no `console` usage.
- RTL tests assert behavior, handle async correctly, and cover new code paths.

### Security & SOC 2 Checklist

- AuthN/AuthZ enforced before data access; least-privilege defaults.
- Input validation and sanitization; parameterized queries; XSS mitigations on
  render paths.
- Audit logging for CRUD with user/resource context; request IDs present; rate
  limiting enforced and logged.
- Error responses redact internals; server logs include unique `error_id`.
- Supply chain safety: no new Critical/High vulnerabilities; deprecated packages
  carry mitigation plans; avoid indefinite pins/overrides without rationale and
  expiry.

## Testing Expectations

- Tests precede implementation for behavioral changes or include rationale for
  exceptions.
- Unit, integration, and contract tests exist where applicable; error paths are
  covered; minimum coverage targets met for new code.
- Contract tests confirm client↔server type alignment for touched endpoints or
  APIs.
- Highlight regression risks when coverage gaps exist and recommend specific
  tests.
- Capture distinct runtime deprecation warnings (e.g. from tests) as non-gating
  findings with recommended remediation tasks.

## Build Quality Signals

Report the outcome of lint, typecheck, build, and test commands. When a command
fails, aggregate the failure into a single finding per category (rather than per
individual error) and outline remediation steps.

## Output Contract

Every review response must include:

- **Summary**: Approved | Changes Requested | Blocked: Missing Design Docs |
  Quality Controls Violation | Dependency Vulnerabilities | Deprecated
  Dependencies | TDD Violation | Review Complete (Scope: …) | Review Pending
  (clarification needed)
- **Resolved Scope** statement
- **Findings** ordered by severity with full metadata (category, severity,
  confidence, evidence, impact, fix plan, references)
- **Strengths** worth preserving
- **Open Questions** in `[NEEDS CLARIFICATION: …]` format
- **Build Quality Signals** summary (lint/typecheck/build/tests + notable
  warnings)
- **Dependency Audit** summary: baseline vs current severity counts, new CVEs,
  deprecated packages, dependency justifications, npm version checks
- **Checklist Summary** when a scope-specific checklist informs the review
- **Decision Log** entries when assumptions were clarified (per Instruction
  Handling Strategy)

## Findings Persistence (Write-Back Guidance)

When findings exist:

1. Attempt to locate a relevant `tasks.md` within the resolved scope
   (package/app/docs path). If found, offer to log remediation tasks there and
   request caller approval before writing.
2. If no `tasks.md` exists, suggest a sensible location (e.g.
   `docs/checklists/<scope>.md` or the nearest package-level checklist) and
   offer to create or append a section on approval.
3. Provide ready-to-apply task wording when proposing updates; remain read-only
   until approval is granted.
4. When write-back is declined, ensure findings still include actionable
   remediation details in the review output.

## Decision Log

Follow the project’s instruction/assumption handling strategy:

- Record `[Resolved Question]` entries for any assumptions clarified.
- Include the decision log in the final notes whenever it shapes findings or
  recommendations.

---

**Reminder**: Reviews remain non-destructive unless explicitly authorized to
update checklists or task logs.
