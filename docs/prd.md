# CRTL FreaQ Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Accelerate high-quality AI-assisted development by generating AI-optimized
  product and architecture documentation.
- Increase successful LLM-driven implementation rate via AI-ready Architecture
  specs for MVP projects.
- Reduce PR churn and rework caused by unclear requirements/architecture.
- Maintain near-zero baseline platform cost using AWS serverless.
- Deliver MVP outcomes: AI-optimized Architecture document; authenticated App
  Layout + Dashboard; conversational co-authoring; update existing documents;
  basic collaboration; quality gates and traceability.

### Background Context

CRTL FreaQ is an interactive system leveraging AI with human-in-the-loop flows
to produce the documentation required to build software, from Product Brief
document and PRD document through the Architecture document family (e.g.,
Frontend Architecture document, Backend Architecture document) and Front-End
Spec document; it explicitly excludes Epics/Stories tooling. The MVP focuses on
a deeply detailed, AI-optimized Architecture document (assuming Brief/PRD exist)
and an authenticated App Layout with a Dashboard and basic Projects UI.
Generated documents are intended inputs to Spec Kit or similar downstream tools.

The problem: experienced developers often deprioritize rigorous documentation,
leading to inconsistent, low-quality LLM outputs and "vibe coding." Existing
instruction-heavy LLM approaches produce variable results; static templates and
scattered knowledge bases are not machine-consumable. CRTL FreaQ addresses this
by enforcing structured, validated, machine-consumable artifacts for
deterministic grounding.

### Change Log

| Date       | Version | Description                                                                                                                                                     | Author |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2025-09-12 | 0.5     | Expand Epic 1 Story 1 scope to include full development environment bootstrap with frontend (lovable.ai prototype), backend, libraries, and test infrastructure | PM     |
| 2025-09-12 | 0.4     | Add Core Document Editor Workflow section with 8-step process, section state machine, user interaction flow, and technical implementation details               | PM     |
| 2025-09-11 | 0.3     | Pivot to spec-driven documents; clarify export/frontmatter; enforce "document" terminology                                                                      | PM     |
| 2025-09-10 | 0.2     | Align with Architecture: add FR11–FR13, authoring API notes, lifecycle/QA context/citation ACs                                                                  | PM     |
| 2025-09-09 | 0.1     | Initial PRD draft created                                                                                                                                       | PM     |

## Requirements

### Functional (FR)

- FR1: Provide an Document Creation Flow that outputs a deeply detailed,
  AI-optimized Architecture document from existing Brief/PRD, including schema,
  cross-references, and decision logs.
- FR2: Offer section-aware conversational co-authoring to discuss and co-write
  content with the LLM during document creation; user must approve changes
  before they apply.
- FR3: Support Document QA Chat to discuss existing docs (explain, gap analysis,
  challenge) with citations to relevant sections and knowledge sources.
- FR4: Enable updating existing Architecture documents through guided steps or
  chat, with diff preview and changelog/version bump.
- FR5: Enforce quality gates (validation checks, acceptance checklist) and
  maintain a lightweight traceability matrix (requirements ↔ architecture
  components ↔ decisions).
- FR8: Export as Markdown with frontmatter; write full Architecture document to
  `docs/architecture.md` and sharded sections to `docs/architecture/*.md`;
  idempotent/diff-aware with version markers and changelog.
- FR9: Provide basic multi-user concurrency for document editing (e.g., section
  locks or last-write-wins with conflict warnings).
- FR10: Developer-first UI in React with Express.js API, guided steps, inline AI
  suggestions, and HITL approvals; low/no base cost local development.
- FR11: Provide a decision aggressiveness policy for assumption resolution
  (Conservative | Balanced | YOLO) with per-section overrides; record the
  effective policy per decision in the audit log.
- FR12: Document QA chat supports selecting sections from the TOC as explicit
  context and a "Chat about selected" action; clicking citations navigates to
  and highlights the referenced ranges in the document.
- FR13: Expose section lifecycle with states and transitions (idle → assumptions
  → drafting → review → ready) visible in the UI.

### Non Functional (NFR)

