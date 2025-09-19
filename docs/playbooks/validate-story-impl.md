# Story Implementation Validation Playbook (S-Tier)

Use this playbook to validate a story/feature implementation end-to-end. Begin
with the master S-tier code review (`docs/playbooks/review.md`) and then apply
the story-specific gates below to confirm alignment with plans, tasks, and
quickstart expectations.

## Inputs

- **Required scope** via one of:
  - Pull request number
  - Commit range (e.g. `BASE..HEAD`)
  - Feature branch compared against default (merge-base..HEAD)
- **Optional**:
  - File filters (globs) to narrow attention
  - Path to the relevant `tasks.md` for task mapping
  - Known environment/reproduction notes
  - Baseline branch for dependency comparisons (defaults to repo default)

If no scope information is provided and none can be inferred, request
clarification and pause the review.

## Step 1: Execute the S-Tier Code Review

Run the full `docs/playbooks/review.md` workflow against the resolved scope.
That playbook covers constitutional alignment, network and context gates, TDD
enforcement, dependency audits, scope-specific checklists, quality command
execution, findings formatting, and write-back etiquette. All stop conditions
raised there apply here.

## Story-Specific Gates

### Scope Gate (Plan Alignment)

- Verify the feature’s changes align with the declared plan anchors and
  `tasks.md` items.
- Treat the Implementation Briefs in `research.md` (`## Implementation Briefs`
  block) as the canonical phase intent; flag diffs that contradict briefs
  without an updated tasks run.
- Confirm that each diffed area maps back to the story acceptance criteria; flag
  unrelated work.
- Missing planned changes or unexplained additions → Status: "Scope Mismatch"
  (STOP until the scope is clarified or the changes are split).

### Task Mapping & Completion Audit (when `tasks.md` is available)

1. For each `T###` entry:

- Determine expected artifacts/behavior.
- Cross-check the matching Implementation Brief subsection to confirm phase
  intent, anchors, and required quality gates.
- Verify completeness using primary, secondary, and tertiary signals.
- Classify as ✅ Complete | 🟡 Partial | 🔶 Stub | ❌ Not Started with
  supporting evidence.

2. Produce a completion map and overall completion percentage for the story.
3. Note any downstream work that requires new tasks or follow-ups.

### Quickstart Verification (when `quickstart.md` exists)

1. Map quickstart scenarios (health checks, CLI usage, UI flows, DB steps,
   build/test commands) to automated tests or manual validation evidence.
2. Compute coverage; if < 80%, set Status: "Insufficient Quickstart Coverage"
   and document gaps.
3. If no integration tests exercise quickstart scenarios, set Status: "Missing
   Quickstart Integration Tests" with proposed test coverage.

## Findings Persistence for Story Reviews

Continue to follow the write-back guidance from `docs/playbooks/review.md`
(locate `tasks.md`, offer to log findings, or suggest a location). When
`tasks.md` is already part of the change:

1. Draft an amendment that preserves existing text and checkboxes while updating
   completion states.
2. Add a new section titled
   `## Phase 3.<N>: Code Review Feedback from <YYYY-MM-DD HH:MM>` where `<N>`
   increments the existing `3.<n>` sequence.
3. Append new tasks continuing the `T###` numbering (preserve zero padding) in
   the format `TXYZ: [Category] Summary — File: path[:line]` with:

- Why: brief impact rationale.
- Severity: Critical | Major | Minor.
- Fix: concrete steps, starting with tests, then implementation.
- Links: relevant specs, architecture anchors, commits/PRs.

4. Add aggregate remediation tasks when lint/typecheck/test/build commands fail,
   reuse acceptance criteria from the base playbook.
5. For deprecation warnings, create dedicated tasks identifying the emitting
   command and acceptance criteria to clear the warning.
6. Present the draft to the requester and apply it only after explicit approval;
   otherwise leave `tasks.md` untouched and keep findings in the review output.

If edits are not permitted, provide ready-to-apply patch text instead of
modifying files directly.

## Output Contract (Story-Focused)

Extend the S-tier review output with story metrics:

- **Summary**: Approved | Changes Requested | Blocked: Missing Design Docs |
  Quality Controls Violation | Dependency Vulnerabilities | Deprecated
  Dependencies | TDD Violation | Scope Mismatch | Insufficient Quickstart
  Coverage | Missing Quickstart Integration Tests | Review Complete (XX% tasks
  implemented) | Review Pending (no scope)
- **Resolved Scope** statement (diff range, PR, branch)
- **Task Completion Map** (per status with evidence) and overall percentage
- **Quickstart Coverage** results when applicable (covered vs missing scenarios,
  recommended tests)
- **Findings** with the metadata required by the base playbook
- **Strengths**, **Open Questions**, **Build Quality Signals**, **Dependency
  Audit**, and **Decision Log** entries per `docs/playbooks/review.md`

## Important Notes

- Story validation remains non-destructive unless explicitly authorized to
  update `tasks.md` or related checklists.
- Continue enforcing the constitution and architectural boundaries highlighted
  in the master playbook.
- Provide precise, minimal diffs and test recommendations in proposed fixes.
