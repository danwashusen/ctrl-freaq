# Project Brief: CRTL FreaQ

## Executive Summary
- Concept: CRTL FreaQ is an interactive system that uses AI with human-in-the-loop flows to generate the core documentation needed to build software, from Product Brief document and PRD document through the Architecture document family (e.g., Frontend Architecture document, Backend Architecture document) and Front-End Spec document; it explicitly excludes Epics/Stories tooling. The MVP focuses on producing a highly detailed, AI-optimized Architecture document (assuming the Brief document and PRD document exist) and an authenticated App Layout with a Dashboard and basic Projects UI. Documents export as Markdown with frontmatter to `docs/architecture.md` and sharded `docs/architecture/*.md` for downstream tools like Spec Kit. An MCP server to query product/architecture knowledge (coding standards, patterns, etc.) is deferred to Phase 2.
- Problem: Experienced developers often skip rigorous documentation, leading to inconsistent, low-quality LLM outputs and “vibe coding”.
- Target market: Senior/staff+ engineers and tech leads adopting AI-assisted development who want predictable, higher-quality LLM output.
- Value proposition: Accelerate high-quality AI-assisted development by generating AI-optimized product and architecture documentation, reducing manual effort and improving LLM output quality.

## Problem Statement
### Current State and Pain Points
- Documentation is deprioritized; PRD documents/Architecture documents rarely exist in an LLM-ready form, so prompts lack structure and grounding.
- Ad‑hoc prompting and “vibe coding” yield inconsistent outputs; no canonical, MCP‑queryable knowledge base (coding standards, patterns, decisions).
- Tribal knowledge is scattered across Notion/Confluence/READMEs and becomes stale; hard for humans or LLMs to find and trust.
- No guided flows to produce AI‑optimized documents; high cognitive load and tool friction cause developers to skip the work.

### Impact
- Time waste: 3–6 hours/week per engineer lost to prompt crafting, re‑contextualizing, and chasing decisions due to missing LLM‑ready docs.
- PR churn: 20–40% of PRs require rework or restarts from unclear/misaligned architecture; adds 1–3 extra review cycles.
- Lead time delays: Kickoff to first viable architecture spec often takes 2–5 days; features slip 1–2 sprints when architecture isn’t solid.
- Defect leakage: 10–20% of bugs stem from requirements/architecture misunderstandings that better specs would prevent.
- Onboarding drag: New contributors spend 2–5 days discovering standards/patterns, leading to inconsistent outputs and slow ramp.

### Why Existing Solutions Fall Short
- Pure LLM-driven methods (e.g., instruction-heavy workflows) rely on unpredictable instruction handling; output varies despite consistent intent and context.
- Static templates and prompt libraries don’t enforce structured, machine-consumable artifacts; results aren’t LLM-ready specs and drift over time.
- Existing knowledge bases (Confluence/Notion/READMEs) aren’t MCP/query-friendly; retrieval for LLMs is unreliable and stale.
- Few tools provide guided, human‑in‑the‑loop flows and quality gates to produce deterministic documentation that LLMs can reliably consume.

### Urgency
- Market timing: AI-assisted development is accelerating; teams that standardize now set the internal bar and reap compounding gains.
- Cost of rework: Inconsistent LLM outputs create escalating rework and PR churn; each sprint of “vibe coding” adds avoidable debt.
- Ecosystem shift: MCP/agent patterns are emerging; being MCP-native early creates leverage for tooling and integrations.
- Model volatility: Rapid model changes increase output variance; structured, machine-consumable specs hedge against drift.

## Proposed Solution
- Core concept and approach: Provide guided, human-in-the-loop flows that produce AI-optimized, machine-consumable artifacts across the lifecycle (Product Brief document → PRD document → Front-End Spec document → Architecture document; Epics/Stories tooling excluded). Artifacts use structured schemas, cross-references, and quality gates so LLMs can reliably ground on them. MVP provides manual export (Markdown + frontmatter) to `docs/architecture.md` and sharded sections under `docs/architecture/*.md` for downstream tools like Spec Kit. In Phase 2, an MCP server will expose product knowledge (coding standards, decisions, patterns) via queryable interfaces for agents/LLMs.
- Key differentiators:
  - AI-optimized documentation structure with validation and traceability instead of freeform notes/templates.
  - (Phase 2) MCP-native knowledge access so LLMs can answer with authoritative, up-to-date context.
  - Developer-first UX with deterministic flows to reduce cognitive load and eliminate “vibe coding”.
