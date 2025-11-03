# Code Review Report: Dashboard Shell Alignment (001-upgrade-dashboard-view)

## Final Status: **Changes Requested** _(Approved | Changes Requested | Blocked: Missing Context | Blocked: Scope Mismatch | Needs Clarification | TDD Violation | Quality Controls Violation | Security Gate Failure | Privacy Gate Failure | Supply Chain Violation | Dependency Vulnerabilities | Deprecated Dependencies | Review Pending)_

## Resolved Scope

**Branch**: `001-upgrade-dashboard-view` **Baseline**: `origin/main` **Diff
Source**: `git diff origin/main...HEAD` **Review Target**: Story 2.2 dashboard
shell alignment (sidebar gradients, collapse rail, live project navigation,
empty/error states) **Files Analyzed**: 40 changed files including the new
`DashboardShell` layout, ProjectsNav refactor, Zustand persistence, Story 2.2
palette tokens, fixture profile wiring, and expanded unit/e2e coverage

**Resolved Scope Narrative**: Focused on the React dashboard shell refactor and
sidebar experience. Verified the new layout wrapper, Zustand store persistence,
TanStack query reuse, focus management, and updated Vitest/Playwright suites
while checking Story 2.2 palette conformance and empty/error flows.

**Feature Directory**:
`/Users/danwas/Development/Projects/ctrl-freaq/worktrees/001-upgrade-dashboard-view/specs/001-upgrade-dashboard-view`
**Implementation Scope**:

- apps/web/src/components/dashboard/DashboardShell.tsx
- apps/web/src/components/sidebar/ProjectsNav.tsx
- apps/web/src/stores/project-store.ts
- apps/web/src/pages/Dashboard.tsx
- apps/web/src/pages/Project.tsx
- apps/web/src/pages/Dashboard.test.tsx

## SPEC_KIT_CONFIG

```yaml
spec-kit:
  constitution:
    path: '/Users/danwas/Development/Projects/ctrl-freaq/worktrees/001-upgrade-dashboard-view/CONSTITUTION.md'
  review:
    documents:
      - path: '/Users/danwas/Development/Projects/ctrl-freaq/worktrees/001-upgrade-dashboard-view/docs/prd.md'
        context:
          'Documents the product requirements and should be considered a primary
          source of truth.'
      - path: '/Users/danwas/Development/Projects/ctrl-freaq/worktrees/001-upgrade-dashboard-view/docs/architecture.md'
        context:
          'Documents the architecture of the project and should be considered a
          primary source of truth.'
      - path: '/Users/danwas/Development/Projects/ctrl-freaq/worktrees/001-upgrade-dashboard-view/docs/front-end-spec.md'
        context:
          'Documents the front-end specifications and should be considered a
          primary source of truth.'
```

## Pre-Review Gates

| Gate                      | Status              | Details                                                                                                                                          |
| ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context Gate**          | Pass                | plan.md, spec.md, tasks.md, research.md, data-model.md, contracts/, quickstart.md, Constitution, and front-end spec are all present and current. |
| **Change Intent Gate**    | Pass                | Code stays within Story 2.2 remit (dashboard shell + sidebar UX, fixture profile support); no unexpected platform drift.                         |
| **Unknowns Gate**         | Needs Clarification | Raised a question about the sidebar active text color diverging from the spec (see Outstanding Clarifications).                                  |
| **Separation of Duties**  | Pass                | Independent reviewer; no overlap with authorship.                                                                                                |
| **Code Owners Gate**      | Unknown             | Repository still lacks CODEOWNERS metadata—cannot confirm owner review coverage.                                                                 |
| **Quality Controls Gate** | Partial             | `pnpm lint`, `pnpm typecheck`, and `pnpm --filter @ctrl-freaq/web test` pass locally; Playwright suites were not rerun in this loop.             |
| **TDD Evidence Gate**     | Partial             | New Vitest coverage observed, but Playwright fixture runs remain pending until findings are fixed.                                               |

## Findings

### Active Findings (Current Iteration)

#### Finding F013: Lifecycle badges ignore Story 2.2 color tokens

