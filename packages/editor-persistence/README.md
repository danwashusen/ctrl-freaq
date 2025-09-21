# @ctrl-freaq/editor-persistence

Local storage and persistence layer for the Document Editor infrastructure with
IndexedDB support and compression.

## Overview

The editor-persistence package provides client-side persistence capabilities for
CTRL FreaQ's document editor. It uses IndexedDB via localforage for reliable
browser storage with fallback support, compression for optimal storage usage,
and automatic cleanup of old data.

## Features

- **IndexedDB Storage**: Primary storage with WebSQL and localStorage fallbacks
- **Data Compression**: LZ-string compression for optimal storage efficiency
- **Automatic Cleanup**: Configurable retention policies for pending changes and
  sessions
- **Backup and Recovery**: Automated backup creation and restoration
  capabilities
- **Storage Analytics**: Monitor storage usage and performance metrics
- **CLI Interface**: Command-line tools for data management and debugging

## Installation

```bash
pnpm add @ctrl-freaq/editor-persistence
```

## Quick Start

### Basic Storage Operations

```typescript
import {
  LocalStorageManager,
  createLocalStorageManager,
} from '@ctrl-freaq/editor-persistence';

// Create a storage manager instance
const storageManager = createLocalStorageManager({
  dbName: 'my-editor',
  version: 1,
  compression: true,
  maxChangeHistory: 100,
  maxSessionHistory: 50,
});

// Initialize storage
await storageManager.initialize();

// Save pending changes
const pendingChange = {
  id: 'change-123',
  sectionId: 'section-456',
  documentId: 'doc-789',
  patches: [{ op: 'add', path: '/line/1', value: 'New content' }],
  originalContent: 'Original content',
  previewContent: 'New content\nOriginal content',
  createdAt: new Date().toISOString(),
  createdBy: 'user@example.com',
  sessionId: 'session-abc',
  status: 'pending',
  conflictsWith: [],
};

await storageManager.savePendingChange(pendingChange);

// Load pending changes
const changes = await storageManager.loadPendingChanges(
  'doc-789',
  'section-456'
);
console.log('Loaded changes:', changes);

// Save editor session
const editorSession = {
  documentId: 'doc-789',
  userId: 'user-123',
  sessionId: 'session-abc',
  activeSectionId: 'section-456',
  expandedSections: ['section-1', 'section-2'],
  scrollPosition: 100,
  editorMode: 'wysiwyg' as const,
  showDiffView: false,
  autoSaveEnabled: true,
  autoSaveInterval: 30000,
  collaborators: [],
  lastSaveTime: Date.now(),
  pendingChangeCount: 3,
};

await storageManager.saveEditorSession(editorSession);

// Load editor session
const session = await storageManager.loadEditorSession(
  'doc-789',
  'session-abc'
);
console.log('Loaded session:', session);
```

### Storage Statistics

```typescript
// Get storage usage statistics
const stats = await storageManager.getStats();
console.log('Storage stats:', {
  totalSize: stats.totalSize,
  itemCounts: stats.itemCounts,
  lastCleanup: stats.lastCleanup,
});
```

### Backup and Recovery

```typescript
// Create backup
const backupId = await storageManager.createBackup(
  'pendingChanges',
  pendingChange
);
console.log('Backup created:', backupId);

// Restore from backup
const restoredData = await storageManager.restoreBackup(backupId);
if (restoredData) {
  console.log('Restored:', restoredData);
}
```

### Custom Configuration

```typescript
const customManager = new LocalStorageManager({
  dbName: 'custom-editor',
  version: 2,
  compression: false,
  maxChangeHistory: 200,
  maxSessionHistory: 100,
  storeName: {
    pendingChanges: 'custom_changes',
    editorSessions: 'custom_sessions',
    backups: 'custom_backups',
    preferences: 'custom_preferences',
  },
});
```

## CLI Usage

The package provides CLI commands for data management and debugging.

### Installation

Install the CLI globally or use via pnpm:

```bash
# Install globally
pnpm add -g @ctrl-freaq/editor-persistence

# Or use with pnpm
pnpm --filter @ctrl-freaq/editor-persistence cli --help
```

### Commands

#### Storage Information

Get storage statistics and information:

```bash
editor-persistence info --database ctrl-freaq-editor
```

Options:

- `--database, -d`: Database name (default: ctrl-freaq-editor)
- `--verbose, -v`: Show detailed information
- `--format, -f`: Output format: json, table (default: table)

#### List Data

List stored items by type:

```bash
editor-persistence list pending-changes --document doc-123
```

Options:

