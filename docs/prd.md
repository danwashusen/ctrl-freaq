# CRTL FreaQ Product Requirements Document (PRD)

## Goals and Background Context
### Goals
- Accelerate high-quality AI-assisted development by generating AI-optimized product and architecture documentation.
- Increase successful LLM-driven implementation rate via AI-ready Architecture specs for MVP projects.
- Reduce PR churn and rework caused by unclear requirements/architecture.
- Establish an MCP-native knowledge base (coding standards, patterns, decisions) to improve agent retrieval quality.
- Maintain near-zero baseline platform cost using AWS serverless.
- Deliver MVP outcomes: AI-optimized Architecture document; authenticated App Layout + Dashboard; conversational co-authoring; update existing documents; basic collaboration; quality gates and traceability.

### Background Context
CRTL FreaQ is an interactive system leveraging AI with human-in-the-loop flows to produce the documentation required to build software, from Product Brief document and PRD document through the Architecture document family (e.g., Frontend Architecture document, Backend Architecture document) and Front-End Spec document; it explicitly excludes Epics/Stories tooling. The MVP focuses on a deeply detailed, AI-optimized Architecture document (assuming Brief/PRD exist) and an authenticated App Layout with a Dashboard and basic Projects UI. An MCP server that allows LLMs to query authoritative product/architecture knowledge is deferred to Phase 2. Generated documents are intended inputs to Spec Kit or similar downstream tools.

The problem: experienced developers often deprioritize rigorous documentation, leading to inconsistent, low-quality LLM outputs and "vibe coding." Existing instruction-heavy LLM approaches produce variable results; static templates and scattered knowledge bases are not machine-consumable or MCP/query-friendly. CRTL FreaQ addresses this by enforcing structured, validated, machine-consumable artifacts and exposing them via MCP for deterministic grounding.

### Change Log
| Date       | Version | Description                 | Author |
|------------|---------|-----------------------------|--------|
| 2025-09-11 | 0.3     | Pivot to spec-driven documents; clarify export/frontmatter; de-scope MCP to Phase 2; enforce “document” terminology | PM     |
| 2025-09-10 | 0.2     | Align with Architecture: add FR11–FR13, authoring API notes, Phase 2 note, lifecycle/QA context/citation ACs | PM     |
| 2025-09-09 | 0.1     | Initial PRD draft created   | PM     |

## Requirements
### Functional (FR)
- FR1: Provide an Document Creation Flow that outputs a deeply detailed, AI-optimized Architecture document from existing Brief/PRD, including schema, cross-references, and decision logs.
- FR2: Offer section-aware conversational co-authoring to discuss and co-write content with the LLM during document creation; user must approve changes before they apply.
- FR3: Support Document QA Chat to discuss existing docs (explain, gap analysis, challenge) with citations to relevant sections and knowledge sources.
- FR4: Enable updating existing Architecture documents through guided steps or chat, with diff preview and changelog/version bump.
- FR5: Enforce quality gates (validation checks, acceptance checklist) and maintain a lightweight traceability matrix (requirements ↔ architecture components ↔ decisions).
- [Phase 2] FR6: Expose MCP read endpoints to query architecture, coding standards, patterns, and decisions; return structured, authoritative responses.
- [Phase 2] FR7: Allow registration/import of canonical knowledge sources (coding standards, patterns, ADRs) and reference them in outputs and MCP answers.
- FR8: Export as Markdown with frontmatter; write full Architecture document to `docs/architecture.md` and sharded sections to `docs/architecture/*.md`; idempotent/diff-aware with version markers and changelog.
- FR9: Provide basic multi-user concurrency for document editing (e.g., section locks or last-write-wins with conflict warnings).
- FR10: Developer-first UI in SvelteKit with guided steps, inline AI suggestions, and HITL approvals; AWS serverless backend with low/no base cost.
- FR11: Provide a decision aggressiveness policy for assumption resolution (Conservative | Balanced | YOLO) with per-section overrides; record the effective policy per decision in the audit log.
- FR12: Document QA chat supports selecting sections from the TOC as explicit context and a "Chat about selected" action; clicking citations navigates to and highlights the referenced ranges in the document.
- FR13: Expose section lifecycle with states and transitions (idle → assumptions → drafting → review → ready) visible in the UI.

### Non Functional (NFR)
- NFR1: Performance — TTFMP ≤ 2s on broadband; client P95 < 3s; server P95 ≤ 300ms.
- NFR2: Availability — 99.9% monthly (serverless baseline).
- NFR3: Scalability — Support ≥ 10 concurrent document sessions; [Phase 2] ≥ 100 MCP QPS baseline.
- NFR4: Security — Least-privilege IAM; user-provided LLM API keys; secrets stored in AWS SSM Parameter Store.
- NFR5: Privacy/Compliance — No regulated PII; SOC 2 aspirational and non-blocking for MVP.
- NFR6: Observability — Collect logs, metrics, and traces; [Phase 2] maintain MCP access audit logs.

