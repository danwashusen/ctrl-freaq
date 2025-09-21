# @ctrl-freaq/editor-core

Core patch engine for the Document Editor infrastructure with Git-style diff
generation and application.

## Overview

The editor-core package provides the fundamental patch management capabilities
for CTRL FreaQ's document editor. It uses Google's diff-match-patch library to
generate and apply Git-style patches for tracking content changes with conflict
resolution and validation.

## Features

- **Git-style Patch Generation**: Create unified diff patches from content
  changes
- **Patch Application**: Apply patches with conflict detection and validation
- **Performance Optimized**: <100ms patch generation for typical document
  sections
- **Conflict Resolution**: Detect and handle overlapping changes between patches
- **Comprehensive Validation**: Zod-based schemas for patch and change
  validation
- **CLI Interface**: Command-line tools for patch operations and testing

## Installation

```bash
pnpm add @ctrl-freaq/editor-core
```

## Quick Start

### Basic Patch Operations

```typescript
import { PatchEngine, createPatchEngine } from '@ctrl-freaq/editor-core';

// Create a patch engine instance
const patchEngine = createPatchEngine();

// Generate patches from content changes
const original = '# Title\nOriginal content here.';
const modified = '# Title\nModified content here.\nNew line added.';

const patches = patchEngine.createPatch(original, modified);
console.log('Generated patches:', patches);

// Apply patches to content
const result = patchEngine.applyPatch(original, patches);
if (result.success) {
  console.log('Applied successfully:', result.content);
} else {
  console.error('Application failed:', result.error);
}

// Preview changes before applying
const preview = patchEngine.previewPatch(original, modified);
console.log(`Changes: +${preview.additions} -${preview.deletions}`);
console.log('Diff preview:', preview.preview);
```

### Creating Pending Changes

```typescript
import { patchEngine } from '@ctrl-freaq/editor-core';

// Create a pending change record
const pendingChange = patchEngine.createPendingChange(
  'section-123', // sectionId
  'document-456', // documentId
  originalContent, // original content
  modifiedContent, // modified content
  'user@example.com', // createdBy
  'session-789' // sessionId
);

console.log('Pending change created:', pendingChange.id);
```

### Conflict Detection

```typescript
// Detect conflicts between pending changes
const existingChanges = [pendingChange1, pendingChange2];
const newChange = pendingChange3;

const conflicts = patchEngine.detectConflicts(existingChanges, newChange);
if (conflicts.length > 0) {
  console.log('Conflicts detected with changes:', conflicts);
}
```

### Custom Configuration

```typescript
import { PatchEngine } from '@ctrl-freaq/editor-core';

// Create engine with custom settings
const customEngine = new PatchEngine({
  maxPatchSize: 64,
  diffTimeout: 2.0,
  diffEditCost: 6,
  matchThreshold: 0.8,
  deleteThreshold: 0.8,
});
```

## CLI Usage

The package provides CLI commands for patch operations and testing.

### Installation

Install the CLI globally or use via pnpm:

```bash
# Install globally
pnpm add -g @ctrl-freaq/editor-core

# Or use with pnpm
pnpm --filter @ctrl-freaq/editor-core cli --help
```

### Commands

#### Generate Patch

Create patches from two content files:

```bash
editor-core patch create original.txt modified.txt --output patch.json
```

Options:

- `--output, -o`: Output file for patches (default: stdout)
- `--format, -f`: Output format: json, diff (default: json)
- `--optimize`: Optimize patches by merging adjacent operations

#### Apply Patch

Apply patches to content:

```bash
editor-core patch apply original.txt patch.json --output result.txt
```

Options:

- `--output, -o`: Output file for result (default: stdout)
- `--validate`: Validate patches before applying
- `--dry-run`: Show what would be applied without making changes

#### Preview Changes

Preview patches as unified diff:

```bash
editor-core patch preview original.txt modified.txt
```

Options:

- `--stats`: Show change statistics (additions/deletions)
- `--context, -c`: Number of context lines (default: 3)

#### Validate Patches

Validate patch format and operations:

```bash
editor-core patch validate patch.json
```

#### Performance Testing

Run performance benchmarks:

```bash
editor-core test performance --iterations 100 --size large
```

Options:

- `--iterations, -i`: Number of test iterations (default: 10)
- `--size`: Test content size: small, medium, large (default: medium)
- `--target`: Performance target in ms (default: 100)

#### Generate Test Data

Create test content for development:

```bash
editor-core test generate --type markdown --size 1000 --output test.md
```

Options:

- `--type`: Content type: markdown, text, json (default: markdown)
- `--size`: Content size in lines (default: 100)
- `--output, -o`: Output file (default: stdout)

### Examples

```bash
# Create patches between two versions of a document
editor-core patch create doc-v1.md doc-v2.md -o changes.json

# Preview the changes
editor-core patch preview doc-v1.md doc-v2.md --stats

# Apply patches to original
editor-core patch apply doc-v1.md changes.json -o doc-updated.md

# Validate patches before applying
editor-core patch validate changes.json

# Run performance tests
editor-core test performance -i 50 --size large

# Generate test markdown content
editor-core test generate --type markdown --size 500 -o test-doc.md
```

