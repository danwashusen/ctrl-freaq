/**
 * @ctrl-freaq/editor-persistence - Client-side persistence library
 *
 * This package provides client-side persistence capabilities for CTRL FreaQ
 * editor state management, including local storage, IndexedDB, synchronization,
 * and backup functionality with compression and conflict resolution.
 */

// Core persistence functionality exports
export * from './storage/index';
export * from './sync/index';
export * from './local-storage';
export * from './assumption-sessions/session-store';
export * from './assumption-sessions/bridge';

// Core types and interfaces
export interface StorageConfig {
  type: 'localStorage' | 'indexedDB' | 'memory';
  prefix?: string;
  compression?: boolean;
  encryption?: boolean;
  quota?: number;
}

export interface StorageProvider {
  name: string;
  available: boolean;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
}

export interface SyncConfig {
  enabled: boolean;
  mode: 'auto' | 'manual' | 'offline';
  interval?: number;
  endpoint?: string;
  conflictResolution: 'client' | 'server' | 'merge' | 'prompt';
}

export interface SyncState {
  lastSync: Date | null;
  pendingChanges: number;
  conflicts: SyncConflict[];
  status: 'idle' | 'syncing' | 'error';
}

export interface SyncConflict {
  id: string;
  key: string;
  clientValue: unknown;
  serverValue: unknown;
  timestamp: Date;
}

export interface BackupConfig {
  enabled: boolean;
  maxBackups: number;
  compression: boolean;
  interval?: number;
}

export interface Backup {
  id: string;
  timestamp: Date;
  data: unknown;
  size: number;
  compressed: boolean;
  checksum: string;
}

export interface EditorState {
  content: unknown;
  selection?: unknown;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  version: number;
}

// Placeholder implementation classes
export class PersistenceManager {
  private storage: StorageProvider;
  private syncConfig: SyncConfig;
  private backupConfig: BackupConfig;

  constructor(
    storage: StorageProvider,
    syncConfig: SyncConfig = { enabled: false, mode: 'manual', conflictResolution: 'client' },
    backupConfig: BackupConfig = { enabled: false, maxBackups: 10, compression: true }
  ) {
    this.storage = storage;
    this.syncConfig = syncConfig;
    this.backupConfig = backupConfig;
  }

  async saveState(key: string, state: EditorState): Promise<void> {
    // Placeholder implementation
    await this.storage.set(key, state);
  }

  async loadState(key: string): Promise<EditorState | null> {
    // Placeholder implementation
    return await this.storage.get<EditorState>(key);
  }

  async createBackup(state: EditorState): Promise<Backup> {
    // Placeholder implementation - use backupConfig for compression and settings
    const useCompression = this.backupConfig.compression;
    const backup: Backup = {
      id: `backup_${Date.now()}`,
      timestamp: new Date(),
      data: state,
      size: JSON.stringify(state).length,
      compressed: useCompression,
      checksum: 'placeholder_checksum',
    };

    await this.storage.set(`backup_${backup.id}`, backup);
    return backup;
  }

  async listBackups(): Promise<Backup[]> {
    // Placeholder implementation
    const keys = await this.storage.keys();
    const backupKeys = keys.filter(key => key.startsWith('backup_'));
    const backups: Backup[] = [];

    for (const key of backupKeys) {
      const backup = await this.storage.get<Backup>(key);
      if (backup) backups.push(backup);
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async sync(): Promise<SyncState> {
    // Placeholder implementation - use syncConfig in real implementation
    const isEnabled = this.syncConfig.enabled;
    return {
      lastSync: isEnabled ? new Date() : null,
      pendingChanges: 0,
      conflicts: [],
      status: isEnabled ? 'idle' : 'idle',
    };
  }
}

export class LocalStorageProvider implements StorageProvider {
  name = 'localStorage';
  available = typeof localStorage !== 'undefined';
  private prefix: string;

  constructor(prefix = 'ctrl-freaq-') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available) return null;

    const item = localStorage.getItem(this.prefix + key);
    if (!item) return null;

    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.available) return;

    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    if (!this.available) return;

    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    if (!this.available) return;

    const keys = await this.keys();
    for (const key of keys) {
      localStorage.removeItem(this.prefix + key);
    }
  }

  async keys(): Promise<string[]> {
    if (!this.available) return [];

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  async size(): Promise<number> {
    if (!this.available) return 0;

    let size = 0;
    const keys = await this.keys();
    for (const key of keys) {
      const item = localStorage.getItem(this.prefix + key);
      if (item) size += item.length;
    }
    return size;
  }
}

// Package metadata
export const packageInfo = {
  name: '@ctrl-freaq/editor-persistence',
  version: '0.1.0',
  description: 'Client-side persistence library for CTRL FreaQ editor state management',
};
