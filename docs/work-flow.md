# Development Workflow

This workflow supplements the standard development implementation process.

## Task Code Quality Gates

- Run the 'bulk apply lint fixes' command for each package that contains changes
  and address any issues found
- Run the 'typecheck a specific package' command for each package that contains
  changes and address any issues found

## Phase Code Quality Gates

- Run the 'bulk apply lint fixes' command and address any issues found
- Run the 'concise global typecheck output' command and address any issues found

## Code Quality Gate Command Crib Sheet

Use these commands to target specific scopes without overwhelming the
implementation transcript:

- `pnpm run typecheck -- --pretty false | rg -i 'error'` — concise global
  typecheck output (root `typecheck` is `turbo typecheck`; flags after `--` are
  forwarded to underlying tsconfig runs)
- `pnpm exec turbo run typecheck --filter=packages/<name>` — typecheck a
  specific package
- `pnpm exec eslint . --format compact | rg -i 'error|warning'` — repo lint
  trimmed to issues (prefer direct eslint; `lint:repo` does not forward flags)
- `pnpm exec turbo run lint --filter=@ctrl-freaq/web` — lint only the web app
  package (add `-- --max-warnings=0` if needed)
- `pnpm --filter <package> test -- --runInBand` — isolate tests to the impacted
  package
- `pnpm lint:fix` / `pnpm --filter <package> lint -- --fix` — bulk apply lint
  fixes
- `pnpm lint:fix:check` — dry-run lint fixes to capture only what needs
  attention

## AI Code Assistant Guardrails

AI assistants must read and apply this section before generating or editing
code. If any rule is unclear or conflicts with existing code, pause and ask for
guidance instead of guessing.

- **Dependency declarations** — every imported package must live in
  `package.json`.
  - Bad:
    ```ts
    import Database from 'better-sqlite3';
    ```
  - Good:
    ```json
    {
      "dependencies": {
        "better-sqlite3": "^9.4.0"
      }
    }
    ```
- **Avoid `as any`** — extend types rather than erasing them.
  - Bad:
    ```ts
    const editLock = (section as any).editLock;
    ```
  - Good:

    ```ts
    interface SectionWithLock extends Section {
      editLock: EditLock;
    }

    const editLock = (section as SectionWithLock).editLock;
    ```

- **Repository generics** — pass the actual DB row shape to base repositories.
  - Bad:
    ```ts
    export class SectionEditHistoryRepository extends BaseRepository<
      typeof SectionEditHistorySchema
    > {}
    ```
  - Good:

    ```ts
    interface SectionEditHistoryDB {
      id: string;
      sectionId: string;
      payload: string;
      createdAt: number;
    }

    export class SectionEditHistoryRepository extends BaseRepository<SectionEditHistoryDB> {}
    ```

- **Override parity** — `override` signatures must match their parent methods.
  - Bad:
    ```ts
    override async create(section: Section, extra: string) {
      /* ... */
    }
    ```
  - Good:
    ```ts
    override async create(section: SectionInput): Promise<Section> {
      /* ... */
    }
    ```
- **Constructor alignment** — instantiate classes with every required
  dependency.
  - Bad:
    ```ts
    const repository = new EnhancedSectionRepository(db);
    ```
  - Good:
    ```ts
    const baseRepository = new SectionRepository(db);
    const repository = new EnhancedSectionRepository(db, baseRepository);
    ```
- **API method names** — call utilities with their documented methods.
  - Bad:
    ```ts
    patchEngine.applyPatches(diff);
    diffGenerator.generateDiff(before, after);
    ```
  - Good:
    ```ts
    patchEngine.applyJSONPatches(diff);
    diffGenerator.generateLineDiff(before, after);
    ```
- **Return shapes** — destructure responses using their real fields.
  - Bad:
    ```ts
    const { result, error } = patchEngine.applyJSONPatches(patch);
    ```
  - Good:
    ```ts
    const { success, content, error } = patchEngine.applyJSONPatches(patch);
    ```
- **Type-only imports** — use `import type` for types.
  - Bad:
    ```ts
    import { Section } from './section';
    ```
  - Good:
    ```ts
    import type { Section } from './section';
    ```
- **Unused declarations** — remove them or prefix with `_` when intentional.
  - Bad:
    ```ts
    const tempResult = compute();
    ```
  - Good:
    ```ts
    const _tempResult = compute();
    ```
- **Access modifiers** — do not mark overrides as `private`.
  - Bad:
    ```ts
    private override getStatement() {
      /* ... */
    }
    ```
  - Good:
    ```ts
    protected override getStatement() {
      /* ... */
    }
    ```

## Section Draft CLI Operations

Use the section-draft CLI to move drafts between environments and prepare
persistence payloads without touching the API directly. All commands run through
pnpm filters so they execute against the local workspace build.

### Export a draft snapshot

```bash
pnpm --filter @ctrl-freaq/editor-core cli draft export \
  --input ./drafts/sec-123.json \
  --output ./exports/sec-123.pkg.json \
  --pretty
```

- `--input` accepts a JSON file or `-` to read from stdin.
- `--keep-request-id` preserves the original request identifier when sharing a
  package with teammates.
- Add `--json` when you want the portable package printed to stdout instead of
  writing to disk.

### Prepare an upsert payload from an export

```bash
pnpm --filter @ctrl-freaq/editor-core cli draft import \
  --input ./exports/sec-123.pkg.json \
  --section 11111111-2222-3333-4444-555555555555 \
  --document 99999999-8888-7777-6666-555555555555 \
  --request-id $(uuidgen) \
  --pretty --json
```

- Override section, document, or request identifiers to target a different
  environment.
- Emitting JSON (`--json`) is useful when piping the payload into the API or an
  automation script.
- Output files always end with a newline so they are safe to commit if needed.

### Operational guardrails

- CLI output is designed for both humans and automations; machine-readable JSON
  never mixes with the status strings printed to stderr.
- Autosave queue processing emits structured logs prefixed with
  `section-editor.autosave` so you can correlate CLI imports with API-side
  processing.
