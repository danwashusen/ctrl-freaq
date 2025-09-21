/**
 * Local Storage Layer for Document Editor Core Infrastructure
 *
 * Client-side persistence using IndexedDB with localforage abstraction.
 * Supports pending changes, editor sessions, and compressed backups.
 */

import localforage from 'localforage';
import { compress, decompress } from 'lz-string';
import { z } from 'zod';
import { logger } from './logger';

// Storage schemas matching data model
export const PendingChangeSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  documentId: z.string(),
  patches: z.array(
    z.object({
      op: z.enum(['add', 'remove', 'replace']),
      path: z.string(),
      value: z.string().optional(),
      oldValue: z.string().optional(),
    })
  ),
  originalContent: z.string(),
  previewContent: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  sessionId: z.string(),
  status: z.enum(['pending', 'applying', 'applied', 'failed']),
  conflictsWith: z.array(z.string()),
});

export const EditorSessionSchema = z.object({
  documentId: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  activeSectionId: z.string().nullable(),
  expandedSections: z.array(z.string()),
  scrollPosition: z.number(),
  editorMode: z.enum(['wysiwyg', 'markdown', 'preview']),
  showDiffView: z.boolean(),
  autoSaveEnabled: z.boolean(),
  autoSaveInterval: z.number(),
  collaborators: z.array(
    z.object({
      userId: z.string(),
      userName: z.string(),
      activeSectionId: z.string().nullable(),
      lastActivity: z.string(),
    })
  ),
  lastSaveTime: z.number(),
  pendingChangeCount: z.number(),
});

export type PendingChange = z.infer<typeof PendingChangeSchema>;
export type EditorSession = z.infer<typeof EditorSessionSchema>;

export interface LocalStorageConfig {
  dbName?: string;
  version?: number;
  compression?: boolean;
  maxChangeHistory?: number;
  maxSessionHistory?: number;
  storeName?: {
    pendingChanges?: string;
    editorSessions?: string;
    backups?: string;
    preferences?: string;
  };
}

export interface BackupEntry {
  id: string;
  timestamp: number;
  type: 'pendingChanges' | 'editorSession' | 'full';
  data: unknown;
  compressed: boolean;
  size: number;
}

export interface StorageStats {
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

/**
 * Local storage manager using IndexedDB via localforage
 */
export class LocalStorageManager {
  private config: Required<LocalStorageConfig>;
  private stores: Map<string, LocalForage> = new Map();
  private initialized = false;

  constructor(config: LocalStorageConfig = {}) {
    this.config = {
      dbName: 'ctrl-freaq-editor',
      version: 1,
      compression: true,
      maxChangeHistory: 100,
      maxSessionHistory: 50,
      storeName: {
        pendingChanges: 'pending_changes',
        editorSessions: 'editor_sessions',
        backups: 'backups',
        preferences: 'preferences',
        ...config.storeName,
      },
      ...config,
    };
  }