- NFR1: Performance — TTFMP ≤ 2s on broadband; client P95 < 3s; server P95 ≤
  300ms.
- NFR2: Availability — 99.9% monthly (serverless baseline).
- NFR3: Scalability — Support ≥ 10 concurrent document sessions.
- NFR4: Security — Least-privilege IAM; user-provided LLM API keys; secrets
  stored in AWS SSM Parameter Store.
- NFR5: Privacy/Compliance — No regulated PII; SOC 2 aspirational and
  non-blocking for MVP.
- NFR6: Observability — Collect logs, metrics, and traces.

### Terminology & Conventions

- When referring to a specific document, suffix with the word “document” (e.g.,
  “Architecture document”, “PRD document”).
- NFR7: Cost — Baseline infra <$50/month; per-architecture generation variable
  costs track to brief targets.

## Scope

### In Scope (MVP)

- Document Creation Flow for an Architecture document (detailed, AI-optimized)
  from existing Brief/PRD.
- Section-aware conversational co-authoring during creation.
- Document QA chat on existing documents with citations.
- Update existing documents with diff preview and changelog/versioning.
- Quality gates and lightweight traceability matrix.
- Export/versioning to repo under `docs/` (Markdown + frontmatter), including
  sharded exports.
- Basic collaboration concurrency.

### Out of Scope (MVP)

- Epics/Stories management tooling.
- Full PRD/Brief generation flows beyond minimal capture for Architecture.
- Multi-tenant org/workspace management and SSO.
- Advanced analytics/dashboards, governance policies, workflow automations.
- Complex model routing/orchestration; custom plugin marketplace.
- Deep repo scanning/indexing across large monorepos (beyond targeted doc I/O).

## Users and Stakeholders

- Primary Users: Senior/Staff+ Engineers and Tech Leads adopting AI-assisted
  development.
- Secondary Users: Engineering Managers / Platform Leads.
- Stakeholders: Product — Founder/PM; Engineering — Lead Eng (you) + AI
  Assistants; UX — interim; Security/Infra — interim.

## Success Metrics

- Time to first usable Architecture draft ≤ 60 minutes from kickoff.
- Revision cycles to “architecture approved” ≤ 2 iterations (MVP scope).
- Developers report ≥ 30% reduction in prompt crafting time using the spec.
- PR churn (LLM-output-related) ≤ 10% due to missing/ambiguous architecture.
- Cost: <$10/month baseline infra target; ≤ $0.25 per completed architecture
  draft variable cost at MVP scale.

## Technical & Constraints Summary

- Platform: Web (React) desktop + mobile browsers; latest
  Chrome/Edge/Safari/Firefox.
- Frontend: React + TypeScript; UI: shadcn/ui/Tailwind.
- Backend: Local Express.js API server.
- Database: SQLite for local development.
- Authentication: Clerk (clerk.com) for MVP login/logout and basic profile.
- Monorepo: pnpm workspaces + Turborepo; docs under `docs/` with
  changelog/version markers.
- LLM Integration: OpenAI via Vercel AI SDK (ai-sdk.dev); user-provided API keys
  per account.
- Constraints: <$50/mo baseline; 6-week MVP; solo dev with AI assistants.
- Priority: Authoring flow is primary focus for MVP.
- Authoring API Endpoints (MVP): Versioned under `/api/v1/*` including
  `/api/v1/sections/[sectionId]/chat.read` (SSE),
  `/api/v1/sections/[sectionId]/proposals.generate` (SSE),
  `/api/v1/proposals/[proposalId]/apply`,
  `/api/v1/proposals/[proposalId]/reject`,
  `/api/v1/documents/[docId]/gates.run`, and `/api/v1/documents/[docId]/export`.
- Export format: Markdown + frontmatter; full document at
  `docs/architecture.md`; sharded sections under `docs/architecture/*.md`;
  manual export in MVP.

## Release Plan (6-week MVP)

- Week 1: Monorepo scaffold, auth decision, CI, infra baseline.
- Week 2: Doc schema + storage/versioning; quality gates checklist.
- Week 3: Architecture flow (core) + section-aware chat (read/write).
- Week 4: Spec Kit–aligned export polish; shard/export UX.
- Week 5: Update-existing-doc flow + collaboration basics; evaluation harness
  seed.
