import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import localforage from 'localforage';

import {
  ManualDraftStorage,
  type ManualDraftPayload,
  MANUAL_DRAFT_CONFLICT_STATES,
  type ManualDraftStore,
} from './index';

let inMemoryStore: Map<string, unknown>;

beforeEach(() => {
  inMemoryStore = new Map();

  vi.spyOn(localforage, 'createInstance').mockImplementation(() => {
    const api: Partial<ManualDraftStore> = {
      async ready() {
        return Promise.resolve();
      },
      async setItem<T>(key: string, value: T) {
        inMemoryStore.set(key, value);
        return value;
      },
      async getItem<T>(key: string) {
        return (inMemoryStore.has(key) ? (inMemoryStore.get(key) as T) : null) as T | null;
      },
      async removeItem(key: string) {
        inMemoryStore.delete(key);
      },
      async clear() {
        inMemoryStore.clear();
      },
      async keys() {
        return Array.from(inMemoryStore.keys());
      },
      async iterate<T, U>(iteratorCallback: (value: T, key: string, iterationNumber: number) => U) {
        let index = 0;
        for (const [key, value] of inMemoryStore.entries()) {
          await iteratorCallback(value as T, key, index);
          index += 1;
        }
        return null as U | null;
      },
    };

    return api as ManualDraftStore;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ManualDraftStorage', () => {
  const basePayload: ManualDraftPayload = {
    draftId: 'draft-1',
    sectionId: 'section-1',
    documentId: 'doc-1',
    userId: 'user-1',
    contentMarkdown: '# Hello',
    summaryNote: 'Summary',
    draftVersion: 2,
    draftBaseVersion: 1,
    conflictState: MANUAL_DRAFT_CONFLICT_STATES[0],
    formattingAnnotations: [],
  };

  const createStorage = () => new ManualDraftStorage({ dbName: `test-${Date.now()}` });

  it('persists and retrieves manual drafts', async () => {
    const storage = createStorage();

    await storage.saveDraft(basePayload);
    const draft = await storage.loadDraft('doc-1', 'section-1', 'user-1');

    expect(draft).not.toBeNull();
    expect(draft?.draftId).toBe('draft-1');
    expect(draft?.summaryNote).toBe('Summary');
    expect(draft?.savedAt).toMatch(/T/);
    expect(draft?.updatedAt).toMatch(/T/);
  });

  it('lists drafts scoped to document and user', async () => {
    const storage = createStorage();

    await storage.saveDraft(basePayload);
    await storage.saveDraft({
      ...basePayload,
      draftId: 'draft-2',
      sectionId: 'section-2',
    });
    await storage.saveDraft({
      ...basePayload,
      draftId: 'draft-3',
      documentId: 'doc-2',
      sectionId: 'section-3',
    });

    const drafts = await storage.listDrafts('doc-1', 'user-1');

    expect(drafts).toHaveLength(2);
    expect(drafts.map(d => d.draftId).sort()).toEqual(['draft-1', 'draft-2']);
  });

  it('removes drafts after delete', async () => {
    const storage = createStorage();

    await storage.saveDraft(basePayload);
    await storage.deleteDraft('doc-1', 'section-1', 'user-1');

    const draft = await storage.loadDraft('doc-1', 'section-1', 'user-1');
    expect(draft).toBeNull();
  });
});
