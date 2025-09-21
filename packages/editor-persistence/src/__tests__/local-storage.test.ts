import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import localforage from 'localforage';
import { compress, decompress } from 'lz-string';
import {
  LocalStorageManager,
  createLocalStorageManager,
  localStorageManager,
  PendingChange,
  EditorSession,
  LocalStorageConfig,
  BackupEntry,
} from '../local-storage';

// Mock localforage
vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn(),
    INDEXEDDB: 'indexeddb',
    WEBSQL: 'websql',
    LOCALSTORAGE: 'localstorage',
  },
}));

// Mock lz-string
vi.mock('lz-string', () => ({
  compress: vi.fn((str: string) => `compressed:${str}`),
  decompress: vi.fn((str: string) => str.replace('compressed:', '')),
}));

describe('LocalStorageManager', () => {
  let manager: LocalStorageManager;
  let mockStore: any;

  beforeEach(() => {
    // Create mock store
    mockStore = {
      setItem: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn().mockResolvedValue(null),
      removeItem: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
    };

    // Mock localforage.createInstance
    vi.mocked(localforage.createInstance).mockReturnValue(mockStore);

    manager = new LocalStorageManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset lz-string mocks to default behavior
    vi.mocked(compress).mockImplementation((str: string) => `compressed:${str}`);
    vi.mocked(decompress).mockImplementation((str: string) => str.replace('compressed:', ''));
  });

  describe('constructor and initialization', () => {
    it('creates instance with default configuration', () => {
      const defaultManager = new LocalStorageManager();
      expect(defaultManager).toBeInstanceOf(LocalStorageManager);
    });

    it('applies custom configuration', () => {
      const config: LocalStorageConfig = {
        dbName: 'test-db',
        version: 2,
        compression: false,
        maxChangeHistory: 50,
        maxSessionHistory: 25,
        storeName: {
          pendingChanges: 'custom_changes',
          editorSessions: 'custom_sessions',
        },
      };

      const customManager = new LocalStorageManager(config);
      expect(customManager).toBeInstanceOf(LocalStorageManager);
    });

    it('exports factory function and default instance', () => {
      expect(createLocalStorageManager).toBeTypeOf('function');
      expect(localStorageManager).toBeInstanceOf(LocalStorageManager);
    });

    it('initializes localforage stores correctly', async () => {
      await manager.initialize();

      expect(localforage.createInstance).toHaveBeenCalledTimes(4); // 4 stores
      expect(localforage.createInstance).toHaveBeenCalledWith({
        name: 'ctrl-freaq-editor',
        version: 1,
        storeName: 'pending_changes',
        driver: ['indexeddb', 'websql', 'localstorage'],
      });
    });

    it('only initializes once when called multiple times', async () => {
      await manager.initialize();
      await manager.initialize();
      await manager.initialize();

      expect(localforage.createInstance).toHaveBeenCalledTimes(4); // Only called once for all 4 stores
    });

    it('throws error on initialization failure', async () => {
      vi.mocked(localforage.createInstance).mockImplementation(() => {
        throw new Error('IndexedDB not available');
      });

      await expect(manager.initialize()).rejects.toThrow(
        'Failed to initialize local storage: IndexedDB not available'
      );
    });
  });

  describe('pending changes operations', () => {
    const mockPendingChange: PendingChange = {
      id: 'change-123',
      sectionId: 'section-456',
      documentId: 'doc-789',
      patches: [
        { op: 'add', path: '/line/1', value: 'New content' },
        { op: 'remove', path: '/line/2', oldValue: 'Old content' },
      ],
      originalContent: 'Original content',
      previewContent: 'Modified content',
      createdAt: '2025-09-20T10:00:00Z',
      createdBy: 'user-123',
      sessionId: 'session-456',
      status: 'pending',
      conflictsWith: [],
    };

    beforeEach(async () => {
      await manager.initialize();
    });

    it('saves pending change with compression', async () => {
      await manager.savePendingChange(mockPendingChange);

      const expectedKey = 'doc-789:section-456:change-123';
      expect(mockStore.setItem).toHaveBeenCalledWith(
        expectedKey,
        `compressed:${JSON.stringify(mockPendingChange)}`
      );
      expect(compress).toHaveBeenCalledWith(JSON.stringify(mockPendingChange));
    });

    it('saves pending change without compression when disabled', async () => {
      const managerNoCompression = new LocalStorageManager({ compression: false });
      await managerNoCompression.initialize();

      await managerNoCompression.savePendingChange(mockPendingChange);

      const expectedKey = 'doc-789:section-456:change-123';
      expect(mockStore.setItem).toHaveBeenCalledWith(expectedKey, mockPendingChange);
    });

    it('validates pending change data before saving', async () => {
      const invalidChange = {
        ...mockPendingChange,
        status: 'invalid-status', // Invalid enum value
      } as any;

      await expect(manager.savePendingChange(invalidChange)).rejects.toThrow(
        'Failed to save pending change'
      );
    });

    it('loads pending changes for a document', async () => {
      const keys = ['doc-789:section-456:change-123', 'doc-789:section-456:change-124'];
      mockStore.keys.mockResolvedValue(keys);
      mockStore.getItem
        .mockResolvedValueOnce(`compressed:${JSON.stringify(mockPendingChange)}`)
        .mockResolvedValueOnce(
          `compressed:${JSON.stringify({ ...mockPendingChange, id: 'change-124' })}`
        );

      const changes = await manager.loadPendingChanges('doc-789');

      expect(changes).toHaveLength(2);
      expect(changes[0].id).toBe('change-123');
      expect(decompress).toHaveBeenCalledTimes(2);
    });

    it('loads pending changes for a specific section', async () => {
      const keys = [
        'doc-789:section-456:change-123',
        'doc-789:section-789:change-124', // Different section
      ];
      mockStore.keys.mockResolvedValue(keys);
      mockStore.getItem.mockResolvedValueOnce(`compressed:${JSON.stringify(mockPendingChange)}`);

      const changes = await manager.loadPendingChanges('doc-789', 'section-456');

      expect(changes).toHaveLength(1);
      expect(changes[0].id).toBe('change-123');
      expect(mockStore.getItem).toHaveBeenCalledTimes(1);
    });

    it('sorts pending changes by creation time (newest first)', async () => {
      const olderChange = {
        ...mockPendingChange,
        id: 'change-old',
        createdAt: '2025-09-20T09:00:00Z',
      };
      const newerChange = {
        ...mockPendingChange,
        id: 'change-new',
        createdAt: '2025-09-20T11:00:00Z',
      };

      mockStore.keys.mockResolvedValue([
        'doc-789:section-456:change-old',
        'doc-789:section-456:change-new',
      ]);
      mockStore.getItem
        .mockResolvedValueOnce(`compressed:${JSON.stringify(olderChange)}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(newerChange)}`);

      const changes = await manager.loadPendingChanges('doc-789');

      expect(changes[0].id).toBe('change-new'); // Newer change first
      expect(changes[1].id).toBe('change-old');
    });

    it('handles corrupted pending change data gracefully', async () => {
      const { logger } = await import('../logger');
      const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      mockStore.keys.mockResolvedValue(['doc-789:section-456:change-123']);
      mockStore.getItem.mockResolvedValue('compressed:invalid-json');
      vi.mocked(decompress).mockReturnValue('invalid-json');

      const changes = await manager.loadPendingChanges('doc-789');

      expect(changes).toHaveLength(0);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'parse_pending_change',
          key: 'doc-789:section-456:change-123',
        }),
        expect.stringContaining('Failed to parse pending change')
      );

      loggerSpy.mockRestore();
    });

    it('removes pending change', async () => {
      await manager.removePendingChange('doc-789', 'section-456', 'change-123');

      expect(mockStore.removeItem).toHaveBeenCalledWith('doc-789:section-456:change-123');
    });

    it('handles remove operation when store is not initialized', async () => {
      const uninitializedManager = new LocalStorageManager();

      // Should not throw
      await expect(
        uninitializedManager.removePendingChange('doc', 'section', 'change')
      ).resolves.not.toThrow();
    });
  });

  describe('editor session operations', () => {
    const mockEditorSession: EditorSession = {
      documentId: 'doc-789',
      userId: 'user-123',
      sessionId: 'session-456',
      activeSectionId: 'section-789',
      expandedSections: ['section-1', 'section-2'],
      scrollPosition: 100,
      editorMode: 'wysiwyg',
      showDiffView: false,
      autoSaveEnabled: true,
      autoSaveInterval: 30000,
      collaborators: [
        {
          userId: 'user-456',
          userName: 'John Doe',
          activeSectionId: 'section-123',
          lastActivity: '2025-09-20T10:00:00Z',
        },
      ],
      lastSaveTime: Date.now(),
      pendingChangeCount: 3,
    };

    beforeEach(async () => {
      await manager.initialize();
    });

    it('saves editor session', async () => {
      await manager.saveEditorSession(mockEditorSession);

      const expectedKey = 'doc-789:session-456';
      expect(mockStore.setItem).toHaveBeenCalledWith(
        expectedKey,
        `compressed:${JSON.stringify(mockEditorSession)}`
      );
    });

    it('validates editor session data before saving', async () => {
      const invalidSession = {
        ...mockEditorSession,
        editorMode: 'invalid-mode', // Invalid enum value
      } as any;

      await expect(manager.saveEditorSession(invalidSession)).rejects.toThrow(
        'Failed to save editor session'
      );
    });

    it('loads editor session', async () => {
      mockStore.getItem.mockResolvedValue(`compressed:${JSON.stringify(mockEditorSession)}`);

      const session = await manager.loadEditorSession('doc-789', 'session-456');

      expect(session).toEqual(mockEditorSession);
      expect(mockStore.getItem).toHaveBeenCalledWith('doc-789:session-456');
      expect(decompress).toHaveBeenCalled();
    });

    it('returns null when editor session not found', async () => {
      mockStore.getItem.mockResolvedValue(null);

      const session = await manager.loadEditorSession('doc-789', 'session-456');

      expect(session).toBeNull();
    });

    it('handles corrupted editor session data', async () => {
      const { logger } = await import('../logger');
      const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      mockStore.getItem.mockResolvedValue('compressed:invalid-json');
      vi.mocked(decompress).mockReturnValue('invalid-json');

      const session = await manager.loadEditorSession('doc-789', 'session-456');

      expect(session).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'load_editor_session',
          documentId: 'doc-789',
          sessionId: 'session-456',
        }),
        expect.stringContaining('Failed to load editor session')
      );

      loggerSpy.mockRestore();
    });

    it('lists all editor sessions for a document', async () => {
      const sessions = [
        { ...mockEditorSession, sessionId: 'session-1', lastSaveTime: 1000 },
        { ...mockEditorSession, sessionId: 'session-2', lastSaveTime: 2000 },
      ];

      mockStore.keys.mockResolvedValue(['doc-789:session-1', 'doc-789:session-2']);
      mockStore.getItem
        .mockResolvedValueOnce(`compressed:${JSON.stringify(sessions[0])}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(sessions[1])}`);

      const result = await manager.listEditorSessions('doc-789');

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-2'); // Sorted by lastSaveTime (desc)
      expect(result[1].sessionId).toBe('session-1');
    });

    it('filters sessions by document ID when listing', async () => {
      mockStore.keys.mockResolvedValue(['doc-789:session-1', 'doc-456:session-2']);
      mockStore.getItem.mockResolvedValueOnce(`compressed:${JSON.stringify(mockEditorSession)}`);

      const result = await manager.listEditorSessions('doc-789');

      expect(result).toHaveLength(1);
      expect(mockStore.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('backup operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('creates backup entry', async () => {
      const testData = { test: 'data' };

      const backupId = await manager.createBackup('pendingChanges', testData);

      expect(backupId).toMatch(/^backup_\d+_[a-z0-9]+$/);
      expect(mockStore.setItem).toHaveBeenCalledWith(
        backupId,
        expect.stringContaining('compressed:')
      );
    });

    it('creates backup with correct metadata', async () => {
      const testData = { test: 'data' };

      await manager.createBackup('full', testData);

      const [backupId, backupData] = mockStore.setItem.mock.calls[0];
      const decompressedData = JSON.parse(vi.mocked(decompress)(backupData));

      expect(decompressedData).toMatchObject({
        id: backupId,
        type: 'full',
        data: testData,
        compressed: true,
        size: JSON.stringify(testData).length,
      });
      expect(decompressedData.timestamp).toBeTypeOf('number');
    });

    it('restores backup entry', async () => {
      const mockBackup: BackupEntry = {
        id: 'backup-123',
        timestamp: Date.now(),
        type: 'pendingChanges',
        data: { test: 'data' },
        compressed: true,
        size: 100,
      };

      mockStore.getItem.mockResolvedValue(`compressed:${JSON.stringify(mockBackup)}`);

      const restored = await manager.restoreBackup('backup-123');

      expect(restored).toEqual(mockBackup);
      expect(decompress).toHaveBeenCalled();
    });

    it('returns null when backup not found', async () => {
      mockStore.getItem.mockResolvedValue(null);

      const restored = await manager.restoreBackup('backup-123');

      expect(restored).toBeNull();
    });

    it('handles corrupted backup data', async () => {
      const { logger } = await import('../logger');
      const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      mockStore.getItem.mockResolvedValue('compressed:invalid-json');
      vi.mocked(decompress).mockReturnValue('invalid-json');

      const restored = await manager.restoreBackup('backup-123');

      expect(restored).toBeNull();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'restore_backup',
          backupId: 'backup-123',
        }),
        expect.stringContaining('Failed to restore backup')
      );

      loggerSpy.mockRestore();
    });
  });

  describe('storage statistics', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('calculates storage statistics', async () => {
      // Mock different stores with different key counts
      const mockStores = new Map([
        [
          'pending_changes',
          {
            keys: vi.fn().mockResolvedValue(['key1', 'key2']),
            getItem: vi.fn().mockResolvedValue('{"test":"data"}'),
          },
        ],
        [
          'editor_sessions',
          {
            keys: vi.fn().mockResolvedValue(['key3']),
            getItem: vi.fn().mockResolvedValue('{"test":"data"}'),
          },
        ],
        [
          'backups',
          {
            keys: vi.fn().mockResolvedValue(['key4', 'key5', 'key6']),
            getItem: vi.fn().mockResolvedValue('{"test":"data"}'),
          },
        ],
        [
          'preferences',
          {
            keys: vi.fn().mockResolvedValue([]),
            getItem: vi.fn().mockResolvedValue('{"test":"data"}'),
          },
        ],
      ]);

      // Replace the stores map
      (manager as any).stores = mockStores;

      const stats = await manager.getStats();

      expect(stats).toMatchObject({
        itemCounts: {
          pendingChanges: 2,
          editorSessions: 1,
          backups: 3,
          preferences: 0,
        },
        totalSize: expect.any(Number),
        lastCleanup: expect.any(Number),
      });
    });

    it('handles empty storage when calculating stats', async () => {
      const stats = await manager.getStats();

      expect(stats.itemCounts.pendingChanges).toBe(0);
      expect(stats.itemCounts.editorSessions).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('cleanup operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('clears all storage', async () => {
      await manager.clear();

      expect(mockStore.clear).toHaveBeenCalledTimes(4); // One for each store
    });

    it('handles cleanup errors gracefully', async () => {
      const { logger } = await import('../logger');
      const loggerSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      // Create a fresh manager for this test
      const errorManager = new LocalStorageManager();

      // Mock cleanup method to throw an error
      (errorManager as any).cleanupOldPendingChanges = vi
        .fn()
        .mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw during initialization
      await expect(errorManager.initialize()).resolves.not.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'cleanup_old_data',
          error: 'Cleanup failed',
        }),
        'Failed to cleanup old data'
      );

      loggerSpy.mockRestore();
    });

    it('enforces retention policies for pending changes', async () => {
      const managerWithLowLimit = new LocalStorageManager({ maxChangeHistory: 2 });
      await managerWithLowLimit.initialize();

      // Mock more than 2 pending changes
      mockStore.keys.mockResolvedValue(['key1', 'key2', 'key3', 'key4']);

      const changes = [
        {
          id: 'change-1',
          sectionId: 'section-1',
          documentId: 'doc-1',
          patches: [],
          originalContent: '',
          previewContent: '',
          createdAt: '2025-09-20T08:00:00Z',
          createdBy: 'user-1',
          sessionId: 'session-1',
          status: 'pending',
          conflictsWith: [],
        },
        {
          id: 'change-2',
          sectionId: 'section-1',
          documentId: 'doc-1',
          patches: [],
          originalContent: '',
          previewContent: '',
          createdAt: '2025-09-20T09:00:00Z',
          createdBy: 'user-1',
          sessionId: 'session-1',
          status: 'pending',
          conflictsWith: [],
        },
        {
          id: 'change-3',
          sectionId: 'section-1',
          documentId: 'doc-1',
          patches: [],
          originalContent: '',
          previewContent: '',
          createdAt: '2025-09-20T10:00:00Z',
          createdBy: 'user-1',
          sessionId: 'session-1',
          status: 'pending',
          conflictsWith: [],
        },
        {
          id: 'change-4',
          sectionId: 'section-1',
          documentId: 'doc-1',
          patches: [],
          originalContent: '',
          previewContent: '',
          createdAt: '2025-09-20T11:00:00Z',
          createdBy: 'user-1',
          sessionId: 'session-1',
          status: 'pending',
          conflictsWith: [],
        },
      ];

      mockStore.getItem
        .mockResolvedValueOnce(`compressed:${JSON.stringify(changes[0])}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(changes[1])}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(changes[2])}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(changes[3])}`);

      // Clear any calls from initialization
      mockStore.removeItem.mockClear();

      // Trigger cleanup by calling private method
      await (managerWithLowLimit as any).cleanupOldPendingChanges();

      // Should remove the 2 oldest changes
      expect(mockStore.removeItem).toHaveBeenCalledTimes(2);
    });

    it('enforces retention policies for editor sessions', async () => {
      const managerWithLowLimit = new LocalStorageManager({ maxSessionHistory: 1 });
      await managerWithLowLimit.initialize();

      mockStore.keys.mockResolvedValue(['key1', 'key2']);

      const sessions = [{ lastSaveTime: 1000 }, { lastSaveTime: 2000 }];

      mockStore.getItem
        .mockResolvedValueOnce(`compressed:${JSON.stringify(sessions[0])}`)
        .mockResolvedValueOnce(`compressed:${JSON.stringify(sessions[1])}`);

      await (managerWithLowLimit as any).cleanupOldEditorSessions();

      // Should remove the older session
      expect(mockStore.removeItem).toHaveBeenCalledWith('key1');
    });

    it('removes invalid entries during cleanup', async () => {
      // Use a manager with low limit to ensure cleanup runs
      const cleanupManager = new LocalStorageManager({ maxChangeHistory: 1 });
      await cleanupManager.initialize();

      mockStore.keys.mockResolvedValue(['valid-key', 'invalid-key']);
      mockStore.getItem
        .mockResolvedValueOnce('compressed:{"id":"change-1","createdAt":"2025-09-20T08:00:00Z"}')
        .mockResolvedValueOnce('compressed:invalid-json');

      // Clear calls from initialization
      mockStore.removeItem.mockClear();

      await (cleanupManager as any).cleanupOldPendingChanges();

      // Should remove invalid entry
      expect(mockStore.removeItem).toHaveBeenCalledWith('invalid-key');
    });
  });

  describe('error handling', () => {
    it('handles storage operation failures gracefully', async () => {
      await manager.initialize();

      mockStore.setItem.mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(
        manager.savePendingChange({
          id: 'test',
          sectionId: 'test',
          documentId: 'test',
          patches: [],
          originalContent: 'test',
          previewContent: 'test',
          createdAt: '2025-09-20T10:00:00Z',
          createdBy: 'test',
          sessionId: 'test',
          status: 'pending',
          conflictsWith: [],
        })
      ).rejects.toThrow('Failed to save pending change');
    });

    it('handles missing store configuration', async () => {
      const managerWithoutStores = new LocalStorageManager({
        storeName: {
          pendingChanges: undefined,
        } as any,
      });

      await managerWithoutStores.initialize();

      const changes = await managerWithoutStores.loadPendingChanges('doc-123');
      expect(changes).toEqual([]);
    });
  });

  describe('compression behavior', () => {
    it('compresses data when compression is enabled', async () => {
      const managerWithCompression = new LocalStorageManager({ compression: true });
      await managerWithCompression.initialize();

      const testData = { large: 'data'.repeat(1000) };
      await managerWithCompression.saveEditorSession({
        ...testData,
        documentId: 'doc',
        userId: 'user',
        sessionId: 'session',
        activeSectionId: null,
        expandedSections: [],
        scrollPosition: 0,
        editorMode: 'wysiwyg',
        showDiffView: false,
        autoSaveEnabled: true,
        autoSaveInterval: 30000,
        collaborators: [],
        lastSaveTime: Date.now(),
        pendingChangeCount: 0,
      });

      expect(compress).toHaveBeenCalled();
    });

    it('skips compression when disabled', async () => {
      const managerWithoutCompression = new LocalStorageManager({ compression: false });
      await managerWithoutCompression.initialize();

      const testData = {
        documentId: 'doc',
        userId: 'user',
        sessionId: 'session',
        activeSectionId: null,
        expandedSections: [],
        scrollPosition: 0,
        editorMode: 'wysiwyg' as const,
        showDiffView: false,
        autoSaveEnabled: true,
        autoSaveInterval: 30000,
        collaborators: [],
        lastSaveTime: Date.now(),
        pendingChangeCount: 0,
      };

      await managerWithoutCompression.saveEditorSession(testData);

      expect(compress).not.toHaveBeenCalled();
      expect(mockStore.setItem).toHaveBeenCalledWith('doc:session', testData);
    });
  });
});
