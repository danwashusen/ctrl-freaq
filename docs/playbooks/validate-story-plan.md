# Validate the implementation plan for a specific Story.

Perform a scope‑correct, non‑destructive review focused on HOW‑level boundaries
and conventions, ensuring the plan is aligned with canonical sources and that
standards/conventions are captured and propagated.

Early Gates

1. Spec Readiness Gate
   - Load the linked spec. If it contains any "[NEEDS CLARIFICATION: …]" or
     fails its Review & Acceptance checklist, output Status: "Blocked by Spec"
     with unresolved items. STOP.

2. Unknowns Gate for /plan
   - Scan the plan and Phase 0 research.md for any "[NEEDS CLARIFICATION: …]".
     If any remain, output Status: "Needs Clarification" with a grouped list and
     suggested follow‑ups. STOP.

3. Standards/Conventions Digest Gate (Presence & Relevance)
   - Ensure the plan includes a tailored "Standards/Conventions Digest" for
     backend and, when UI is in scope, for frontend.
   - Digest content should be sourced from the architecture documents and cover
     categories such as: dependency injection strategy, input validation
     approach, error handling strategy, structured logging posture, data access
     abstraction/persistence conventions, security controls; for UI: component
     framework conventions, accessibility, state update/immutability rules,
     performance strategies, client‑side logging posture, and testing patterns.
   - Enforce conciseness: size limits apply; include at least two short bad/good
     examples per present digest (technology‑neutral phrasing).
   - Fail with Status: "Missing or Irrelevant Standards Digest" if absent or
     generic.

4. Research Copy Gate (Propagation)
   - Verify the digest(s) are copied into Phase 0 `research.md` as top‑level
     sections (e.g., "Standards Digest", "UI Standards Digest").
   - Fail with Status: "Missing Research Copy" if absent.

5. Scope Compliance Gate (for /plan)
   - Ensure the plan’s scope matches the expected phase boundaries (no premature
     task creation if not intended by the template). If violated, output Status:
     "Scope Breach" with remediation. STOP.

Scope and Sources

- Primary input: the provided `plan.md`.
- Sibling artifacts (same directory): evaluate only those referenced by the plan
  (research.md, data‑model.md, quickstart.md, contracts/\*).
- Alignment references: feature spec (WHAT/WHY), architecture documents
  (backend/frontend) for HOW‑level boundaries and conventions.

Validation Criteria (when gates pass)

- Execution Flow compliance: follows project’s plan template, progress tracking
  consistent.
- Architecture/UI excerpts: present, minimal, relevant, with anchors to
  canonical sections.
- Standards/Conventions Digests: tailored to the feature scope, concise, with at
  least two bad/good examples per present digest; copied into research.md.
- Constitution/Principles (agnostic): no singletons/global state (use the
  project’s DI strategy), boundary validation at interfaces, structured logging
  with correlation context, abstracted data access, secure error handling,
  test‑first approach reflected in plan sequencing.

Output Format

- Summary: Ready for /tasks | Blocked by Spec | Needs Clarification | Scope
  Breach | Missing or Irrelevant Standards Digest | Missing Research Copy.
- Gates: pass/fail for Spec Readiness, Unknowns Resolved, Standards Digest
  Presence/Relevance, Research Copy, Scope Compliance (with notes).
- Checklist Results: Execution Flow, Architecture/UI Excerpts (anchors present),
  Standards/Conventions Digests (tailored, examples, size), Research
  Propagation, Progress Tracking.
- Strengths: concise positives to preserve.
- Gaps & Risks: findings with severity (Critical | Major | Minor), rationale,
  and section/file references.
- Proposed Improvements: concrete plan‑level adjustments (e.g., add anchors,
  refine digest bullets/examples, copy digest into research).
- Open Questions: remaining items in "[NEEDS CLARIFICATION: …]" format.
- Alignment Notes: spec vs architecture consistency or conflicts.

Important

- Read‑only review. Provide precise, ready‑to‑paste edits for plan/research; do
  NOT modify files unless explicitly permitted.