## API Reference

### PatchEngine

Main class for patch operations.

#### Constructor

```typescript
constructor(config?: PatchEngineConfig)
```

**PatchEngineConfig:**

- `maxPatchSize?: number` - Maximum patch size (default: 32)
- `diffTimeout?: number` - Diff timeout in seconds (default: 1.0)
- `diffEditCost?: number` - Edit cost for diff algorithm (default: 4)
- `matchThreshold?: number` - Match threshold (default: 0.5)
- `deleteThreshold?: number` - Delete threshold (default: 0.5)

#### Methods

##### createPatch(originalContent, modifiedContent)

Generate patches between two content strings.

**Parameters:**

- `originalContent: string` - Original content
- `modifiedContent: string` - Modified content

**Returns:** `PatchDiff[]` - Array of patch operations

##### applyPatch(originalContent, patches)

Apply patches to original content.

**Parameters:**

- `originalContent: string` - Content to apply patches to
- `patches: PatchDiff[]` - Patches to apply

**Returns:** `PatchResult` - Result with success status and content/error

##### previewPatch(originalContent, modifiedContent)

Generate preview of changes with statistics.

**Parameters:**

- `originalContent: string` - Original content
- `modifiedContent: string` - Modified content

**Returns:** `PatchPreview` - Preview with stats and diff text

##### createPendingChange(sectionId, documentId, originalContent, modifiedContent, createdBy, sessionId)

Create a pending change record.

**Returns:** `PendingChange` - Complete pending change object

##### detectConflicts(existingChanges, newChange)

Detect conflicts between pending changes.

**Parameters:**

- `existingChanges: PendingChange[]` - Existing pending changes
- `newChange: PendingChange` - New change to check

**Returns:** `string[]` - Array of conflicting change IDs

##### validatePatches(patches)

Validate patch operations and format.

**Parameters:**

- `patches: PatchDiff[]` - Patches to validate

**Returns:** `{ valid: boolean; errors: string[] }`

### Types

#### PatchDiff

```typescript
interface PatchDiff {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: string;
  oldValue?: string;
}
```

#### PendingChange

```typescript
interface PendingChange {
  id: string;
  sectionId: string;
  documentId: string;
  patches: PatchDiff[];
  originalContent: string;
  previewContent: string;
  createdAt: string;
  createdBy: string;
  sessionId: string;
  status: 'pending' | 'applying' | 'applied' | 'failed';
  conflictsWith: string[];
}
```

#### PatchResult

```typescript
interface PatchResult {
  success: boolean;
  content?: string;
  error?: string;
  conflicted?: boolean;
}
```

#### PatchPreview

```typescript
interface PatchPreview {
  additions: number;
  deletions: number;
  preview: string;
  patches: PatchDiff[];
}
```

## Performance Characteristics

- **Patch Generation**: Target <100ms for typical document sections
- **Memory Usage**: Optimized for large documents with patch merging
- **Conflict Detection**: O(n×m) where n,m are patch counts
- **Validation**: Fast Zod-based schema validation

## Error Handling

The package uses structured error handling with specific error types:

```typescript
try {
  const patches = patchEngine.createPatch(original, modified);
} catch (error) {
  if (error.message.includes('Failed to create patch')) {
    // Handle patch generation error
  }
}
```

## Integration

### With Document Editor

```typescript
import { patchEngine } from '@ctrl-freaq/editor-core';
import { useEditorStore } from '@/features/document-editor/stores/editor-store';

function useDocumentPatching() {
  const store = useEditorStore();

  const createPendingChange = useCallback(
    (sectionId: string, newContent: string) => {
      const section = store.sections[sectionId];
      if (!section) return;

      const pendingChange = patchEngine.createPendingChange(
        sectionId,
        section.docId,
        section.contentMarkdown,
        newContent,
        'current-user',
        'current-session'
      );

      store.addPendingChange(pendingChange);
    },
    [store]
  );

  return { createPendingChange };
}
```

### With Persistence Layer

```typescript
import { patchEngine } from '@ctrl-freaq/editor-core';
import { localStorageManager } from '@ctrl-freaq/editor-persistence';

async function savePendingChanges(changes: PendingChange[]) {
  for (const change of changes) {
    // Validate before saving
    const validation = patchEngine.validatePatches(change.patches);
    if (!validation.valid) {
      throw new Error(`Invalid patches: ${validation.errors.join(', ')}`);
    }

    await localStorageManager.savePendingChange(change);
  }
}
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Type Checking

```bash
pnpm typecheck
```

## Contributing

1. Follow the established patterns in the codebase
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure performance targets are met
5. Follow the Constitutional requirements for library-first architecture

## License

Part of the CTRL FreaQ project. See main project license.

## Related Packages

- [`@ctrl-freaq/editor-persistence`](../editor-persistence) - Local storage and
  persistence
- [`@ctrl-freaq/shared-data`](../shared-data) - Database access and repositories
- [`@ctrl-freaq/web`](../../apps/web) - Web application and UI components
