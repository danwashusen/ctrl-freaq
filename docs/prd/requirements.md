# Requirements
## Functional (FR)
- FR1: Provide an Document Creation Flow that outputs a deeply detailed, AI-optimized Architecture document from existing Brief/PRD, including schema, cross-references, and decision logs.
- FR2: Offer section-aware conversational co-authoring to discuss and co-write content with the LLM during document creation; user must approve changes before they apply.
- FR3: Support Document QA Chat to discuss existing docs (explain, gap analysis, challenge) with citations to relevant sections and knowledge sources.
- FR4: Enable updating existing Architecture documents through guided steps or chat, with diff preview and changelog/version bump.
- FR5: Enforce quality gates (validation checks, acceptance checklist) and maintain a lightweight traceability matrix (requirements ↔ architecture components ↔ decisions).
- FR6: Expose MCP read endpoints to query architecture, coding standards, patterns, and decisions; return structured, authoritative responses.
- FR7: Allow registration/import of canonical knowledge sources (coding standards, patterns, ADRs) and reference them in outputs and MCP answers.
- FR8: Export documentation to repository (markdown under `docs/`) with version markers and changelog; support diff-aware updates.
- FR9: Provide basic multi-user concurrency for document editing (e.g., section locks or last-write-wins with conflict warnings).
- FR10: Developer-first UI in SvelteKit with guided steps, inline AI suggestions, and HITL approvals; AWS serverless backend with low/no base cost.
- FR11: Provide a decision aggressiveness policy for assumption resolution (Conservative | Balanced | YOLO) with per-section overrides; record the effective policy per decision in the audit log.
- FR12: Document QA chat supports selecting sections from the TOC as explicit context and a "Chat about selected" action; clicking citations navigates to and highlights the referenced ranges in the document.
- FR13: Expose section lifecycle with states and transitions (idle → assumptions → drafting → review → ready) visible in the UI.

## Project (RQ-PROJ)
- RQ-PROJ-01: Each user has exactly one personal project auto-created on first login; rename allowed; delete not available in MVP.
- RQ-PROJ-02: All architecture documents and knowledge registry entries include `projectId` and are filtered by the active project in all list/read APIs.

## Non Functional (NFR)
- NFR1: Performance — TTFMP ≤ 2s on broadband; client P95 < 3s; server P95 ≤ 300ms.
- NFR2: Availability — 99.9% monthly (serverless baseline).
- NFR3: Scalability — Support ≥ 10 concurrent document sessions; ≥ 100 MCP QPS baseline.
- NFR4: Security — Least-privilege IAM; user-provided LLM API keys; secrets stored in AWS SSM Parameter Store.
- NFR5: Privacy/Compliance — No regulated PII; SOC 2 aspirational and non-blocking for MVP.
- NFR6: Observability — Collect logs, metrics, and traces; maintain MCP access audit logs.
- NFR7: Cost — Baseline infra <$50/month; per-architecture generation variable costs track to brief targets.