- MVP focus on a deeply detailed Architecture document designed to guide high-quality LLM code generation.
- Why this will succeed: It removes the biggest friction for senior developers—creating and maintaining LLM-ready specs—while delivering predictable outputs through structured flows and MCP access. Early grounding in MCP/agent patterns and opinionated quality gates produce consistent, higher-quality code outcomes.
- High-level vision: A unified, interactive UI that converts ideas into executable specs, keeps artifacts in sync, and closes the loop with LLMs via MCP. Over time, expand from Architecture-first to full PRD document/Architecture document/Front-End Spec document orchestration with analytics, governance, and seamless monorepo integration.

## Target Users
### Primary User Segment: Senior/Staff+ Engineers and Tech Leads
- Profile: Experienced builders responsible for architectural direction, code quality, and team velocity; pragmatic, tool-savvy, prefer low-friction workflows.
- Behaviors/Workflows: Move fast, prototype often, dislike heavy process; maintain monorepos, enforce standards via CI; increasingly use LLMs but distrust inconsistent outputs.
- Needs/Pain Points: LLM-ready specs, canonical architecture knowledge, deterministic prompts, low cognitive overhead, traceability from decisions to code.
- Goals: Faster high-quality delivery with predictable LLM output; reduced rework/PR churn; institutionalize best practices without slowing momentum.

### Secondary User Segment: Engineering Managers / Platform Leads
- Profile: Leaders accountable for velocity, reliability, and standards across teams; balance autonomy with governance and cost control.
- Behaviors/Workflows: Define golden paths, manage CI/CD and platform tooling, standardize templates/patterns, evaluate/prioritize internal dev tools.
- Needs/Pain Points: Consistent, AI-ready specs across teams; enforceable standards without heavy process; measurable quality signals; low/no base cost; AWS serverless alignment.
- Goals: Faster delivery at lower variance; reduce rework/PR churn; institutionalize architecture decisions; simplify onboarding and cross-team knowledge sharing.

## Goals & Success Metrics
### Business Objectives
- Increase successful LLM-driven implementation rate by producing AI-ready Architecture specs for MVP projects.
- Reduce PR churn and rework driven by unclear requirements/architecture.
- Establish MCP-native product/architecture knowledge base to improve agent retrieval quality.
- Keep platform costs near-zero at rest using AWS serverless.

### User Success Metrics
- Time to first usable Architecture draft ≤ 60 minutes from kickoff.
- Revision cycles to “architecture approved” ≤ 2 iterations for MVP scope.
- Developers report ≥ 30% reduction in prompt crafting time when building features off the spec.
- MCP queries answer rate with authoritative sources ≥ 90%.

### KPIs
- Draft-to-approve conversion: ≥ 70% of architecture drafts approved within 2 business days.
- PR churn (LLM-output-related): ≤ 10% of PRs require rework due to missing/ambiguous architecture.
- MCP answer precision@1: ≥ 0.85 on internal eval set of architecture questions.
- Cost: <$10/month baseline infra; <$0.25 per completed architecture draft in variable costs at MVP usage scale.

## MVP Scope
### Core Features (Must Have)
- Document Creation Flow (MVP): Guided, human-in-the-loop flow that outputs a deeply detailed, AI-optimized Architecture document from existing Brief/PRD; includes schema, cross-references, and decision logs.
- Conversational Co‑Authoring (section-aware chat): Discuss and co-write with the LLM during document creation; section-scoped context, suggested drafts/edits, inline citations to fields; user approves before changes apply.
- Document QA Chat: Discuss existing docs with the LLM at any time (“explain X”, “what’s missing?”, “challenge Y”); answers cite relevant doc sections and knowledge sources.
- Update Existing Documents: Open an existing Architecture doc, apply targeted edits through guided steps or chat; show diff preview, record changelog/version bump.
- Quality Gates & Traceability: Validation checks, acceptance checklist, and a lightweight traceability matrix (requirements ↔ architecture components ↔ decisions).
- MCP Server (Read APIs): MCP-native endpoints to query architecture, coding standards, patterns, and decisions; returns structured, authoritative responses.
- Knowledge Sources: Register/import canonical docs (coding standards, patterns, ADRs) and reference them in outputs and MCP answers.
- Export & Versioning: Markdown export to repo with version markers and changelog; simple diff-aware updates.
- Developer-first UI: SvelteKit UI with guided steps, inline AI suggestions, and HITL approvals; AWS serverless backend (low/no base cost).
- Collaboration: Basic multi-user concurrency for document editing (e.g., section locks or last-write-wins with conflict warnings).

