Validate the implementation plan document for a specific feature.

Given the implementation plan path as an argument (e.g.
"specs/002-feature/plan.md"), perform a scope‑correct, non‑destructive review
aligned with the /plan command intent and `.specify/templates/plan-template.md`.

Early Gates (stop if any fail)

1. Spec Readiness Gate
   - Load the linked spec (from the plan header or `specs/<branch>/spec.md`).
   - If the spec contains any "[NEEDS CLARIFICATION: …]" or fails its Review &
     Acceptance checklist, output Status: "Blocked by Spec" with the list of
     unresolved items. STOP.

2. Unknowns Gate for /plan
   - Scan the plan and Phase 0 `research.md` for any "[NEEDS CLARIFICATION: …]".
   - If any remain, output Status: "Needs Clarification" with a grouped list by
     section/file and suggested follow‑up questions. STOP.

3. Standards Digest Gate
   - Ensure the plan.md includes a "Standards Digest" (Backend) section in the
     plan body or payload context and that Phase 0 `research.md` contains a
     top‑level "Standards Digest" section copied from the plan.
   - Detect if the feature includes frontend scope (keywords: React, UI,
     apps/web, component, page, routing, hooks, shadcn, Tailwind, .tsx). If so,
     verify plan.md and Phase 0 `research.md` also contain a "UI Standards
     Digest" section.
   - Content quality check: at least two rules in each present digest must show
     concise bad/good examples. If any required digest is missing or lacks
     examples, output Status: "Missing Standards Digest" with remediation and
     STOP.

4. Scope Compliance Gate (/plan stops at step 7)
   - Ensure `tasks.md` does NOT exist and the plan does NOT claim to have
     created it.
   - If violated, output Status: "Scope Breach" with remediation: move task
     creation to /tasks. STOP.

Scope and Sources

- Primary input: the provided `plan.md`.
- Sibling artifacts (same directory): evaluate only those explicitly referenced
  in the plan: `research.md`, `data-model.md`, `quickstart.md`, `contracts/*`.
- Alignment references: the feature spec (`spec.md`), CONSTITUTION.md,
  docs/architecture.md, docs/ui-architecture.md, docs/front-end-spec.md (when
  relevant).
- Do not scan unrelated files.

Validation Criteria (when gates pass)

- Execution Flow compliance (per plan-template):
  - Follows steps 1–7; explicitly stops at 7; Phase 2 is descriptive only.
  - Progress Tracking updated to reflect step completion.
- Required artifacts:
  - Phase 0: `research.md` exists; each decision includes Decision, Rationale,
    Alternatives.
  - Phase 1: `data-model.md`, `contracts/` (OpenAPI/GraphQL schema),
    `quickstart.md`; contract tests are planned to fail first (TDD).
  - Optional agent file updates follow constraints (O(1) updates, <150 lines,
    preserves manual edits).
- Constitution Check:
  - Present before Phase 0 and re‑checked after Phase 1; violations, if any, are
    justified in "Complexity Tracking" with a simpler alternative explicitly
    rejected.
- Standards Digest Check:
  - Plan includes Backend Standards Digest; research.md includes matching
    section.
  - If frontend‑involved, plan and research.md include UI Standards Digest.
  - Digests contain spec‑relevant selections (not full copy/paste) and at least
    two rules with bad/good examples.
- TDD and Quality:
  - Tests precede implementation; integration/contract tests planned for new
    APIs and shared schemas; forbidden behaviors (implementation before tests)
    are avoided.
- Observability & CLI standards (WHAT/WHY level):
  - Structured logging, error context, and per‑library CLI entry points are
    captured as plan constraints without prescribing detailed implementation.
- Alignment:
  - Consistent with the feature spec’s requirements and user scenarios;
    consistent with architecture and front‑end spec when referenced; adheres to
    constitutional principles.

Output Format

- Summary: Ready for /tasks | Blocked by Spec | Needs Clarification | Scope
  Breach | Constitution Violations.
- Gates: pass/fail for Spec Readiness, Unknowns Resolved, Scope Compliance (with
  notes).
- Checklist Results: map to Execution Flow, Required Artifacts, Constitution
  Check, Progress Tracking.
- Strengths: concise positives to preserve.
- Gaps & Risks: findings with severity (Critical | Major | Minor), rationale,
  and section/file references.
- Proposed Improvements: concrete plan‑level adjustments or example rewrites (do
  not edit files).
- Open Questions: any remaining items in "[NEEDS CLARIFICATION: …]" format.
- Alignment Notes: spec/architecture/Constitution consistency or conflicts.

Important

- Read‑only review. Make detailed proposals to improve the plan; do NOT modify
  files until instructed.