- Week 6: Hardening, KPIs wiring, docs, preview deploy.

## Epics (MVP)

- Epic 1: Foundation & Authenticated UI — Monorepo, CI, infra baseline; Clerk
  auth; authenticated App Layout with Dashboard; Personal Project foundation
  (single project per user) with minimal API/UI.
- Epic 2: Document Editor Core — Comprehensive document editor with
  section-based navigation, WYSIWYG Markdown editing, Git-style patching,
  conversational co-authoring, and local persistence.
- Epic 3: Advanced Features & Collaboration — Quality assurance, comprehensive
  export capabilities, and multi-user collaboration features.

<!-- Detailed epic stories will be elaborated interactively in subsequent steps. -->

## Epic 1 Details — Foundation & Authenticated UI

### Goal

Establish monorepo, CI, local dev runtime, and minimal auth via Clerk, then
deliver an authenticated two‑column App Layout with a Dashboard and basic
Projects UI — all runnable locally for MVP.

### Stories

1. Development Environment Bootstrap (Monorepo + Foundation Setup)

**Part A: Monorepo Structure**

- AC1: Repo contains complete structure per architecture:
  - `apps/web` (React frontend - adapted from lovable.ai prototype)
  - `apps/api` (Express.js backend)
  - `packages/shared-data`, `packages/templates`, `packages/ai`, `packages/qa`,
    `packages/exporter`, `packages/editor-core`, `packages/editor-persistence`,
    `packages/template-resolver`
  - `infra/` (placeholder)
  - `docs/`, `templates/`, `.bmad-core/`
- AC2: pnpm workspaces configured with all packages; Turbo pipelines for lint,
  type-check, build, test
- AC3: Root package.json scripts: `dev`, `dev:web`, `dev:api`, `test`, `lint`,
  `typecheck`, `build`

**Part B: Frontend Foundation (Adapt lovable.ai Prototype)**

- AC4: Move lovable.ai prototype from `docs/examples/ctrl-freaq-ui` to
  `apps/web` as foundation
  - Copy entire directory structure preserving existing setup
  - Update package.json name to "@ctrl-freaq/web"
  - Verify existing dependencies align with ui-architecture.md requirements
- AC5: Evaluate and enhance existing setup per ui-architecture.md:
  - ✅ TypeScript configuration (already strict mode)
  - ✅ Vite build tool (already configured)
  - ✅ React Router v6 (already has routes)
  - ✅ Tailwind CSS + shadcn/ui (already configured)
  - ✅ TanStack Query (already integrated)
  - ✅ Clerk authentication (already integrated)
  - ADD: Pino browser logging integration
  - ADD: Path aliases for @/features, @/stores, @/types per architecture
- AC6: Restructure to match architectural patterns:
  - Move `src/App.tsx` to `src/app/App.tsx`
  - Create `src/app/providers/` directory and refactor providers
  - Create `src/app/router/` directory with routing logic
  - Adapt existing pages to new structure