### Out of Scope (MVP)
- Full PRD/Brief generation flows (beyond minimal capture for Architecture).
- Multi-tenant org/workspace management and SSO.
- Advanced analytics/dashboards, governance policies, or workflow automations.
- Complex model routing/orchestration; custom plugin marketplace.
- Deep repo scanning/indexing across large monorepos (beyond targeted doc I/O).

### MVP Success Criteria
- Produce an AI-optimized Architecture doc meeting the checklist within ≤ 60 minutes of kickoff.
- Architecture doc used to guide an LLM to implement a reference feature with ≤ 10% PR churn attributable to missing/ambiguous architecture.
- MCP answer precision@1 ≥ 0.85 on a seed set of architecture questions; ≥ 90% answer coverage.
- Baseline infra <$10/month; per-architecture generation cost ≤ $0.25 at MVP scale.

## Post-MVP Vision
### Phase 2 Features
- PRD/Brief Flows: Guided, assumption‑resolution flows for PRD/Brief; keep Architecture in sync via traceability and change proposals.
- Stories/Epics + Test Design: Generate epics/stories with acceptance criteria and Gherkin; link to architecture components; auto‑draft test plans.
- MCP Write APIs + Proposals: Add write endpoints and “proposed change” workflow with diff previews, reviews, and audit history.
- IDE Integrations: VS Code/JetBrains extensions to query MCP, insert spec‑aligned snippets, and raise/resolve doc gaps from code.
- Repo Indexing & Diagrams: Targeted code/doc indexing, embeddings, and architecture diagram exports (PlantUML/Mermaid/OpenAPI) kept in sync; include diagram rendering and ingest.
- Evaluation Harness: Prompt tests, golden datasets, offline evals across models; regressions gated by measurable quality signals.

### Long‑term Vision
- Closed‑Loop Delivery: From idea→spec→code→tests with agents grounded on MCP; human approval gates; deterministic spec‑to‑code pipelines.
- Enterprise Governance: RBAC, policy packs, compliance mapping (e.g., SOC2), review workflows, and full auditability.
- Knowledge Graph: Cross‑repo/domain graph of decisions, components, patterns; query paths and impact analysis.
- Agentic Execution: Task‑specific agents that implement features against Architecture, open PRs, and reference MCP for justification.
- Ecosystem & Marketplace: Domain templates, integrations, and community packs for rapid adoption across industries.

### Expansion Opportunities
- Verticals & Domain Packs: Fintech, commerce, data/ML, and regulated domains with pre‑tuned templates and policies.
- Partnerships/Integrations: GitHub/Atlassian, AWS serverless stack, model providers, observability (Datadog), eval tooling (LangSmith).
- Premium/Enterprise: SSO, multi‑workspace/orgs, analytics, SLAs, private deployments; training and enablement offerings.
- SDK & Extensibility: Plugin/SDK to define custom schemas, MCP endpoints, and organization‑specific quality gates.

## Technical Considerations
### Platform Requirements
- **Target Platforms:** Web (SvelteKit) desktop + mobile browsers
- **Browser/OS Support:** Latest Chrome/Edge/Safari/Firefox
- **Performance Requirements:** TTFMP ≤ 2s on broadband; client P95 < 3s; server P95 ≤ 300ms

### Technology Preferences
- **Frontend:** SvelteKit + TypeScript; UI: Skeleton/Tailwind
- **Backend:** Local MVP (SvelteKit + Node). Phase 2: AWS serverless (API Gateway/Lambda, Node 20)
- **Database:** SQLite (MVP). Phase 2: DynamoDB
- **Hosting/Infrastructure:** Local MVP; Phase 2: AWS with IaC via Terraform; monorepo with pnpm workspaces + Turborepo
- **LLM Integration:** OpenAI via Vercel AI SDK (ai-sdk.dev)