- `--document`: Filter by document ID
- `--section`: Filter by section ID
- `--limit, -l`: Maximum number of items (default: 10)
- `--format, -f`: Output format: json, table (default: table)

Available data types:

- `pending-changes`: Pending changes
- `editor-sessions`: Editor sessions
- `backups`: Backup entries
- `preferences`: User preferences

#### Export Data

Export data to files:

```bash
editor-persistence export pending-changes --output changes.json
```

Options:

- `--output, -o`: Output file (default: stdout)
- `--document`: Filter by document ID
- `--compress`: Compress output data
- `--format, -f`: Output format: json, csv (default: json)

#### Import Data

Import data from files:

```bash
editor-persistence import pending-changes changes.json
```

Options:

- `--file, -f`: Input file
- `--merge`: Merge with existing data (default: replace)
- `--validate`: Validate data before importing

#### Cleanup Operations

Clean up old data:

```bash
editor-persistence cleanup --older-than 7d
```

Options:

- `--older-than`: Age threshold (e.g., 7d, 24h, 30m)
- `--type`: Data type to clean (default: all)
- `--dry-run`: Show what would be deleted without deleting
- `--force`: Skip confirmation prompts

#### Backup Operations

Create and manage backups:

```bash
# Create backup
editor-persistence backup create --type full --output backup.json

# List backups
editor-persistence backup list

# Restore backup
editor-persistence backup restore backup-id-123

# Delete backup
editor-persistence backup delete backup-id-123
```

#### Performance Testing

Run performance benchmarks:

```bash
editor-persistence test performance --operations 1000
```

Options:

- `--operations, -o`: Number of test operations (default: 100)
- `--data-size`: Test data size: small, medium, large (default: medium)
- `--compression`: Test with compression enabled

#### Database Management

Manage database structure:

```bash
# Initialize database
editor-persistence db init --name test-editor

# Clear database
editor-persistence db clear --name test-editor --confirm

# Migrate database
editor-persistence db migrate --from-version 1 --to-version 2
```

### Examples

```bash
# Get storage information
editor-persistence info -v

# List recent pending changes
editor-persistence list pending-changes --limit 20

# Export all data for a document
editor-persistence export pending-changes --document doc-123 -o doc-123-changes.json

# Clean up data older than 30 days
editor-persistence cleanup --older-than 30d --dry-run

# Create full backup
editor-persistence backup create --type full -o backup-$(date +%Y%m%d).json

# Test storage performance
editor-persistence test performance -o 500 --data-size large

# Clear all data (with confirmation)
editor-persistence db clear --name ctrl-freaq-editor
```

## API Reference

### LocalStorageManager

Main class for local storage operations.

#### Constructor

```typescript
constructor(config?: LocalStorageConfig)
```

**LocalStorageConfig:**

```typescript
interface LocalStorageConfig {
  dbName?: string; // Database name (default: 'ctrl-freaq-editor')
  version?: number; // Database version (default: 1)
  compression?: boolean; // Enable compression (default: true)
  maxChangeHistory?: number; // Max pending changes (default: 100)
  maxSessionHistory?: number; // Max editor sessions (default: 50)
  storeName?: {
    pendingChanges?: string; // Store name for pending changes
    editorSessions?: string; // Store name for editor sessions
    backups?: string; // Store name for backups
    preferences?: string; // Store name for preferences
  };
}
```

#### Methods

##### initialize()

Initialize storage with proper configuration.

**Returns:** `Promise<void>`

##### savePendingChange(change)

Save pending change to local storage.

**Parameters:**

- `change: PendingChange` - Pending change to save

**Returns:** `Promise<void>`

##### loadPendingChanges(documentId, sectionId?)

Load pending changes for a document or section.

**Parameters:**

- `documentId: string` - Document ID to filter by
- `sectionId?: string` - Optional section ID to filter by

**Returns:** `Promise<PendingChange[]>` - Array of pending changes

##### removePendingChange(documentId, sectionId, changeId)

Remove pending change from storage.

**Parameters:**

- `documentId: string` - Document ID
- `sectionId: string` - Section ID
- `changeId: string` - Change ID

**Returns:** `Promise<void>`

##### saveEditorSession(session)

Save editor session.

**Parameters:**

- `session: EditorSession` - Editor session to save

**Returns:** `Promise<void>`

##### loadEditorSession(documentId, sessionId)

Load editor session.

**Parameters:**

- `documentId: string` - Document ID
- `sessionId: string` - Session ID

**Returns:** `Promise<EditorSession | null>`

##### listEditorSessions(documentId)

List all editor sessions for a document.

**Parameters:**

- `documentId: string` - Document ID

**Returns:** `Promise<EditorSession[]>`

##### createBackup(type, data)

