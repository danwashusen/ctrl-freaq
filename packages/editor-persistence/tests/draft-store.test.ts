import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createDraftStore,
  type DraftStore,
  type DraftStoreConfig,
  type SectionDraftInput,
} from '../src/draft-store';

type MemoryStore = ReturnType<typeof createMemoryStore>;

function createMemoryStore() {
  const data = new Map<string, unknown>();
  let shouldFail = false;
  const api = {
    failNextSet() {
      shouldFail = true;
    },
    async setItem(key: string, value: unknown) {
      if (shouldFail) {
        shouldFail = false;
        const quotaError = new Error('Quota exceeded');
        quotaError.name = 'QuotaExceededError';
        throw quotaError;
      }
      data.set(key, value);
    },
    async getItem<T>(key: string): Promise<T | null> {
      return (data.get(key) as T | undefined) ?? null;
    },
    async removeItem(key: string): Promise<void> {
      data.delete(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(data.keys());
    },
    async iterate<T>(callback: (value: T, key: string) => void | Promise<void>): Promise<void> {
      for (const [key, value] of data.entries()) {
        await callback(value as T, key);
      }
    },
    async clear(): Promise<void> {
      data.clear();
    },
    snapshot() {
      return new Map(data);
    },
  };

  return api;
}

const baseDraft: SectionDraftInput = {
  projectSlug: 'proj-alpha',
  documentSlug: 'doc-plan',
  sectionTitle: 'Architecture Overview',
  sectionPath: 'architecture-overview',
  authorId: 'user-author',
  baselineVersion: 'rev-001',
  patch: 'diff --git a b',
  status: 'draft',
  lastEditedAt: new Date('2025-09-30T12:00:00.000Z'),
};

describe('createDraftStore', () => {
  let memoryStore: MemoryStore;
  let store: DraftStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-30T12:00:00.000Z'));
    memoryStore = createMemoryStore();
    store = createDraftStore({ storage: memoryStore } as DraftStoreConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('keys drafts by project/document/section/author composite', async () => {
    await store.saveDraft(baseDraft);
    const keys = await memoryStore.keys();
    expect(keys).toEqual(['proj-alpha/doc-plan/Architecture Overview/user-author']);

    const stored = await memoryStore.getItem<Record<string, unknown>>(keys[0]!);
    expect(stored).toMatchObject({
      draftKey: 'proj-alpha/doc-plan/Architecture Overview/user-author',
      status: 'draft',
      sectionPath: 'architecture-overview',
      patch: 'diff --git a b',
    });
  });

  test('rehydrates document state with sorted sections and timestamps', async () => {
    await store.saveDraft(baseDraft);
    await store.saveDraft({
      ...baseDraft,
      sectionTitle: 'Scaling Plan',
      sectionPath: 'scaling-plan',
      patch: 'diff --git c d',
      lastEditedAt: new Date('2025-09-30T12:05:00.000Z'),
    });

    const state = await store.rehydrateDocumentState({
      projectSlug: baseDraft.projectSlug,
      documentSlug: baseDraft.documentSlug,
      authorId: baseDraft.authorId,
    });

    expect(state).not.toBeNull();
    expect(state?.sections.map(section => section.sectionPath)).toEqual([
      'scaling-plan',
      'architecture-overview',
    ]);
    expect(state?.pendingComplianceWarning).toBe(false);
    expect(state?.rehydratedAt).toBeDefined();
  });

  test('prunes oldest drafts when storage quota is exceeded', async () => {
    await store.saveDraft(baseDraft);
    await store.saveDraft({
      ...baseDraft,
      sectionTitle: 'Operational Concerns',
      sectionPath: 'ops-concerns',
      patch: 'diff --git ops',
      lastEditedAt: new Date('2025-09-30T12:10:00.000Z'),
    });

    memoryStore.failNextSet();

    const result = await store.saveDraft({
      ...baseDraft,
      sectionTitle: 'Security Posture',
      sectionPath: 'security-posture',
      patch: 'diff --git sec',
      lastEditedAt: new Date('2025-09-30T12:15:00.000Z'),
    });

    expect(result.prunedDraftKeys).toEqual([
      'proj-alpha/doc-plan/Architecture Overview/user-author',
    ]);
    const keys = await memoryStore.keys();
    expect(keys).toEqual([
      'proj-alpha/doc-plan/Operational Concerns/user-author',
      'proj-alpha/doc-plan/Security Posture/user-author',
    ]);
  });

  test('clears all drafts for an author on logout', async () => {
    await store.saveDraft(baseDraft);
    await store.saveDraft({
      ...baseDraft,
      authorId: 'user-other',
      sectionTitle: 'Peer Review',
      sectionPath: 'peer-review',
    });

    await store.clearAuthorDrafts(baseDraft.authorId);

    const remainingKeys = await memoryStore.keys();
    expect(remainingKeys).toEqual(['proj-alpha/doc-plan/Peer Review/user-other']);
  });
});
