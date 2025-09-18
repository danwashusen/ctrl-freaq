# Shared Data Migrations

This directory stores versioned SQL migrations for the shared data package. All
schema changes that introduce new tables or relationships for shared
repositories belong here to keep persistence concerns alongside the library that
owns them.

## Conventions

- **Filename**: `<version>_<slug>.sql` using a zero-padded numeric version that
  matches the global story identifier (e.g., `005_template_catalog.sql`). The
  numeric prefix aligns with the story roadmap to make audit trails simple.
- **Ordering**: Migrations execute in ascending numeric order. Keep the prefix
  monotonic and never reuse a number once published.
- **Idempotence**: Use `IF NOT EXISTS` / `DROP INDEX IF EXISTS` guards so the
  schema can be applied safely to new environments and local developer
  databases.
- **Audit Fields**: Every table MUST include SOC 2 audit columns (`created_at`,
  `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by` where
  applicable).
- **Checksum Safety**: The API database manager validates SHA-256 checksums.
  Once a migration ships, never edit the file in place—create a follow-up
  migration instead.

## Loader Integration

`@ctrl-freaq/shared-data` exposes a migration loader so applications can merge
these SQL files into their own migration pipeline. The loader simply reads all
SQL files from this directory and returns ordered migration objects that the API
and CLI use during database bootstrap.

Future stories will add concrete migrations (e.g., `005_template_catalog.sql`)
that introduce the template catalog tables consumed by repositories and
validators.