  /**
   * Initialize storage with proper configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure stores
      const storeNames = Object.values(this.config.storeName);

      for (const storeName of storeNames) {
        const store = localforage.createInstance({
          name: this.config.dbName,
          version: this.config.version,
          storeName: storeName,
          driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
        });

        this.stores.set(storeName, store);
      }

      this.initialized = true;

      // Run cleanup on initialization
      await this.cleanupOldData();
    } catch (error) {
      throw new Error(
        `Failed to initialize local storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save pending change to local storage
   */
  async savePendingChange(change: PendingChange): Promise<void> {
    await this.ensureInitialized();

    try {
      // Validate change data
      const validatedChange = PendingChangeSchema.parse(change);

      const storeName = this.config.storeName.pendingChanges;
      if (!storeName) throw new Error('Pending changes store name not configured');

      const store = this.stores.get(storeName);
      if (!store) throw new Error('Pending changes store not initialized');

      // Compress data if enabled
      const data = this.config.compression
        ? compress(JSON.stringify(validatedChange))
        : validatedChange;

      const key = `${validatedChange.documentId}:${validatedChange.sectionId}:${validatedChange.id}`;
      await store.setItem(key, data);

      // Update metadata
      await this.updateMetadata('pendingChanges', 1);

      // Create backup if this is a significant change
      if (validatedChange.patches.length > 5) {
        await this.createBackup('pendingChanges', validatedChange);
      }
    } catch (error) {
      throw new Error(
        `Failed to save pending change: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load pending changes for a section
   */
  async loadPendingChanges(documentId: string, sectionId?: string): Promise<PendingChange[]> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.pendingChanges;
      if (!storeName) return [];

      const store = this.stores.get(storeName);
      if (!store) return [];

      const keys = await store.keys();
      const changes: PendingChange[] = [];

      for (const key of keys) {
        if (typeof key !== 'string') continue;

        const [docId, secId] = key.split(':');
        if (docId !== documentId) continue;
        if (sectionId && secId !== sectionId) continue;

        const data = await store.getItem(key);
        if (!data) continue;

        try {
          const changeData =
            this.config.compression && typeof data === 'string'
              ? JSON.parse(decompress(data) || '{}')
              : data;

          const validatedChange = PendingChangeSchema.parse(changeData);
          changes.push(validatedChange);
        } catch (parseError) {
          logger.warn(
            {
              operation: 'parse_pending_change',
              key: key,
              error: parseError instanceof Error ? parseError.message : String(parseError),
            },
            `Failed to parse pending change ${key}`
          );
        }
      }

      // Sort by creation time (newest first)
      return changes.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      throw new Error(
        `Failed to load pending changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove pending change from storage
   */
  async removePendingChange(
    documentId: string,
    sectionId: string,
    changeId: string
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.pendingChanges;
      if (!storeName) return;

      const store = this.stores.get(storeName);
      if (!store) return;

      const key = `${documentId}:${sectionId}:${changeId}`;
      await store.removeItem(key);

      // Update metadata
      await this.updateMetadata('pendingChanges', -1);
    } catch (error) {
      throw new Error(
        `Failed to remove pending change: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save editor session
   */
  async saveEditorSession(session: EditorSession): Promise<void> {
    await this.ensureInitialized();

    try {
      // Validate session data
      const validatedSession = EditorSessionSchema.parse(session);

      const storeName = this.config.storeName.editorSessions;
      if (!storeName) throw new Error('Editor sessions store name not configured');

      const store = this.stores.get(storeName);
      if (!store) throw new Error('Editor sessions store not initialized');

      // Compress data if enabled
      const data = this.config.compression
        ? compress(JSON.stringify(validatedSession))
        : validatedSession;

      const key = `${validatedSession.documentId}:${validatedSession.sessionId}`;
      await store.setItem(key, data);

      // Update metadata
      await this.updateMetadata('editorSessions', 1);
    } catch (error) {
      throw new Error(
        `Failed to save editor session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load editor session
   */
  async loadEditorSession(documentId: string, sessionId: string): Promise<EditorSession | null> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.editorSessions;
      if (!storeName) return null;

      const store = this.stores.get(storeName);
      if (!store) return null;

      const key = `${documentId}:${sessionId}`;
      const data = await store.getItem(key);
      if (!data) return null;

      const sessionData =
        this.config.compression && typeof data === 'string'
          ? JSON.parse(decompress(data) || '{}')
          : data;

      return EditorSessionSchema.parse(sessionData);
    } catch (error) {
      logger.warn(
        {
          operation: 'load_editor_session',
          documentId,
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        `Failed to load editor session ${documentId}:${sessionId}`
      );
      return null;
    }
  }

  /**
   * List all editor sessions for a document
   */
  async listEditorSessions(documentId: string): Promise<EditorSession[]> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.editorSessions;
      if (!storeName) return [];

      const store = this.stores.get(storeName);
      if (!store) return [];

      const keys = await store.keys();
      const sessions: EditorSession[] = [];

      for (const key of keys) {
        if (typeof key !== 'string' || !key.startsWith(`${documentId}:`)) continue;

        const data = await store.getItem(key);
        if (!data) continue;

        try {
          const sessionData =
            this.config.compression && typeof data === 'string'
              ? JSON.parse(decompress(data) || '{}')
              : data;

          const validatedSession = EditorSessionSchema.parse(sessionData);
          sessions.push(validatedSession);
        } catch (parseError) {
          logger.warn(
            {
              operation: 'parse_editor_session',
              key: key,
              error: parseError instanceof Error ? parseError.message : String(parseError),
            },
            `Failed to parse editor session ${key}`
          );
        }
      }

      return sessions.sort((a, b) => b.lastSaveTime - a.lastSaveTime);
    } catch (error) {
      throw new Error(
        `Failed to list editor sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create backup of important data
   */
  async createBackup(
    type: 'pendingChanges' | 'editorSession' | 'full',
    data: unknown
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.backups;
      if (!storeName) throw new Error('Backups store name not configured');

      const store = this.stores.get(storeName);
      if (!store) throw new Error('Backups store not initialized');

      const backup: BackupEntry = {
        id: `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type,
        data,
        compressed: this.config.compression,
        size: JSON.stringify(data).length,
      };

      const backupData = this.config.compression ? compress(JSON.stringify(backup)) : backup;

      await store.setItem(backup.id, backupData);

      // Cleanup old backups
      await this.cleanupOldBackups();

      return backup.id;
    } catch (error) {
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<BackupEntry | null> {
    await this.ensureInitialized();

    try {
      const storeName = this.config.storeName.backups;
      if (!storeName) return null;

      const store = this.stores.get(storeName);
      if (!store) return null;

      const data = await store.getItem(backupId);
      if (!data) return null;

      const backupData =
        this.config.compression && typeof data === 'string'
          ? JSON.parse(decompress(data) || '{}')
          : data;

      return backupData as BackupEntry;
    } catch (error) {
      logger.warn(
        {
          operation: 'restore_backup',
          backupId,
          error: error instanceof Error ? error.message : String(error),
        },
        `Failed to restore backup ${backupId}`
      );
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    try {
      const stats: StorageStats = {
        totalSize: 0,
        itemCounts: {
          pendingChanges: 0,
          editorSessions: 0,
          backups: 0,
          preferences: 0,
        },
        lastCleanup: Date.now(),
      };

      for (const [storeName, store] of this.stores) {
        const keys = await store.keys();
        const itemCount = keys.length;

        // Map store names to stat categories
        if (storeName === this.config.storeName.pendingChanges) {
          stats.itemCounts.pendingChanges = itemCount;
        } else if (storeName === this.config.storeName.editorSessions) {
          stats.itemCounts.editorSessions = itemCount;
        } else if (storeName === this.config.storeName.backups) {
          stats.itemCounts.backups = itemCount;
        } else if (storeName === this.config.storeName.preferences) {
          stats.itemCounts.preferences = itemCount;
        }

        // Calculate approximate size
        for (const key of keys) {
          const item = await store.getItem(key);
          if (item) {
            stats.totalSize += JSON.stringify(item).length;
          }
        }
      }

      return stats;
    } catch (error) {
      throw new Error(
        `Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear all data from storage
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
      for (const store of this.stores.values()) {
        await store.clear();
      }
    } catch (error) {
      throw new Error(
        `Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Cleanup old data based on retention policies
   */
  private async cleanupOldData(): Promise<void> {
    try {
      // Cleanup old pending changes
      await this.cleanupOldPendingChanges();

      // Cleanup old editor sessions
      await this.cleanupOldEditorSessions();

      // Cleanup old backups
      await this.cleanupOldBackups();
    } catch (error) {
      logger.warn(
        {
          operation: 'cleanup_old_data',
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to cleanup old data'
      );
    }
  }

  /**
   * Cleanup old pending changes
   */
  private async cleanupOldPendingChanges(): Promise<void> {
    const storeName = this.config.storeName.pendingChanges;
    if (!storeName) return;

    const store = this.stores.get(storeName);
    if (!store) return;

    const keys = await store.keys();
    if (keys.length <= this.config.maxChangeHistory) return;

    // Get all changes with timestamps
    const changes: { key: string; createdAt: number }[] = [];

    for (const key of keys) {
      if (typeof key !== 'string') continue;

      const data = await store.getItem(key);
      if (!data) continue;

      try {
        const changeData =
          this.config.compression && typeof data === 'string'
            ? JSON.parse(decompress(data) || '{}')
            : data;

        const change = PendingChangeSchema.parse(changeData);
        changes.push({
          key: key,
          createdAt: new Date(change.createdAt).getTime(),
        });
      } catch {
        // Remove invalid entries
        await store.removeItem(key);
      }
    }

    // Sort by creation time and remove oldest
    changes.sort((a, b) => b.createdAt - a.createdAt);
    const toRemove = changes.slice(this.config.maxChangeHistory);

    for (const change of toRemove) {
      await store.removeItem(change.key);
    }
  }

  /**
   * Cleanup old editor sessions
   */
  private async cleanupOldEditorSessions(): Promise<void> {
    const storeName = this.config.storeName.editorSessions;
    if (!storeName) return;

    const store = this.stores.get(storeName);
    if (!store) return;

    const keys = await store.keys();
    if (keys.length <= this.config.maxSessionHistory) return;

    // Get all sessions with timestamps
    const sessions: { key: string; lastSaveTime: number }[] = [];

    for (const key of keys) {
      if (typeof key !== 'string') continue;

      const data = await store.getItem(key);
      if (!data) continue;

      try {
        const sessionData =
          this.config.compression && typeof data === 'string'
            ? JSON.parse(decompress(data) || '{}')
            : data;

        const session = EditorSessionSchema.parse(sessionData);
        sessions.push({
          key: key,
          lastSaveTime: session.lastSaveTime,
        });
      } catch {
        // Remove invalid entries
        await store.removeItem(key);
      }
    }

    // Sort by last save time and remove oldest
    sessions.sort((a, b) => b.lastSaveTime - a.lastSaveTime);
    const toRemove = sessions.slice(this.config.maxSessionHistory);

    for (const session of toRemove) {
      await store.removeItem(session.key);
    }
  }

  /**
   * Cleanup old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const storeName = this.config.storeName.backups;
    if (!storeName) return;

    const store = this.stores.get(storeName);
    if (!store) return;

    const keys = await store.keys();
    const maxBackups = 20; // Keep last 20 backups

    if (keys.length <= maxBackups) return;

    // Get all backups with timestamps
    const backups: { key: string; timestamp: number }[] = [];

    for (const key of keys) {
      if (typeof key !== 'string') continue;

      const data = await store.getItem(key);
      if (!data) continue;

      try {
        const backupData =
          this.config.compression && typeof data === 'string'
            ? JSON.parse(decompress(data) || '{}')
            : data;

        backups.push({
          key: key,
          timestamp: backupData.timestamp || 0,
        });
      } catch {
        // Remove invalid entries
        await store.removeItem(key);
      }
    }

    // Sort by timestamp and remove oldest
    backups.sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = backups.slice(maxBackups);

    for (const backup of toRemove) {
      await store.removeItem(backup.key);
    }
  }

  /**
   * Update metadata counters
   */
  private async updateMetadata(_type: string, _delta: number): Promise<void> {
    // This could be used for analytics or monitoring
    // For now, it's a placeholder for future metadata tracking
  }
}

// Factory function for creating configured storage manager
export function createLocalStorageManager(config?: LocalStorageConfig): LocalStorageManager {
  return new LocalStorageManager(config);
}

// Export default instance
export const localStorageManager = createLocalStorageManager();
