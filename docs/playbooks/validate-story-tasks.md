# Validate the tasks document for a specific Story.

Perform a non‑destructive review to ensure tasks align with the plan-of-record,
canonical architecture documents, and standards/conventions, and that they are
executable in a TDD‑first sequence.

Early Gates

1. Required Context Gate
   - Verify the target feature directory exists and contains `plan.md` and
     `tasks.md`. STOP with "Missing Context" if not.

2. Plan-of-Record Gate
   - Confirm `plan.md` is the plan-of-record and references the same feature
     scope as `tasks.md`. STOP with "Blocked by Plan" if the plan has unresolved
     gates (clarifications/blocked by spec).

3. Unknowns Gate
   - Scan `tasks.md` for any "[NEEDS CLARIFICATION: …]" markers. If present,
     output Status: "Needs Clarification" and STOP.

Alignment Gates (technology‑neutral)

4. Plan Consistency Gate
   - Each task must trace to a concrete section/anchor or bullet in `plan.md`
     (scope, sequencing, gates). Flag tasks with no trace; flag missing tasks
     for planned items.
   - Confirm `research.md` contains the auto-generated
     `## Implementation Briefs` block (`<!-- story-tasks:auto -->`) and that
     each phase subsection aligns with the phases and task ranges in `tasks.md`.
     Flag mismatches or omissions.

5. Standards/Conventions Conformance Gate
   - Load "Standards/Conventions Digest" (backend) and, if UI is in scope, the
     "UI Standards Digest" from `plan.md` or `research.md`.
   - Enforce that tasks include acceptance criteria aligned to digest categories
     (declaration only; code‑level enforcement occurs during code review), such
     as:
     - Backend: project’s dependency injection strategy (no globals/singletons),
       boundary input validation approach, structured logging posture with
       correlation context, data access abstraction layered correctly (no direct
       persistence in boundary layers), error handling strategy (no internal
       leaks), test‑first ordering.
     - UI: component framework conventions and lifecycle rules, accessibility
       guidelines (labels/roles/alt text equivalents), state update/immutability
       rules, performance strategies (e.g., partitioning/lazy loading where
       appropriate), client‑side logging posture (no sensitive data), testing
       strategy patterns.
   - Fail with Status: "Standards Misalignment" for tasks missing these
     acceptance criteria. See `docs/playbooks/code-review.md` for code‑level
     enforcement.

6. Architecture Boundary Alignment Gate
   - Verify tasks operate within the architecture’s designated layers/locations
     (e.g., boundary interfaces, application/service logic, persistence/data
     access, presentation/UI composition).
   - Flag boundary violations (e.g., persistence concerns in boundary tasks, UI
     concerns in service layer tasks) and propose rewrites.

7. TDD Concreteness Gate
   - For every implementation task, require a preceding test task that names
     files/locations, scenarios, and intended failing conditions. Fail with "TDD
     Violation" if missing.

Checks (agnostic)

- Artifacts Mapping
  - Contracts → contract test tasks [P]
  - Entities in data‑model → model/data tasks [P]
  - Quickstart scenarios → integration test tasks [P]
  - Flag omissions and propose missing tasks with correct file/category paths.

- Paths and Parallelization
  - Paths align with project structure (frontend app, backend app, libraries) as
    inferred from the plan and architecture documents.
  - [P] only when tasks touch disjoint files/areas; flag misuse on shared files.

- Cross‑cutting Controls
  - For boundary/API tasks: tasks must declare boundary input validation, error
    strategy, structured logging/correlation, and security controls as
    acceptance criteria (enforced during code review).
  - For UI tasks: tasks must declare accessibility and performance strategy
    acceptance criteria, plus testing approach alignment (enforced during code
    review).

Reporting

- Summary: Ready for execution | Missing Context | Blocked by Plan | Needs
  Clarification | Standards Misalignment | Architecture Misalignment | TDD
  Violation | Alignment Issues.
- Gates: pass/fail with notes for Plan Consistency, Standards Conformance,
  Architecture Boundary Alignment, TDD Concreteness.
- Standards Compliance Matrix: tasks × standards categories (checkmarks and
  gaps) with references (line numbers/sections).
- Architecture Boundary Map: each task’s target layer and pass/fail notes.
- Proposed Improvements: precise, ready‑to‑paste acceptance criteria and task
  rewrites; suggested additional tasks for omissions.
- Open Questions: remaining items in "[NEEDS CLARIFICATION: …]" format.

Write‑Back Behavior (optional)

- Non‑destructive by default. If permitted, append a new phase section to
  `tasks.md` with remediation tasks; otherwise, output a ready‑to‑apply patch.

Related Playbooks

- `docs/playbooks/code-review.md` — S‑tier code review and standards enforcement
- `docs/playbooks/validate-story-plan.md` — Validate implementation plan
- `docs/playbooks/validate-story-spec.md` — Validate specification