-### Architecture Considerations
- **Repository Structure:** apps/web, packages/* (shared), docs/*; services/mcp and infra/terraform planned for Phase 2
- **Service Architecture:** Web authoring/chat/export (MVP); [Phase 2] MCP read APIs; storage for documents/indices; auth boundary
- **Integration Requirements:** GitHub (repo access), CI (checks, previews)
- **Security/Compliance:** Least‑privilege IAM; secrets via SSM; [Phase 2] audit logs on MCP access; SOC 2 aspirational

## Constraints & Assumptions
### Constraints
- **Budget:** <$50/mo baseline
- **Timeline:** 6 weeks MVP target
- **Resources:** Solo dev with AI assistants
- **Technical:** Local MVP (SvelteKit + Node, SQLite); TypeScript; monorepo. Phase 2: AWS serverless + Terraform

## Risks & Open Questions
### Key Risks
- Adoption friction: Senior devs may resist perceived process overhead despite HITL chat.
- Output quality drift: LLM hallucination/model changes could degrade doc quality; requires validations/evals.
- UX complexity: Section-aware chat + guided flows can overwhelm if not streamlined.
- Consistency/sync: Keeping docs, MCP answers, and knowledge sources aligned across edits.
- Cost variance: Model usage may exceed <$50/mo baseline if flows are chat-heavy.
- Security: Exposing architecture via MCP must avoid data leakage; auth/authorization must be tight.
- Key management: Each account provides their own LLM API keys initially; onboarding and support complexity, secret handling risk.

-### Open Questions
- MCP schemas/endpoints in Phase 2: which entities (documents, sections, decisions, standards)?
- Auth model: GitHub OAuth vs. email magic link vs. local?
- Collaboration: Decision — basic multi-user concurrency in MVP.
- LLM provider: Decision — OpenAI ChatGPT abstraction via ai-sdk.dev.
- Evaluation plan: What golden set and thresholds for MCP precision and doc QA?
- Diagramming: Decision — include Mermaid/PlantUML rendering and ingest in Phase 2.

-### Areas Needing Further Research
- Architecture document formats that maximize downstream code quality (comparative review).
- Best practices for section-aware conversational editing and diff application.
- MCP server frameworks/SDKs and hosting patterns on AWS serverless.
- Cost modeling of chat/co-authoring flows across model providers.
- Minimal yet effective traceability matrix for MVP.

## Appendices
-### A. Research Summary
- Market research: Initial ideas captured; formal market study TBD.
- Competitive analysis: Pure LLM/instruction-heavy methods show output variance; formal competitive deep-dive TBD.
- User interviews: Early signals from experienced devs frustrated with “vibe coding”; structured interviews TBD.
- Technical feasibility: Local MVP (SvelteKit + SQLite) viable; Phase 2 AWS serverless + DynamoDB feasible; OpenAI via Vercel AI SDK; MCP read APIs feasible; budget target appears achievable at MVP scale.

### B. Stakeholder Input
- Founder constraints: AWS serverless, TypeScript, SvelteKit, monorepo, Terraform; <$50/mo baseline; 6‑week MVP; solo dev with AI assistants.
- Audience focus: Senior/Staff+ developers and Tech Leads adopting AI‑assisted development.

### C. References
- OpenAI via Vercel AI SDK — https://ai-sdk.dev/docs/introduction
- SvelteKit — https://kit.svelte.dev
- Tailwind CSS — https://tailwindcss.com
- Skeleton UI — https://www.skeleton.dev
- AWS Lambda — https://aws.amazon.com/lambda/
- Amazon DynamoDB — https://aws.amazon.com/dynamodb/
- Model Context Protocol — https://modelcontextprotocol.io
- Terraform — https://www.terraform.io/

## Next Steps
### Immediate Actions
1. Finalize Problem “Impact” metrics and complete that section.
2. Define MVP Architecture document schema (sections, fields, validations).
3. Implement export writer: Markdown + frontmatter; full document at `docs/architecture.md`; shards at `docs/architecture/*.md`; idempotent export.
4. Decide auth approach (GitHub OAuth vs. magic link) and spike if needed.
5. Scaffold monorepo: `apps/web`, `packages/*`, `docs/*`. Phase 2: add `services/mcp`, `infra/terraform`.
6. Integrate Vercel AI SDK for section‑aware conversational co‑authoring.
7. Implement document storage + versioning strategy (Markdown in `docs/`, changelog/version markers).
8. Build quality gates checklist and lightweight traceability matrix; add gates to validate frontmatter on export.
9. Configure CI (lint, type‑check, build; optional preview deploy).
10. Create evaluation harness for document QA; Phase 2: MCP precision/coverage.

-### PM Handoff
This Project Brief provides the full context for CRTL FreaQ. Please start in “PRD Generation Mode”, review the brief thoroughly, and work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.

-### Key Assumptions
- Brief document and PRD document are available (or minimally captured) and serve as inputs to the MVP Architecture document flow.
- Local MVP development environment available; Phase 2 introduces AWS serverless; Node 20 support assumed in target regions; low/no baseline cost is acceptable.
- Access to chosen LLM(s) for drafting/co‑authoring; MCP server is Phase 2; no offline requirement.
- Monorepo uses pnpm workspaces + Turborepo with GitHub Actions CI; documentation lives under `docs/` with git/changelog versioning.
- No regulated PII processed; logs/telemetry are non‑sensitive; SOC 2 is aspirational and not a blocker for MVP.
