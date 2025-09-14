Validate the specification document for a specific feature.

Given the specification document path as an argument (e.g. "specs/002-something/spec.md"), perform a scope‑correct, non‑destructive review that focuses on WHAT and WHY, never HOW.

Early Gate: Clarifications First
1) Load the spec. Immediately collect all occurrences of "[NEEDS CLARIFICATION: …]" across the document.
2) If any are found:
   - Output only a structured report listing each clarification item, grouped by section with suggested, succinct next questions the author can answer.
   - Set Status: "Needs Clarification" and explicitly state that all further checks are deferred until these are resolved.
   - STOP. Do not run additional validations until the clarifications are addressed.

Only when no clarification markers are present, continue with the full validation below.

Story Context Analysis (Determine validation approach)
1) Identify story type from:
   - Story title and description patterns (e.g., "Development Environment", "Bootstrap", "Infrastructure", "Setup", "Foundation")
   - Primary User Story actor (developer vs end-user vs business user)
   - Functional requirement patterns (technical setup vs user features)
   - Project context from PRD (solo developer, MVP constraints, etc.)
2) Determine primary audience:
   - **Technical/Infrastructure Stories**: Developer is the primary stakeholder
   - **Business Feature Stories**: Non-technical stakeholders are primary
3) Select validation approach:
   - **Technical Stories**: Implementation details may be requirements when:
     - Establishing foundational architecture per Constitutional mandates
     - Integrating specific existing assets (e.g., lovable.ai prototype)
     - Meeting explicit technical requirements from architecture documents
   - **Feature Stories**: Strict WHAT/WHY separation applies

Scope and Sources
- Primary input: the provided `spec.md`.
- Sibling documents: evaluate only documents explicitly linked or cited by the spec within the same directory (e.g., relative links or named references). Do not scan unrelated files.
- Alignment references: CONSTITUTION.md (high‑level requirements), docs/prd.md, and docs/front-end-spec.md (when relevant).

Contextual Validation Criteria (Based on story type)

For Business Feature Stories (Default):
- Focuses on WHAT users need and WHY; avoids HOW (no tech stack, APIs, code, endpoints, schemas, or framework decisions).
- Written for business stakeholders; plain language; measurable success criteria.

For Technical/Infrastructure Stories:
- Technical specifics ARE acceptable as requirements when:
  - They implement Constitutional mandates (e.g., CLI interfaces, structured logging)
  - They establish foundational architecture that other stories depend on
  - They integrate specific existing assets that must be preserved
  - The developer IS the primary stakeholder (solo developer projects)
- Still requires: clear user value, testability, measurable success criteria
- Technology choices must be justified by architectural or Constitutional requirements
- Avoid unnecessary implementation details that don't affect outcomes

Common validation criteria (all story types):
- Template compliance (based on .specify/templates/spec-template.md):
  - Mandatory sections present and in the same order: User Scenarios & Testing; Requirements; Review & Acceptance Checklist; Execution Status. Include Key Entities only if data is involved.
  - User Scenarios: clear Primary User Story; ≥ 2 Given/When/Then acceptance scenarios; edge cases.
  - Functional Requirements: specific, testable, unambiguous; no hidden assumptions.
  - No "N/A" placeholders; remove non‑applicable sections entirely.
  - Execution Status and Review Checklist reflect actual state truthfully.
- Constitutional alignment (WHAT/WHY phrasing): when the feature touches auth/data/logging/error handling, ensure high‑level requirements exist (authn, RBAC, logging, encryption, input validation, safe errors) without prescribing implementation.
- PRD/front-end spec alignment (when relevant): consistent goals, scope, and user value.

Contextual HOW‑Leak Heuristics

For Business Feature Stories:
- Flag as violations: Technology names (frameworks, databases, cloud services), code blocks, endpoints (e.g., /api/*), schema/table definitions, class/module names, and implementation verbs ("implement X", "call API Y").

For Technical/Infrastructure Stories:
- Accept when justified: Technology names that are actual requirements per Constitution/architecture
- Still flag as violations: Code blocks, detailed schema definitions, class/module internals
- Evaluate context: Is this technology choice a requirement or an implementation detail?

Output Format
- Context Analysis: Story type identified, primary audience, validation approach applied, and rationale
- Summary: readiness recommendation (Draft | Ready for planning) and high‑level notes.
- Checklist Results: mirror the Review & Acceptance Checklist and Execution Status with pass/fail and brief rationale.
- Strengths: concise positives to preserve.
- Gaps & Risks: findings with severity (Critical | Major | Minor), rationale, and section references.
  - For technical stories: Note which technical specifics are justified vs unnecessary
- Proposed Improvements: concrete WHAT/WHY rewrites for representative issues (do not edit files).
- Open Questions: if any remain, list them explicitly (use the [NEEDS CLARIFICATION: …] format).
- Alignment Notes: PRD/front-end spec/Constitution consistency or conflicts.
- Traceability: quick mapping between FRs and acceptance scenarios; flag unmapped items.

Important
- Read‑only review. Make detailed proposals to improve the spec; do NOT modify files until instructed.