### Terminology & Conventions
- When referring to a specific document, suffix with the word “document” (e.g., “Architecture document”, “PRD document”).
- NFR7: Cost — Baseline infra <$50/month; per-architecture generation variable costs track to brief targets.

## Scope
### In Scope (MVP)
- Document Creation Flow for an Architecture document (detailed, AI-optimized) from existing Brief/PRD.
- Section-aware conversational co-authoring during creation.
- Document QA chat on existing documents with citations.
- Update existing documents with diff preview and changelog/versioning.
- Quality gates and lightweight traceability matrix.
- Export/versioning to repo under `docs/` (Markdown + frontmatter), including sharded exports.
- Basic collaboration concurrency.

### Out of Scope (MVP)
- Epics/Stories management tooling.
- Full PRD/Brief generation flows beyond minimal capture for Architecture.
- Multi-tenant org/workspace management and SSO.
- Advanced analytics/dashboards, governance policies, workflow automations.
- Complex model routing/orchestration; custom plugin marketplace.
- Deep repo scanning/indexing across large monorepos (beyond targeted doc I/O).

### Phase 2 Note
- Introduce Project and Organization models with OrganizationMembership for multi-tenant access control; out of scope for MVP.
- Add MCP read endpoints and knowledge registry for querying documents/knowledge sources.

## Users and Stakeholders
- Primary Users: Senior/Staff+ Engineers and Tech Leads adopting AI-assisted development.
- Secondary Users: Engineering Managers / Platform Leads.
- Stakeholders: Product — Founder/PM; Engineering — Lead Eng (you) + AI Assistants; UX — interim; Security/Infra — interim.

## Success Metrics
- Time to first usable Architecture draft ≤ 60 minutes from kickoff.
- Revision cycles to “architecture approved” ≤ 2 iterations (MVP scope).
- Developers report ≥ 30% reduction in prompt crafting time using the spec.
- [Phase 2] MCP answer precision@1 ≥ 0.85 on seed architecture Q&A; ≥ 90% answer coverage.
- PR churn (LLM-output-related) ≤ 10% due to missing/ambiguous architecture.
- Cost: <$10/month baseline infra target; ≤ $0.25 per completed architecture draft variable cost at MVP scale.

## Technical & Constraints Summary
- Platform: Web (SvelteKit) desktop + mobile browsers; latest Chrome/Edge/Safari/Firefox.
- Frontend: SvelteKit + TypeScript; UI: Skeleton/Tailwind.
- Backend: MVP runs locally (SvelteKit + Node services). AWS serverless + Terraform move to Phase 2.
- Database: SQLite (MVP) with storage abstraction; migrate to DynamoDB in Phase 2.
- Authentication: Clerk (clerk.com) for MVP login/logout and basic profile.
- Monorepo: pnpm workspaces + Turborepo; docs under `docs/` with changelog/version markers.
- LLM Integration: OpenAI via Vercel AI SDK (ai-sdk.dev); user-provided API keys per account.
- Constraints: <$50/mo baseline; 6-week MVP; solo dev with AI assistants.
- Priority: Authoring flow is primary for MVP; MCP read endpoints deferred to Phase 2.
- Authoring API Endpoints (MVP): Versioned under `/api/v1/*` including `/api/v1/sections/[sectionId]/chat.read` (SSE), `/api/v1/sections/[sectionId]/proposals.generate` (SSE), `/api/v1/proposals/[proposalId]/apply`, `/api/v1/proposals/[proposalId]/reject`, `/api/v1/documents/[docId]/gates.run`, and `/api/v1/documents/[docId]/export`.
- Export format: Markdown + frontmatter; full document at `docs/architecture.md`; sharded sections under `docs/architecture/*.md`; manual export in MVP.

## Release Plan (6-week MVP)
- Week 1: Monorepo scaffold, auth decision, CI, infra baseline.
- Week 2: Doc schema + storage/versioning; quality gates checklist.
- Week 3: Architecture flow (core) + section-aware chat (read/write).
- Week 4: Spec Kit–aligned export polish; shard/export UX.
- Week 5: Update-existing-doc flow + collaboration basics; evaluation harness seed.
- Week 6: Hardening, KPIs wiring, docs, preview deploy.

