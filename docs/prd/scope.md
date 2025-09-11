# Scope
## In Scope (MVP)
- Architecture Document Creation Flow (detailed, AI-optimized) from existing Brief/PRD.
- Section-aware conversational co-authoring during creation.
- Document QA chat on existing docs with citations.
- Update existing documents with diff preview and changelog/versioning.
- Quality gates and lightweight traceability matrix.
- Authenticated App Layout with Dashboard (Sidebar “Projects” group; Project List; Recent Activity empty state).
- Export/versioning to repo under `docs/`.
- Basic collaboration concurrency.
 - Personal Project model (one per user) with minimal CRUD: auto-create on first login; rename only; no delete in MVP. All authoring documents and knowledge items are scoped to the user’s personal project.

## Out of Scope (MVP)
- Full PRD/Brief generation flows beyond minimal capture for Architecture.
- Multi-tenant org/workspace management and SSO.
- Advanced analytics/dashboards, governance policies, workflow automations.
- Complex model routing/orchestration; custom plugin marketplace.
- Deep repo scanning/indexing across large monorepos (beyond targeted doc I/O).

## Phase 2 Note
- MCP read server, knowledge registry, and observability/audit for MCP.
- Introduce Organization model and multi-tenant workspace management (SSO, org membership, multiple projects per user); out of scope for MVP.
