# Validate the specification document for a specific Story.

Perform a scope‑correct, non‑destructive review that focuses on WHAT and WHY,
never HOW, while enforcing alignment with canonical sources.

Early Gate: Clarifications First

1. Load the spec and collect all occurrences of "[NEEDS CLARIFICATION: …]".
2. If any exist:
   - Output only a structured report of all clarification items, grouped by
     section with succinct follow‑up questions.
   - Set Status: "Needs Clarification" and STOP (defer further checks until
     resolved).

Story Context Analysis (Determine validation stance)

1. Identify story type and audience (business feature vs
   technical/infrastructure) from content and PRD context.
2. Select validation stance:
   - Business Feature: enforce strict WHAT/WHY separation (no HOW).
   - Technical/Infrastructure: allow HOW‑level constraints only when they
     implement constitutional/architectural mandates or establish required
     foundations.

Scope and Sources (technology‑neutral)

- Primary input: the provided `spec.md`.
- Alignment references (canonical):
  - Product requirements (e.g., PRD): WHAT/WHY.
  - Architecture documents (backend/frontend): HOW‑level boundaries, patterns,
    conventions.
- Sibling documents: evaluate only those explicitly referenced by the spec.

Gates and Checks (agnostic)

Gate: Canonical Architecture Linkage (HOW when allowed)

- If the spec asserts implementation‑constraining HOW‑level requirements
  (allowed for technical/infrastructure stories), each such statement MUST
  reference a specific section/anchor in the relevant architecture document(s).
- Fail with Status: "Alignment Issues" if HOW constraints lack canonical
  anchors.

Gate: Non‑Functional Requirements Coverage

- When the story touches cross‑cutting concerns (e.g.,
  authentication/authorization, input validation, error handling,
  observability/logging, data access abstraction, performance, security),
  require high‑level requirements that reference corresponding architecture
  sections/anchors.
- Fail if cross‑cutting concerns are implicated but not referenced.

Check: PRD Traceability

- Map each acceptance criterion to a PRD excerpt (anchor/section). Flag criteria
  with no PRD basis.

Common validation criteria (all story types)

- Template compliance per the project’s spec template: mandatory sections
  present and ordered; user scenarios with multiple acceptance cases; testable,
  unambiguous requirements; honest execution status.
- Business stories: no technology names, code, endpoints, or schemas.
- Technical stories: technology‑neutral phrasing preferred; when specific
  technologies are truly required, they must be justified by canonical
  architecture and linked via anchors.

Contextual HOW‑Leak Heuristics

- Business stories: flag technology names, code blocks, endpoint paths, schema
  definitions, implementation verbs.
- Technical stories: allow technology mentions only when linked to canonical
  anchors; still flag low‑level code/schema internals as HOW‑leaks.

Output Format

- Context Analysis: story type, audience, stance, and rationale.
- Summary: readiness recommendation (Draft | Ready for planning) with key notes.
- Checklist Results: template compliance, PRD traceability, NFR coverage,
  architecture linkage.
- Architecture Alignment: Found anchors, Missing anchors, Suggested anchors
  (with exact slugs/sections to reference).
- Gaps & Risks: issues with severity (Critical | Major | Minor), rationale, and
  section references.
- Proposed Improvements: concrete edits (non‑destructive) to add anchors,
  rephrase HOW, or elevate NFRs.
- Open Questions: remaining items in "[NEEDS CLARIFICATION: …]" format.

Important

- Non‑destructive review. Provide precise, ready‑to‑paste anchor references and
  suggested wording. Do not edit files unless explicitly permitted.