- AC7: Enhance API integration layer:
  - Create `src/lib/api/client.ts` with proper error handling
  - Configure for local backend connection (http://localhost:5001)
- AC8: Add missing architectural components:
  - Create `src/features/` directory structure
  - Create `src/stores/` for Zustand stores
  - Create `src/lib/streaming/` for SSE utilities
  - Add logging setup with Pino browser config
- AC9: Environment configuration with `.env.development`

**Part C: Backend Foundation (Express.js)**

- AC10: Express.js server bootstrapped in `apps/api` following architecture.md
- AC11: Core middleware and structure:
  - Express 5.1.0 with TypeScript
  - Pino logging with structured JSON output (Constitutional requirement)
  - Request ID propagation middleware
  - Error handling middleware with standard envelope
  - CORS configuration for local development
  - Basic health check endpoint (/health)
- AC12: API structure established:
  - `/api/v1/` base path routing
  - Placeholder routes for documents, sections, auth
  - Service locator pattern foundation
  - SQLite connection setup with better-sqlite3

**Part D: Library Package Foundations**

- AC13: Each package includes Constitutional requirements:
  - `src/cli.ts` entry point (even if placeholder)
  - `src/index.ts` with main exports
  - Independent package.json with version 0.1.0
  - README.md with purpose statement
  - TypeScript configuration extending base
- AC14: Minimal implementation for core packages:
  - `packages/shared-data`: SQLite connection and base repository pattern
  - `packages/templates`: YAML loader stub
  - `packages/ai`: Vercel AI SDK wrapper stub

**Part E: Test Infrastructure**

- AC15: Configure test frameworks per architecture standards:
  - Vitest (node) for backend packages via `apps/api/vitest.config.ts`
  - Vitest (jsdom) for frontend via `apps/web/vite.config.ts`
  - Playwright end-to-end runner in `apps/web/playwright.config.ts`
  - PNPM scripts (`test`, `test:watch`, coverage) exposed in each package
- AC16: Seed example specs that match required file conventions:
  - Unit: `packages/shared-data/src/repositories/document.repository.test.ts`
  - Frontend component: `apps/web/src/components/common/Avatar.test.tsx`
  - API contract: `apps/api/tests/contract/request-id.contract.test.ts`
  - Backend integration: `apps/api/tests/integration/projects.test.ts`
  - Playwright E2E: `apps/web/tests/e2e/document-editor.e2e.ts`
- AC17: Provide shared test infrastructure:
  - SQLite in-memory helpers and reset hooks in `apps/api/tests/setup.ts`
  - React Testing Library setup in `apps/web/tests/setup.ts`
  - Playwright device matrix and web server config in
    `apps/web/playwright.config.ts`

**Part F: Development Scripts & Documentation**

- AC18: Development environment validation:
  - Script to verify all services start correctly
  - Health check script for frontend and backend
  - Database migration runner (even if no initial migrations)
- AC19: Initial documentation:
  - `README.md` with setup instructions
  - `DEVELOPMENT.md` with architecture overview
  - Constitutional compliance checklist
  - Document how lovable.ai prototype was adapted

**Verification Criteria:**

- `pnpm dev` starts both frontend (port 5173) and backend (port 5001)
- Frontend displays existing Dashboard with Clerk auth at http://localhost:5173
- Backend health check responds at http://localhost:5001/health
- `pnpm test` runs all placeholder tests successfully
- `pnpm typecheck` passes with strict mode
- All Constitutional requirements met (CLI interfaces, structured logging,
  library independence)
- Existing lovable.ai features (auth, dashboard, routing) continue working

2. CI Pipeline Setup

- AC1: GitHub Actions workflow runs on PR and main.
- AC2: Jobs: lint, type-check, build; status checks required on PR merge.
- AC3: Artifact/summary includes basic metrics (duration, warnings).

3. Authentication with Clerk (MVP)

- AC1: Clerk integrated for login/logout in web app using dev keys.
- AC2: Authenticated-only access to authoring features.
- AC3: Minimal user profile persisted (ID, provider, email) and displayed.

4. Authenticated App Layout + Dashboard

- AC1: Two-column authenticated layout behind Clerk.
  - Left column: Sidebar with a "Projects" group listing the user’s projects
    sorted by name; selecting a project sets/reflects `activeProjectId`.
  - Right column: Main content area routed to `/dashboard` by default.
- AC2: Dashboard route shows h1 "Dashboard" and a two-column content layout:
  - Column 1: Project List component showing the user’s projects (MVP: single
    "My Project"), sorted by name.
    - Each item shows: name, summary, stacked member avatars (MVP: just the 1
      user), and "last modified at/by" (MVP: display "—/N/A").
  - Column 2: Recent Activity component summarizing recent document changes
    across the user’s projects.
    - MVP empty state: "No recent activity yet".
- AC3: Data sourced from Personal Project Bootstrap + Projects API; avatars from
  Clerk profile data where available.
- AC4: Basic responsive behavior; layout aligns with coding standards; empty
  states included.

Note: MVP maintains local-only constraint for simplified development and
testing.

## Epic 2 Details — Document Editor Core

### Goal

Deliver a comprehensive Document Editor that serves as the central component for
creating and editing documents. The editor provides flexible section-based
navigation, WYSIWYG Markdown editing, Git-style patching, conversational
co-authoring, and local persistence with pending changes.

### Stories

1. Document Schema & Template System

- AC1: JSON schema defines sections/fields, required/optional, and types with
  version tracking.
- AC2: Document Template YAML system (e.g., Architecture Document Template, PRD
  Template) drives editor rendering.
- AC3: Runtime validation enforces schema in UI and on save/export.

2. Document Editor Core Infrastructure

- AC1: Table of Contents (ToC) provides navigable overview of all sections and
  sub-sections with jump-to functionality.
- AC2: Section rendering displays existing content in read-only preview with
  edit mode toggle.
- AC3: Missing content sections show placeholder with abstract description of
  section's purpose.
- AC4: Users can edit sections sequentially or in any preferred order via
  Section Editor.

3. Section Editor & WYSIWYG Capabilities

- AC1: WYSIWYG Markdown editor for content authoring integrated per section.
- AC2: Git-style patching via diff-match-patch for applying/creating patch
  diffs.
- AC3: Section Editor transitions: read-only preview ↔ edit mode ↔ draft
  preview.

4. New Section Content Flow

- AC1: Identify assumptions from section checklist and contextual inputs,
  ordered by priority.
- AC2: Interactive assumption resolution loop before content drafting.
- AC3: Draft content according to section instructions with AI assistance.
- AC4: Present draft content with rationale for review and editing approval.

5. Persistence Model & Local Changes

- AC1: Local pending changes stored client-side (local storage) as patch diffs
  per section.
- AC2: Save operation batches all modified sections into single backend request
  with patch diffs.
- AC3: Reload behavior replays pending diffs on top of server-side state.
- AC4: Draft persists locally (SQLite) under user account (Clerk) with
  section-level granularity.

6. Conversational Co-Authoring Integration

- AC1: Section-scoped chat can "explain, outline, suggest" without writing,
  integrated within editor.
- AC2: Chat proposals generate diff previews showing insertions/deletions within
  editor context.
- AC3: User approval applies changes and updates draft with changelog entry.
- AC4: Context includes current section, approved prior sections, selected
  knowledge items.

7. Streaming UX for Editor

- AC1: Streamed model responses render incrementally within editor context
  <300ms TTFC.
- AC2: Local dev uses Node streams/SSE integrated with WYSIWYG editor
  components.
- AC3: Graceful fallback maintains functional parity without streaming.

8. Quality Gates Integration

- AC1: Section-level validation during editing with real-time feedback.
- AC2: Document-level quality gates prevent publish; show pass/fail in editor
  UI.
- AC3: Traceability matrix updates automatically when changes applied via
  editor.

9. Export & Versioning from Editor

- AC1: Export full document to `docs/architecture.md`; sharded sections to
  `docs/architecture/*.md`.
- AC2: Version headers, schema version, changelog delta included in exports.
- AC3: Idempotent export from editor state (unchanged content yields no diff).

### Core Document Editor Workflow

Authoritative UX workflow and diagrams live in
`docs/front-end-spec.md#core-document-editor-workflow`. This section provides a
PRD-level summary only.

#### Overview

The Document Editor follows an 8-step workflow for comprehensive document
creation and editing:

1. **Load Template**: App loads the Architecture template from repository YAML.
   If absent, seed from `.bmad-core/templates/architecture-tmpl.yaml` and
   persist as `templates/architecture.yaml`.

2. **Document-Level Assumptions**: Run top-level assumptions loop for the entire
   document to establish global decisions (e.g., starter vs. greenfield,
   compliance stance, streaming, db strategy).

3. **Render Document Editor**: Build comprehensive editor with navigable Table
   of Contents and full document rendering. Sections display as read-only
   previews with edit mode toggles, or placeholders for missing content.

4. **Section-Based Editing**: Users navigate to any section and toggle between
   read mode (preview) and edit mode (WYSIWYG Markdown editor using Milkdown
   v7.15.5). Local pending changes stored as Git-style patch diffs.

5. **New Section Content Flow**: For blank sections, trigger assumption
   resolution loop before drafting. For existing content, allow direct WYSIWYG
   editing with diff tracking.

6. **Conversational Co-Authoring**: Integrated chat within editor context for AI
   assistance in read (explain/suggest) and write-proposal modes with streaming
   output and diff previews.

7. **Git-Style Patching**: All changes managed as patch diffs, enabling review,
   approval/rejection, and replay of pending changes on reload.

8. **Save & Export**: Batch save all modified sections to document repository.
   Export to `docs/architecture.md` and shards `docs/architecture/*.md`
   on-demand via explicit user action.

#### Section State Machine

Each section follows this state progression:

- **States**:
  `idle → read_mode → edit_mode → [assumptions] → drafting → diff_preview → ready`
- **Key Transitions**:
  - Navigate to section → Display read-only preview
  - Click edit → Enter WYSIWYG editor
  - Blank section → Start assumptions loop
  - Existing content → Direct editing with diff tracking
  - Generate patches → Show diff preview
  - Approve changes → Run quality gates → Save
  - Cancel → Discard pending changes

#### User Interaction Flow

1. User navigates to section → Read-only preview displayed
2. User clicks edit → WYSIWYG editor activated
3. For new content:
   - Assumptions engine presents questions/options
   - User provides decisions
   - AI generates draft based on assumptions
4. For existing content:
   - Direct editing in WYSIWYG mode
   - Optional AI assistance for improvements
5. Changes tracked as Git-style patches
6. User reviews diff preview
7. Approval triggers quality gates
8. Save completes, return to read mode

#### Technical Implementation Notes

- **Editor**: Milkdown v7.15.5 for WYSIWYG Markdown editing
- **Persistence**: Client-side patch storage via `packages/editor-persistence`
- **Templates**: Backend template resolution via `packages/template-resolver`
- **AI Integration**: Vercel AI SDK for LLM interactions
- **Quality Gates**: Real-time validation during editing

## Epic 3 Details — Advanced Features & Collaboration

### Goal

Enhance the Document Editor with advanced quality assurance, comprehensive
export capabilities, and basic collaboration features for multi-user scenarios.

### Stories

1. Quality Gates Definition

- AC1: Define checklist with blocker/non-blocker items (schema completeness,
  citations present, assumptions resolved, no TODOs).
- AC2: Each gate has severity, rationale, and auto-check where possible.
- AC3: Gates configurable by project; defaults provided.

2. Validation Engine

- AC1: Run gates on-demand and pre-publish; show pass/fail with details.
- AC2: Blockers prevent publish; non-blockers logged for follow-up.
- AC3: Export QA snapshot (JSON) stored with doc version.

3. Traceability Matrix (Minimal)

- AC1: Model links requirement ↔ architecture section ↔ decision/knowledge
  item.
- AC2: UI view shows forward/back-links; CSV/JSON export.
- AC3: Links updated automatically when AI proposals are applied.

4. Versioning & Changelog

- AC1: Doc metadata includes version, schema version, generated timestamp,
  author.
- AC2: On publish, bump version and write changelog entry (why/what).
- AC3: Diff view shows line-level and section-level changes.

5. Commit/Export Integration

- AC1: Export uses full path docs/architecture.md and shards
  docs/architecture/\*.md.
- AC2: Idempotent export: unchanged content produces no diff.
- AC3: Commit message template generated (local dev workflow).

6. Evaluation Hook for Gates

- AC1: Optional integration to run a small eval set (precision@1 on key Q&A).
- AC2: Thresholds configurable; results attached to QA snapshot.
- AC3: Failures flagged as non-blockers in MVP (informational).

7. Advanced Collaboration Features

- AC1: Section "editing by <user>" indicator using Clerk identity.
- AC2: Conflict warning if another save occurs within 30s window with merge view
  options.
- AC3: Last-write-wins with conflict warning; comprehensive activity logging.

8. Comments & Annotations

- AC1: Per-section notes capability (author, timestamp) within editor.
- AC2: Notes are non-blocking and export-excluded but visible in editor.
- AC3: Notes included in QA snapshot context for internal tracking.
