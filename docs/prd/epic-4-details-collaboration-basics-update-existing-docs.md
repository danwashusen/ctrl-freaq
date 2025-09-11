# Epic 4 Details — Collaboration Basics & Update Existing Docs
## Goal
Let users open, review, and update existing docs safely with basic concurrency protection and clear diffs.

## Stories
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
