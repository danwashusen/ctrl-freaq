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

> The shared-data migrate script honours `DATABASE_PATH` and will create the parent directory automatically, so you can target alternative SQLite locations without manual setup.
```

## 2. Publish Initial Template Version

Workspace scripts wrap the template CLI so you can run commands without
memorising filter syntax. Pass additional CLI flags after `--`.

```bash
# Compile and publish architecture template v1.0.0
pnpm template:publish -- --file templates/architecture.yaml \
  --version 1.0.0 --changelog "Initial architecture baseline"

# Activate the version
pnpm template:activate -- --template architecture --version 1.0.0

# Inspect catalog (table view)
pnpm template:list

# Optional JSON output for scripting
pnpm template:list -- --json

# Optional: run a targeted document migration (arguments mirror CLI)
pnpm template:migrate -- --document DOC123 --to-version 1.0.0
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

Expect JSON schema payload with section definitions and validation metadata. If
you publish additional versions, `/templates/architecture/versions` will reflect
the updated catalog immediately after activation.

## 4. Validate Editor Enforcement

```bash
pnpm --filter @ctrl-freaq/web dev
```

- Create a new Architecture document via the Project page.
- Confirm fields render in the order defined by the active template and that
  required sections display inline error states when cleared.
- Attempt to save with required content removed – `TemplateValidationGate`
  should block the submission and list validation issues.
- Publish a follow-up version (e.g.
  `pnpm template:publish -- --file templates/architecture.yaml --version 1.1.0 --changelog "Add Tech Stack guidance"`)
  and activate it. Reload the document and verify the upgrade banner reports the
  auto-upgrade from the previous version and the browser logger records the
  structured event with correlation id.
- Temporarily remove an active version (via CLI or manual DB change) and ensure
  the Project page shows the removed-version banner and disables editing.

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

## 7. Observe Structured Logging

- Browser logs inherit API correlation ids after any template interaction. Check
  the devtools console for events such as `document.template.upgraded` and
  confirm they include `requestId`/`templateVersion`.
- Backend logs (`apps/api/logs/dev.log`) include template context for publish,
  activate, and upgrade flows via `TemplateUpgradeService`.

## 8. Cleanup & Next Steps

- Capture audit log entries for template publish/activate/auto-upgrade in
  `apps/api/logs/dev.log` (ensure correlation IDs).
- Confirm blocking alert appears when template version removed scenarios are
  triggered.
