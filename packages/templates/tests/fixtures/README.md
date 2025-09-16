# Template YAML Fixtures

Reusable YAML definitions used across template compiler, validator, and CLI
tests. Keeping fixtures here ensures all test suites reference the same source
of truth when verifying parsing, validation, and publishing flows.

## Files

- `architecture.valid.yaml` — Happy-path Architecture template with sections,
  field metadata, and publish notes for semver `1.0.0`.
- `architecture.missing-fields.yaml` — Invalid template missing required section
  field metadata to exercise validation failures.
- `architecture.invalid-version.yaml` — Invalid semantic version to test version
  parsing and error messaging.

All fixtures intentionally include `metadata` blocks (author, changelog) so
future tests can assert audit propagation without duplicating YAML fragments.
