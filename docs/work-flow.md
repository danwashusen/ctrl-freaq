# Development Workflow

This workflow supplements the standard development implementation process.

## Task Code Quality Gates

- Run the 'bulk apply lint fixes' command for each package that contains changes
  and address any issues found
- Run the 'typecheck a specific package' command for each package that contains
  changes and address any issues found

## Phase Code Quality Gates

- Before running `pnpm lint`, first run `pnpm format` and `pnpm lint:fix`.

## Code Quality Gate Command Crib Sheet

- `pnpm build`: Turbo build across all workspaces; obeys build graph/caching.
- `pnpm clean`: turbo clean plus delete node_modules; resets workspace caches.
- `pnpm commitlint`: Runs Commitlint against staged message (usually via
  CI/hooks).
- `pnpm dev`: Turbo dev for everything with concurrency cap of 12.
- `pnpm dev:apps`: Dev mode limited to @ctrl-freaq/web and @ctrl-freaq/api.
- `pnpm --filter @ctrl-freaq/web dev:e2e`: Vite dev server in fixture mode
  (`VITE_E2E=true`).
- `pnpm --filter @ctrl-freaq/web dev:live`: Vite dev server pointed at live
  services (`VITE_E2E` unset).
- `pnpm format`: Prettier write on entire repo.
- `pnpm format:check`: Prettier check only (fails on diff).
- `pnpm lint`: Repo-wide Turbo lint with --force (rerun all) then repo ESLint
  cache pass.
- `pnpm lint:quick`: Quick cached Turbo lint then repo ESLint cache pass.
- `pnpm lint:ci`: Repo ESLint with --max-warnings=0.
- `pnpm lint:fix`: Repo ESLint with --fix.
- `pnpm lint:fix:check`: ESLint --fix-dry-run preview.
- `pnpm lint:repo:` Repo ESLint with cache (baseline command).
- `pnpm lint:yaml`: ESLint focused on .yml/.yaml.
- `pnpm test`: Repository gauntlet (Vitest with `--force --no-cache`, then
  fixture and visual Playwright).
- `pnpm test:quick`: Vitest-only feedback loop across workspaces.
- `pnpm test:unit:ci`: Forces Turbo to rerun every Vitest suite without cache.
- `pnpm test:gauntlet`: Explicit alias when CI scripts need the gauntlet
  directly.
- `pnpm test:ci`: Lint, typecheck, and gauntlet in a single command.
- `pnpm --filter @ctrl-freaq/web test:e2e:quick`: Fixture Playwright suite for
  fast iteration.
- `pnpm --filter @ctrl-freaq/web test:e2e:ci`: Fixture Playwright configured for
  CI parity.
- `pnpm --filter @ctrl-freaq/web test:live`: Live Playwright harness (opt-in).
- `pnpm --filter @ctrl-freaq/web test:visual:quick`: Visual regression quick
  loop.
- `pnpm --filter @ctrl-freaq/web test:visual:ci`: Visual regression with CI
  reporters.
- `pnpm typecheck`: Repo-wide Turbo typecheck with --force (no cache).
- `pnpm typecheck:quick`: Quick cached Turbo typecheck.

To scope any command to one workspace, add --filter <package> (e.g. pnpm
--filter @ctrl-freaq/web lint).

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
