import localforage from 'localforage';

import {
  DocumentDraftStateSchema,
  DraftStorageRecordSchema,
  SectionDraftSchema,
  SectionDraftStatusSchema,
  type DocumentDraftState,
  type DraftStorageRecord,
  type SectionDraft,
  type SectionDraftStatus,
} from './schema';

export interface SectionDraftInput {
  projectSlug: string;
  documentSlug: string;
  sectionTitle: string;
  sectionPath: string;
  authorId: string;
  baselineVersion: string;
  patch: string;
  status: SectionDraftStatus;
  lastEditedAt: Date;
  complianceWarning?: boolean;
}

export interface SectionDraftSnapshot extends SectionDraft {
  draftKey: string;
}

export interface DraftSaveResult {
  record: SectionDraftSnapshot;
  prunedDraftKeys: string[];
}

export interface DraftStoreStorageAdapter {
  setItem(key: string, value: unknown): Promise<void>;
  getItem<T>(key: string): Promise<T | null>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
  iterate<T>(callback: (value: T, key: string) => void | Promise<void>): Promise<void>;
  clear(): Promise<void>;
}

export interface DraftStoreConfig {
  storage?: DraftStoreStorageAdapter;
  clock?: () => Date;
}

export interface DraftStore {
  saveDraft(input: SectionDraftInput): Promise<DraftSaveResult>;
  rehydrateDocumentState(args: {
    projectSlug: string;
    documentSlug: string;
    authorId: string;
  }): Promise<DocumentDraftState | null>;
  listDrafts(filters?: {
    authorId?: string;
    projectSlug?: string;
    documentSlug?: string;
  }): Promise<SectionDraftSnapshot[]>;
  clearAuthorDrafts(authorId: string): Promise<void>;
  removeDraft(draftKey: string): Promise<void>;
}

const DEFAULT_DB_NAME = 'ctrl-freaq-editor';
const DEFAULT_STORE_NAME = 'section_drafts_v2';

function createDefaultStorageAdapter(): DraftStoreStorageAdapter {
  const store = localforage.createInstance({
    name: DEFAULT_DB_NAME,
    storeName: DEFAULT_STORE_NAME,
  });

  return {
    async setItem(key, value) {
      await store.setItem(key, value);
    },
    async getItem<T>(key: string) {
      const value = await store.getItem<T | null>(key);
      return (value ?? null) as T | null;
    },
    async removeItem(key) {
      await store.removeItem(key);
    },
    async keys() {
      return store.keys();
    },
    async iterate<T>(callback: (value: T, key: string) => void | Promise<void>) {
      await store.iterate((value, key) => callback(value as T, key));
    },
    async clear() {
      await store.clear();
    },
  } satisfies DraftStoreStorageAdapter;
}

const isQuotaError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { name?: string; message?: string };
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.message?.toLowerCase().includes('quota') === true
  );
};

const buildDraftKey = (input: {
  projectSlug: string;
  documentSlug: string;
  sectionTitle: string;
  authorId: string;
}) => {
  return `${input.projectSlug}/${input.documentSlug}/${input.sectionTitle}/${input.authorId}`;
};

const toStorageRecord = (snapshot: SectionDraftSnapshot): DraftStorageRecord => {
  return DraftStorageRecordSchema.parse({
    ...snapshot,
    lastEditedAt: snapshot.lastEditedAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  });
};

const fromStorageRecord = (record: DraftStorageRecord): SectionDraftSnapshot => {
  const parsed = SectionDraftSchema.parse({
    ...record,
    lastEditedAt: new Date(record.lastEditedAt),
    updatedAt: new Date(record.updatedAt),
  });
  return {
    ...parsed,
    draftKey: record.draftKey,
  } satisfies SectionDraftSnapshot;
};

async function pruneOldestDraft(
  storage: DraftStoreStorageAdapter,
  predicate: (record: DraftStorageRecord) => boolean
): Promise<string[]> {
  const candidates: DraftStorageRecord[] = [];
  await storage.iterate<DraftStorageRecord>((value, key) => {
    try {
      const record = DraftStorageRecordSchema.parse({ ...value, draftKey: key });
      if (predicate(record)) {
        candidates.push(record);
      }
    } catch {
      // Ignore parse errors for unrelated keys
    }
  });

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  const [oldest] = candidates;
  if (!oldest) {
    return [];
  }

  await storage.removeItem(oldest.draftKey);
  return [oldest.draftKey];
}

