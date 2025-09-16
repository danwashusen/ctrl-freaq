# Quickstart Guide: Document Schema & Template System

## Prerequisites

- Node.js 22.x and pnpm 9.x installed (`node --version`, `pnpm --version`)
- CTRL FreaQ repo cloned with branch `005-story-2-1` checked out
- Clerk dev keys configured (see previous quickstarts)
- SQLite available on PATH

## 1. Install & Bootstrap

```bash
pnpm install
pnpm --filter @ctrl-freaq/shared-data migrate # applies new template tables
```

## 2. Publish Initial Template Version

```bash
# Compile and publish architecture template v1.0.0
pnpm --filter @ctrl-freaq/templates publish --file templates/architecture.yaml \
  --version 1.0.0 --changelog "Initial architecture baseline"

# Activate the version
pnpm --filter @ctrl-freaq/templates activate --template architecture --version 1.0.0
```

**Verify**:

```bash
pnpm --filter @ctrl-freaq/templates list
# Expect: architecture → active=1.0.0, status=active
```

## 3. Exercise API Contracts

Start backend (in new terminal):

```bash
pnpm --filter @ctrl-freaq/api dev
```

Test template endpoints:

```bash
curl -s http://localhost:5001/api/v1/templates | jq '.templates[] | {id, activeVersion}'

curl -s http://localhost:5001/api/v1/templates/architecture/versions/1.0.0 \
  | jq '{version, sections: .sections[0:2]}'
```

Expect JSON schema payload with section definitions and validation metadata.

## 4. Validate Editor Enforcement

```bash
pnpm --filter @ctrl-freaq/web dev
```

- Create new Architecture document.
- Confirm placeholders match template sections and required fields are
  indicated.
- Attempt to delete required content; save should block with inline error
  referencing section/field key.
- Open a document saved under an older version; verify it auto-upgrades to the
  active version and logs the upgrade outcome.
- Remove a template version via CLI (simulate) and ensure documents pointing to
  it display a blocking message until reinstated.

## 5. Automated Tests

```bash
pnpm --filter @ctrl-freaq/templates test
pnpm --filter @ctrl-freaq/template-resolver test
pnpm --filter @ctrl-freaq/web test --filter "template"
pnpm --filter @ctrl-freaq/api test --filter "template"
```

All new contract/unit/integration tests must pass.

## 6. Export Verification

```bash
pnpm --filter @ctrl-freaq/exporter run export --template architecture --doc DOC123
```

- Output Markdown should include section order defined by active template.
- If export fails, check backend logs for validation errors with correlation ID.

## 7. Cleanup & Next Steps

- Capture audit log entries for template publish/activate/auto-upgrade in
  `apps/api/logs/dev.log` (ensure correlation IDs).
- Confirm blocking alert appears when template version removed scenarios are
  triggered.