- **Category**: UI/UX
- **Severity**: Major
- **Confidence**: High
- **Impact**: `ProjectStatusBadge` hard-codes `bg-indigo-100 text-indigo-700`,
  so every lifecycle badge renders with the same color regardless of `status`.
  Because ProjectsNav hides the text label (`label={false}`) in the sidebar
  rows, the badges now rely solely on identical glyphs and background color,
  breaking the Story 2.2 requirement that lifecycle states remain visually
  distinct (FR-003 / docs/front-end-spec.md#color-palette) and regressing prior
  finding F005.
- **Evidence**: `apps/web/src/components/status/ProjectStatusBadge.tsx:75-97` —
  static Tailwind classes;
  `apps/web/src/components/sidebar/ProjectsNav.tsx:296-312` — badges rendered
  label-less with no token styling.
- **Remediation**: Map each status to the corresponding
  `--dashboard-status-{status}-*` tokens (background + text) or equivalent
  Tailwind CSS variables, ensuring the badge adopts unique colors per status.
  Provide unit coverage asserting the CSS variables are applied and rerun
  Vitest + Playwright sidebar navigation specs.
- **Source Requirement**: FR-003 (Sidebar lifecycle badges must remain visible
  and spec-aligned)
- **Files**: apps/web/src/components/status/ProjectStatusBadge.tsx,
  apps/web/src/components/sidebar/ProjectsNav.tsx

#### Finding F014: Empty-state CTA uses AI-Active color instead of the Primary token

- **Category**: UI/UX
- **Severity**: Major
- **Confidence**: High
- **Impact**: The “Start a project” CTA inside the sidebar empty state applies
  `bg-[hsl(var(--dashboard-sidebar-active-border))]` (AI-Active purple) rather
  than the Primary token (`#cbc8d0`) mandated by FR-006. This deviates from
  Story 2.2 palette guidance and contradicts the audit log entry resolving F006,
  risking inconsistent design language and contrast expectations.
- **Evidence**: `apps/web/src/components/sidebar/ProjectsNav.tsx:224-231` — CTA
  background tied to `--dashboard-sidebar-active-border` instead of `--primary`.
- **Remediation**: Switch the CTA to use the Primary token
  (`bg-[hsl(var(--primary))]`) with complementary text/hover styles, update any
  snapshots, and confirm with the empty-state Playwright flow.
- **Source Requirement**: FR-006 (Empty-state CTA styling requirements)
- **Files**: apps/web/src/components/sidebar/ProjectsNav.tsx

### Historical Findings Log

- [Resolved 2025-11-03] F012: Sidebar row spacing/glyph size overshoots
  Story 2.2 compact spec — Reported 2025-11-02 by Codex Review. Resolution:
  Adjusted padding to `px-2.5 py-1.5`, reduced glyph sizing to 8×8, and added
  collapsed rail handling; confirmed via
  `apps/web/src/components/sidebar/ProjectsNav.tsx` and Vitest coverage.
  Evidence: `tasks.md` Phase 4.R (F012 checked),
  `apps/web/src/components/sidebar/ProjectsNav.tsx`.
- [Resolved 2025-11-03] F011: Status badges clip inside sidebar rows — Reported
  2025-11-02 by Codex Review. Resolution: Badges now live in a `shrink-0`
  container while the project name receives `min-w-0`, eliminating clipping.
  Evidence: `tasks.md` Phase 4.R (F011 checked),
  `apps/web/src/components/sidebar/ProjectsNav.tsx`.

## Strengths

- Persisted sidebar collapse state and active project into sessionStorage with
  graceful serverless fallback (`apps/web/src/stores/project-store.ts`),
  improving return navigation.
- Mobile overlay respects focus trapping and body scroll lock, with tests
  mocking `matchMedia` to prove accessibility behavior
  (`apps/web/src/components/dashboard/DashboardShell.tsx`,
  `apps/web/tests/setup.ts`).
- Vitest suite meaningfully covers hydration metrics, empty/error messaging, and
  store persistence regressions (`apps/web/src/pages/Dashboard.test.tsx`,
  `apps/web/src/stores/project-store.test.ts`).

## Feedback Traceability

| Feedback Item                                | Source                            | Status    | Evidence / Linked Findings                                         |
| -------------------------------------------- | --------------------------------- | --------- | ------------------------------------------------------------------ |
| Follow the Code Review Playbook step-by-step | Conversation 2025-11-03T03:28:04Z | Addressed | Review executed per playbook phases with documented gates/findings |

## Outstanding Clarifications

- [NEEDS CLARIFICATION: Sidebar active text color uses
  `--dashboard-sidebar-active-text` = white instead of the `Sidebar Primary`
  token (`#0f0a19`) referenced in FR-003. Confirm whether this deviation is
  intentional or requires a follow-up change.]

## Control Inventory

| Control Domain         | Implementation                                                                          | Status    | Reference                                                |
| ---------------------- | --------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------- |
| **Authentication**     | `useAuth` / `useUser` guard sidebar account card and switch-user CTA                    | Reused    | apps/web/src/pages/Dashboard.tsx:640-720                 |
| **Logging**            | Structured `logger.warn` instrumentation for view-state persistence and archive notices | Reused    | apps/web/src/pages/Dashboard.tsx:90-210                  |
| **Error Handling**     | Sidebar inline error + retry flow leveraging TanStack query error state                 | Updated   | apps/web/src/components/sidebar/ProjectsNav.tsx:177-223  |
| **Repository Pattern** | Project data continues through `useProjectsQuery` with user-aware cache invalidation    | Reused    | apps/web/src/hooks/use-projects-query.ts                 |
| **Input Validation**   | Project creation dialog reused unchanged; no new inputs introduced                      | Unchanged | apps/web/src/components/projects/CreateProjectDialog.tsx |
| **State Management**   | Zustand store now persists `activeProjectId` + collapse state via JSON storage          | Updated   | apps/web/src/stores/project-store.ts                     |
| **Performance**        | Dashboard hydration metrics preserved via `emitProjectDashboardHydrationMetric` hooks   | Reused    | apps/web/src/pages/Dashboard.tsx:200-270                 |

## Quality Signal Summary

### Linting Results

- **Status**: Pass with warnings
- **Warnings**: 1 warning (ESLint deprecated `.eslintignore` usage), 0 errors
- **Key Issues**:
  - ESLint emits `ESLintIgnoreWarning` because new `.eslintignore` was added;
    migrate ignores into `eslint.config.js` to silence the warning.

### Type Checking

- **Status**: Pass
- **Results**: `pnpm typecheck` (Turbo build + `tsc --noEmit`) completed without
  diagnostics.

### Test Results

- **Status**: Partial
- **Results**: `pnpm --filter @ctrl-freaq/web test` (Vitest) passes; Playwright
  fixture suites not run pending remediation.
- **Root Cause**: Holding off on Playwright until F013/F014 are corrected to
  avoid churn.

### Build Status

- **Status**: Pass
- **Details**: `pnpm typecheck` triggered `pnpm run build` via Turbo; all
  workspace builds succeeded (cache hits).

## Dependency Audit Summary

- **Baseline Severity Counts**: Unchanged from `origin/main`
- **Current Severity Counts**: Unchanged (no dependency revisions)
- **New CVEs Identified**: None
- **Deprecated Packages**: None detected
- **Justifications / Version Currency**: No package.json updates in this diff.

## Requirements Coverage Table

| Requirement | Summary                                                                        | Implementation Evidence                                                                                | Validating Tests                                                                 | Linked Findings / Clarifications                      |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **FR-001**  | Dashboard renders within persistent header/sidebar shell with Story 2.2 tokens | apps/web/src/components/dashboard/DashboardShell.tsx; apps/web/src/index.css                           | apps/web/src/pages/Dashboard.test.tsx                                            | —                                                     |
| **FR-002**  | Header presents product identity + global actions responsively                 | apps/web/src/components/dashboard/DashboardShell.tsx; apps/web/src/pages/Dashboard.tsx                 | apps/web/src/pages/Dashboard.test.tsx                                            | —                                                     |
| **FR-003**  | Sidebar lists live projects with lifecycle badges, highlighting active project | apps/web/src/components/sidebar/ProjectsNav.tsx; apps/web/src/stores/project-store.ts                  | apps/web/src/pages/Dashboard.test.tsx; apps/web/src/stores/project-store.test.ts | F013; [NEEDS CLARIFICATION] sidebar active text color |
| **FR-004**  | Selecting a project updates active context and routes without losing scroll    | apps/web/src/pages/Dashboard.tsx; apps/web/src/pages/Project.tsx; apps/web/src/stores/project-store.ts | apps/web/src/pages/Project.test.tsx; apps/web/src/stores/project-store.test.ts   | —                                                     |
| **FR-005**  | Sidebar shows loading and retry affordances for project fetch failures         | apps/web/src/components/sidebar/ProjectsNav.tsx                                                        | apps/web/src/pages/Dashboard.test.tsx                                            | —                                                     |
| **FR-006**  | Empty-state messaging with Primary token CTA opening existing dialog           | apps/web/src/components/sidebar/ProjectsNav.tsx                                                        | apps/web/src/pages/Dashboard.test.tsx                                            | F014                                                  |
| **FR-007**  | Main content retains dashboard metrics/cards spacing + automated assertions    | apps/web/src/pages/Dashboard.tsx                                                                       | apps/web/src/pages/Dashboard.test.tsx                                            | —                                                     |
| **FR-008**  | Shell landmarks, mobile focus trap, and accessible overlays retained           | apps/web/src/components/dashboard/DashboardShell.tsx                                                   | apps/web/src/pages/Dashboard.test.tsx                                            | —                                                     |

## Requirements Compliance Checklist

| Requirement Group             | Status            | Notes                                                                              |
| ----------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| **Constitutional Principles** | Changes Requested | Palette/token regressions (F013/F014) violate Story 2.2 intent tracked in dossier. |
| **SOC 2 Authentication**      | Not Applicable    | No backend/auth changes introduced.                                                |
| **SOC 2 Logging**             | Not Applicable    | Logging untouched.                                                                 |
| **Security Controls**         | Not Applicable    | UI-only change set.                                                                |
| **Code Quality**              | Partial           | Lint/typecheck/ Vitest pass; ESLint warning and missing Playwright reruns noted.   |
| **Testing Requirements**      | Partial           | Vitest covered; Playwright gauntlet outstanding after remediation.                 |

## Decision Log

- DL-010: Confirmed sessionStorage-backed sidebar persistence aligns with
  existing control inventory (no finding).
- DL-011: Identified lifecycle badge color regression (F013) breaking Story 2.2
  palette mapping.
- DL-012: Flagged empty-state CTA color drift from Primary token (F014).

## Remediation Logging

### Remediation R13

- **Context**: F013 – Story 2.2 lifecycle badges must display distinct colors.
- **Control Reference**: Project status badge component
  (`apps/web/src/components/status/ProjectStatusBadge.tsx`)
- **Actions**: Map each lifecycle status to
  `--dashboard-status-{status}-bg/text` CSS variables (or equivalent Tailwind
  CSS variable usage), ensure badges render unique colors even when labels are
  hidden, and add Vitest assertions verifying the applied classes. Follow up
  with Playwright sidebar navigation suite.
- **Verification**:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`;
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-sidebar-navigation.e2e.ts`

### Remediation R14

- **Context**: F014 – Sidebar empty-state CTA must use the Primary token.
- **Control Reference**: ProjectsNav empty-state CTA
  (`apps/web/src/components/sidebar/ProjectsNav.tsx`)
- **Actions**: Update the CTA to reference `--primary` (background + hover) and
  ensure text/hover colors satisfy contrast. Re-run empty-state Vitest
  assertions and Playwright empty-state flow.
- **Verification**:
  `pnpm --filter @ctrl-freaq/web test -- src/pages/Dashboard.test.tsx`;
  `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-empty-state.e2e.ts`

---

**Review Completed**: 2025-11-03T03:42:47Z **Next Action**: Align lifecycle
badge/CTA styling with Story 2.2 tokens, clarify the toolbar text-color
variance, rerun Playwright suites, then request a follow-up audit.