Create backup of data.

**Parameters:**

- `type: 'pendingChanges' | 'editorSession' | 'full'` - Backup type
- `data: unknown` - Data to backup

**Returns:** `Promise<string>` - Backup ID

##### restoreBackup(backupId)

Restore from backup.

**Parameters:**

- `backupId: string` - Backup ID

**Returns:** `Promise<BackupEntry | null>`

##### getStats()

Get storage statistics.

**Returns:** `Promise<StorageStats>`

##### clear()

Clear all data from storage.

**Returns:** `Promise<void>`

### Types

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

#### EditorSession

```typescript
interface EditorSession {
  documentId: string;
  userId: string;
  sessionId: string;
  activeSectionId: string | null;
  expandedSections: string[];
  scrollPosition: number;
  editorMode: 'wysiwyg' | 'markdown' | 'preview';
  showDiffView: boolean;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  collaborators: Array<{
    userId: string;
    userName: string;
    activeSectionId: string | null;
    lastActivity: string;
  }>;
  lastSaveTime: number;
  pendingChangeCount: number;
}
```

#### BackupEntry

```typescript
interface BackupEntry {
  id: string;
  timestamp: number;
  type: 'pendingChanges' | 'editorSession' | 'full';
  data: unknown;
  compressed: boolean;
  size: number;
}
```

#### StorageStats

```typescript
interface StorageStats {
  totalSize: number;
  itemCounts: {
    pendingChanges: number;
    editorSessions: number;
    backups: number;
    preferences: number;
  };
  lastCleanup: number;
  compressionRatio?: number;
}
```

## Storage Strategy

### Client-Side Storage

- **Primary**: IndexedDB via localforage for reliable persistence
- **Fallback**: WebSQL → localStorage for compatibility
- **Compression**: LZ-string for reduced storage usage
- **Encryption**: Optional encryption for sensitive data

### Data Organization

```
Database: ctrl-freaq-editor
├── pending_changes/     # Pending document changes
├── editor_sessions/     # Active editing sessions
├── backups/            # Backup entries
└── preferences/        # User preferences
```

### Cleanup Policies

- **Pending Changes**: Keep last 100 per configuration
- **Editor Sessions**: Keep last 50 per configuration
- **Backups**: Keep last 20 automatically
- **Preferences**: Never auto-deleted

## Performance Characteristics

- **Storage Operations**: Optimized for frequent read/write
- **Compression**: ~60-80% size reduction for text content
- **Cleanup**: Background cleanup every 10 minutes
- **Memory Usage**: Minimal memory footprint with streaming

## Error Handling

The package uses comprehensive error handling:

```typescript
try {
  await storageManager.savePendingChange(change);
} catch (error) {
  if (error.message.includes('Failed to save pending change')) {
    // Handle storage error
  }
}
```

## Integration

### With Patch Engine

```typescript
import { patchEngine } from '@ctrl-freaq/editor-core';
import { localStorageManager } from '@ctrl-freaq/editor-persistence';

async function savePendingChanges(sectionId: string, newContent: string) {
  const section = await getSectionContent(sectionId);

  const pendingChange = patchEngine.createPendingChange(
    sectionId,
    section.documentId,
    section.content,
    newContent,
    'current-user',
    'current-session'
  );

  await localStorageManager.savePendingChange(pendingChange);
}
```

### With React Hooks

```typescript
import { useEffect, useState } from 'react';
import { localStorageManager } from '@ctrl-freaq/editor-persistence';

function usePendingChanges(documentId: string) {
  const [changes, setChanges] = useState<PendingChange[]>([]);

  useEffect(() => {
    const loadChanges = async () => {
      const pendingChanges =
        await localStorageManager.loadPendingChanges(documentId);
      setChanges(pendingChanges);
    };

    loadChanges();
  }, [documentId]);

  const saveChange = async (change: PendingChange) => {
    await localStorageManager.savePendingChange(change);
    setChanges(prev => [...prev, change]);
  };

  return { changes, saveChange };
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
4. Consider storage efficiency and performance
5. Follow the Constitutional requirements for library-first architecture

## Browser Compatibility

- **Modern browsers**: Full IndexedDB support
- **Fallback support**: WebSQL (deprecated but functional)
- **Legacy support**: localStorage (limited functionality)
- **Compression**: Supported in all environments

## License

Part of the CTRL FreaQ project. See main project license.

## Related Packages

- [`@ctrl-freaq/editor-core`](../editor-core) - Core patch engine and operations
- [`@ctrl-freaq/shared-data`](../shared-data) - Database access and repositories
- [`@ctrl-freaq/web`](../../apps/web) - Web application and UI components
