# Epic 5 Details — MCP Read Server + Knowledge Registry + Observability
## Goal
Deliver an MCP read service with a minimal knowledge registry and structured observability/audit, enabling agents/LLMs to query authoritative product/architecture knowledge. This work was deferred from Epic 1 to Phase 2 to simplify the MVP.

## Stories
1) MCP Server Skeleton (services/mcp)
- AC1: Node/TypeScript service scaffolded; local dev server commands documented.
- AC2: Vercel AI SDK added; abstraction wrapper present (no provider secrets in repo).
- AC3: Health/readiness endpoints return 200; version in response.

2) Knowledge Registry with SQLite
- AC1: SQLite database used via an abstraction layer (e.g., Prisma or better-sqlite3) with entities: standard, pattern, decision.
- AC2: CRUD helpers implemented; seed entries for coding standards and patterns.
- AC3: Validation on writes; item version field included; abstraction designed to swap to DynamoDB in Phase 2+.

3) MCP Read Endpoints
- AC1: Endpoints: `GET /knowledge?type=standard|pattern|decision`, `GET /knowledge/{id}`.
- AC2: Responses return deterministic, documented JSON schemas.
- AC3: Endpoint reads real seeded data; unit test stubs for handlers.

4) Observability & Audit
- AC1: Structured logging (request IDs, user IDs where applicable).
- AC2: Audit event emitted for each MCP read (who, what, when).
- AC3: Basic metrics counters for endpoint calls and errors.

Note: Re-evaluate storage (SQLite → DynamoDB) and hosting (AWS serverless) according to Phase 2 production needs.