## Epics (MVP)
- Epic 1: Foundation & Authenticated UI — Monorepo, CI, infra baseline; Clerk auth; authenticated App Layout with Dashboard; Personal Project foundation (single project per user) with minimal API/UI.
- Epic 2: Architecture Document Creation Flow + Conversational Co-Authoring — Guided architecture document steps with section-aware chat and approvals.
- Epic 3: Quality Gates, Traceability, Versioning — Validation checks, acceptance checklist, traceability matrix, export/versioning.
- Epic 4: Collaboration Basics & Update Existing Docs — Basic concurrency model and flows to open/edit existing docs with diff + changelog.

<!-- Detailed epic stories will be elaborated interactively in subsequent steps. -->

## Epic 1 Details — Foundation & Authenticated UI
### Goal
Establish monorepo, CI, local dev runtime, and minimal auth via Clerk, then deliver an authenticated two‑column App Layout with a Dashboard and basic Projects UI — all runnable locally for MVP. MCP server and knowledge registry are deferred to Phase 2.

### Stories
1) Monorepo Scaffold (pnpm + Turborepo)
- AC1: Repo contains `apps/web`, `services/mcp`, `packages/*`, `infra/` (placeholder), `docs/*`.
- AC2: pnpm workspaces configured; Turbo pipelines for lint, type-check, build.
- AC3: Dev scripts run locally for web and mcp services.

2) CI Pipeline Setup
- AC1: GitHub Actions workflow runs on PR and main.
- AC2: Jobs: lint, type-check, build; status checks required on PR merge.
- AC3: Artifact/summary includes basic metrics (duration, warnings).

3) Authentication with Clerk (MVP)
- AC1: Clerk integrated for login/logout in web app using dev keys.
- AC2: Authenticated-only access to authoring features.
- AC3: Minimal user profile persisted (ID, provider, email) and displayed.

4) Authenticated App Layout + Dashboard
- AC1: Two-column authenticated layout behind Clerk.
  - Left column: Sidebar with a "Projects" group listing the user’s projects sorted by name; selecting a project sets/reflects `activeProjectId`.
  - Right column: Main content area routed to `/dashboard` by default.
- AC2: Dashboard route shows h1 "Dashboard" and a two-column content layout:
  - Column 1: Project List component showing the user’s projects (MVP: single "My Project"), sorted by name.
    - Each item shows: name, summary, stacked member avatars (MVP: just the 1 user), and "last modified at/by" (MVP: display "—/N/A").
  - Column 2: Recent Activity component summarizing recent document changes across the user’s projects.
    - MVP empty state: "No recent activity yet".
- AC3: Data sourced from Personal Project Bootstrap + Projects API; avatars from Clerk profile data where available.
- AC4: Basic responsive behavior; layout aligns with coding standards; empty states included.

Note: Terraform/AWS infra bootstrap is deferred to Phase 2 per MVP local-only constraint. MCP server, knowledge registry, MCP read endpoints, and MCP observability moved to Phase 2.

## Epic 2 Details — Architecture Document Creation Flow + Conversational Co-Authoring
### Goal
Deliver a guided authoring flow for an AI-optimized Architecture document with section-aware chat, proposal diffs, approval gating, and traceability — all running locally with Clerk auth. Provide near real-time streamed responses in the UI; for production (Phase 2) use AWS Lambda Response Streaming over HTTPS.

### Stories
1) Architecture Schema & Validation
- AC1: JSON schema defines sections/fields, required/optional, and types.
- AC2: Runtime validation enforces schema in UI and on save/export.
- AC3: Schema version recorded in doc metadata.

2) Authoring Wizard (Guided Flow + Assumptions Resolution)
- AC1: Stepper UI with save/resume; section statuses (draft/ready).
- AC2: Field-level validation messages; cannot publish with blockers.
- AC3: Draft persists locally (SQLite) under user account (Clerk).
- AC4: Comprehensive “Resolve Assumptions” process before drafting each section: per-assumption status (✅/❔/❌), focused Q&A/options, explicit approvals, and a final ordered assumptions list captured to metadata.
 - AC5: Section lifecycle states and transitions: idle → assumptions → drafting → review → ready; transitions are visible in the UI.

3) Section-Aware Context Builder
- AC1: Context includes current section, approved prior sections, and selected knowledge items; token budget limits applied.
- AC2: Redacts secrets; adds doc/section IDs for grounding.
- AC3: Configurable model params via Vercel AI SDK.
 - AC4: User can select sections from the TOC as explicit context; a "Chat about selected" action opens/updates the Document QA panel with those sections.

4) Conversational Co‑Authoring (Read)
- AC1: Section-scoped chat can “explain, outline, suggest” without writing.
- AC2: Responses include citations to doc sections and knowledge sources.
- AC3: [Phase 2] Chat transcript stored with section (user, timestamp, refs).

