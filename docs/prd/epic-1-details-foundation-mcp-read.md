# Epic 1 Details — Foundation & Authenticated UI
## Goal
Establish monorepo, CI, local dev runtime, and minimal auth via Clerk, then deliver an authenticated two‑column App Layout with a Dashboard and basic Projects UI — all runnable locally for MVP. MCP server and knowledge registry are deferred to Phase 2.

## Stories
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

8) Personal Project Bootstrap (DB + Service)
- AC1: On first login, auto-create a personal project owned by the user.
- AC2: SQLite table `projects` with fields: `id (uuid)`, `name (text)`, `slug (text unique)`, `ownerUserId (text unique)`, `createdAt`, `updatedAt`.
- AC3: Exactly one project per user (MVP) enforced via unique `ownerUserId`.
- AC4: No delete in MVP; POST create optional and not exposed in MVP UI.

9) Projects API (Minimal)
- AC1: `GET /api/v1/projects` returns the current user’s project list (one item).
- AC2: `GET /api/v1/projects/:id` returns details if owner; non-owners receive 404/403.
- AC3: `PATCH /api/v1/projects/:id` supports rename only; owner-only;
- AC4: No DELETE; POST optional (not used in MVP).

10) [Merged into Story 4] Minimal UI Surfaces for Projects
- Scope merged into Story 4 (Authenticated App Layout + Dashboard).