export function createDraftStore(config: DraftStoreConfig = {}): DraftStore {
  const storage = config.storage ?? createDefaultStorageAdapter();
  const now = () => config.clock?.() ?? new Date();

  return {
    async saveDraft(input) {
      const status = SectionDraftStatusSchema.parse(input.status);
      const draftKey = buildDraftKey(input);
      const timestamp = input.lastEditedAt;
      const snapshot: SectionDraftSnapshot = {
        draftKey,
        projectSlug: input.projectSlug,
        documentSlug: input.documentSlug,
        sectionTitle: input.sectionTitle,
        sectionPath: input.sectionPath,
        authorId: input.authorId,
        baselineVersion: input.baselineVersion,
        patch: input.patch,
        status,
        lastEditedAt: timestamp,
        updatedAt: now(),
        complianceWarning: input.complianceWarning ?? false,
      } satisfies SectionDraftSnapshot;

      const storageRecord = toStorageRecord(snapshot);
      const prunedDraftKeys: string[] = [];

      try {
        await storage.setItem(draftKey, storageRecord);
      } catch (error) {
        if (!isQuotaError(error)) {
          throw error;
        }

        const pruned = await pruneOldestDraft(
          storage,
          candidate => candidate.authorId === snapshot.authorId
        );
        if (pruned.length === 0) {
          throw error;
        }
        prunedDraftKeys.push(...pruned);
        await storage.setItem(draftKey, storageRecord);
      }

      return {
        record: snapshot,
        prunedDraftKeys,
      } satisfies DraftSaveResult;
    },

    async rehydrateDocumentState(args) {
      const matches: SectionDraftSnapshot[] = [];

      await storage.iterate<DraftStorageRecord>((value, key) => {
        const candidate = DraftStorageRecordSchema.safeParse({ ...value, draftKey: key });
        if (!candidate.success) {
          return;
        }

        if (
          candidate.data.projectSlug === args.projectSlug &&
          candidate.data.documentSlug === args.documentSlug &&
          candidate.data.authorId === args.authorId
        ) {
          matches.push(fromStorageRecord(candidate.data));
        }
      });

      if (matches.length === 0) {
        return null;
      }

      matches.sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());
      const [firstMatch] = matches;
      if (!firstMatch) {
        return null;
      }

      const updatedAt = matches.reduce((latest, record) => {
        return record.updatedAt.getTime() > latest.getTime() ? record.updatedAt : latest;
      }, firstMatch.updatedAt);

      const state = {
        projectSlug: args.projectSlug,
        documentSlug: args.documentSlug,
        authorId: args.authorId,
        sections: matches,
        updatedAt,
        rehydratedAt: now(),
        pendingComplianceWarning: matches.some(section => section.complianceWarning),
      } satisfies DocumentDraftState;

      return DocumentDraftStateSchema.parse(state);
    },

    async listDrafts(filters = {}) {
      const matches: SectionDraftSnapshot[] = [];

      await storage.iterate<DraftStorageRecord>((value, key) => {
        const candidate = DraftStorageRecordSchema.safeParse({ ...value, draftKey: key });
        if (!candidate.success) {
          return;
        }

        if (
          (filters.authorId && candidate.data.authorId !== filters.authorId) ||
          (filters.projectSlug && candidate.data.projectSlug !== filters.projectSlug) ||
          (filters.documentSlug && candidate.data.documentSlug !== filters.documentSlug)
        ) {
          return;
        }

        matches.push(fromStorageRecord(candidate.data));
      });

      matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return matches;
    },

    async clearAuthorDrafts(authorId) {
      const keys = await storage.keys();
      const removals = keys.filter(key => key.endsWith(`/${authorId}`));
      await Promise.all(removals.map(key => storage.removeItem(key)));
    },

    async removeDraft(draftKey) {
      await storage.removeItem(draftKey);
    },
  } satisfies DraftStore;
}