5) Conversational Co‑Authoring (Write Proposals)
- AC1: Chat can propose edits; diff preview shows insertions/deletions.
- AC2: User must approve to apply; decline discards with reason.
- AC3: On approve, draft updated and changelog entry added.

6) Streaming UX for Near Real-Time Responses
- AC1: UI renders streamed model output incrementally with <300ms time-to-first-chunk in local dev.
- AC2: Local dev uses Node streams/SSE or Web Streams; Phase 2 production targets AWS Lambda Response Streaming over HTTPS.
- AC3: Graceful fallback to non-streamed responses retains functional parity.

7) Citations & Traceability
- AC1: Each applied AI change records source refs (doc sections, knowledge IDs).
- AC2: Traceability matrix updates links: requirement ↔ section ↔ decision.
- AC3: View renders back-links from sections to cited sources.
 - AC4: Clicking a citation navigates to and highlights the referenced range in the document when available.

8) Export to Markdown + Versioning
- AC1: Export renders full doc to `docs/architecture.md`; sharded sections to `docs/architecture/*.md` (e.g., `docs/architecture/introduction.md`).
- AC2: Includes version header, schema version, and changelog delta.
- AC3: Idempotent export (unchanged content yields no diff).

9) Quality Gates & Pre‑Publish Checklist
- AC1: Checklist runs blockers/non-blockers; shows pass/fail summary.
- AC2: Blockers prevent publish; non-blockers logged.
- AC3: Publish action records QA snapshot.

10) Collaboration Hooks (MVP)
- AC1: Section “editing by <user>” indicator using Clerk identity.
- AC2: Conflict warning if another save occurs within 30s window.
- AC3: Events logged for potential upgrade in Epic 4.

## Epic 3 Details — Quality Gates, Traceability, Versioning
### Goal
Ensure documents meet AI-ready standards before publish, maintain traceability, and manage versions/diffs reliably.

### Stories
1) Quality Gates Definition
- AC1: Define checklist with blocker/non-blocker items (schema completeness, citations present, assumptions resolved, no TODOs).
- AC2: Each gate has severity, rationale, and auto-check where possible.
- AC3: Gates configurable by project; defaults provided.

2) Validation Engine
- AC1: Run gates on-demand and pre-publish; show pass/fail with details.
- AC2: Blockers prevent publish; non-blockers logged for follow-up.
- AC3: Export QA snapshot (JSON) stored with doc version.

3) Traceability Matrix (Minimal)
- AC1: Model links requirement ↔ architecture section ↔ decision/knowledge item.
- AC2: UI view shows forward/back-links; CSV/JSON export.
- AC3: Links updated automatically when AI proposals are applied.

4) Versioning & Changelog
- AC1: Doc metadata includes version, schema version, generated timestamp, author.
- AC2: On publish, bump version and write changelog entry (why/what).
- AC3: Diff view shows line-level and section-level changes.

5) Commit/Export Integration
- AC1: Export uses full path docs/architecture.md and shards docs/architecture/*.md.
- AC2: Idempotent export: unchanged content produces no diff.
- AC3: Commit message template generated (local dev workflow).

6) Evaluation Hook for Gates
- AC1: Optional integration to run a small eval set (precision@1 on key Q&A).
- AC2: Thresholds configurable; results attached to QA snapshot.
- AC3: Failures flagged as non-blockers in MVP (informational).

## Epic 4 Details — Collaboration Basics & Update Existing Docs
### Goal
Let users open, review, and update existing docs safely with basic concurrency protection and clear diffs.

### Stories
1) Open Existing Doc
- AC1: Load docs/architecture.md (and shards) into structured model.
- AC2: Show section mapping status; highlight unmapped/unknown blocks.
- AC3: Migration step if schema version changed (preview + apply).

2) Edit Existing Sections
- AC1: Edit in wizard or via chat proposals; always diff-preview before apply.
- AC2: Approved changes update draft and changelog.
- AC3: Re-run quality gates on changed sections.

3) Concurrency Basics
- AC1: Section “editing by <user>” indicator from Clerk identity.
- AC2: Warn on potential conflicts (save within 30s window); offer merge view.
- AC3: Last-write-wins with conflict warning; events logged.

4) Comments/Annotations (MVP-lite)
- AC1: Add per-section notes (author, timestamp).
- AC2: Notes are non-blocking and export-excluded.
- AC3: Notes included in QA snapshot context (internal only).

5) Audit & Activity Log
- AC1: Record who changed what, when, and why (commit-like entry).
- AC2: Include source (wizard vs. chat proposal).
- AC3: Activity filterable by section and user.

6) Publish Updated Doc
- AC1: Re-export full and shards; preserve stable anchors/IDs.
- AC2: Version bump with migration note; QA snapshot attached.
- AC3: Post-publish summary view with links to diffs.
