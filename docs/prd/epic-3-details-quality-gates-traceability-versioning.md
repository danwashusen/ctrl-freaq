# Epic 3 Details — Quality Gates, Traceability, Versioning
## Goal
Ensure documents meet AI-ready standards before publish, maintain traceability, and manage versions/diffs reliably.

## Stories
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
