/**
 * Manual Draft Storage Utilities
 *
 * Provides a thin abstraction over IndexedDB (via localforage) for persisting
 * manual section drafts between sessions. Every operation emits structured
 * telemetry to satisfy observability requirements outlined in the
 * constitution and feature research.
 */

import localforage from 'localforage';
import { z } from 'zod';

import { logger as defaultLogger, type Logger } from '../logger.js';

export const MANUAL_DRAFT_CONFLICT_STATES = [
  'clean',
  'rebase_required',
  'rebased',
  'blocked',
] as const;
export type ManualDraftConflictState = (typeof MANUAL_DRAFT_CONFLICT_STATES)[number];

const FormattingAnnotationSchema = z.object({
  id: z.string().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  markType: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['warning', 'error']),
});

export type ManualDraftFormattingAnnotation = z.infer<typeof FormattingAnnotationSchema>;

const ManualDraftSchema = z.object({
  draftId: z.string().min(1),
  sectionId: z.string().min(1),
  documentId: z.string().min(1),
  userId: z.string().min(1),
  contentMarkdown: z.string(),
  summaryNote: z.string(),
  draftVersion: z.number().int().min(0),
  draftBaseVersion: z.number().int().min(0),
  conflictState: z.enum(MANUAL_DRAFT_CONFLICT_STATES),
  conflictReason: z.string().nullable(),
  formattingAnnotations: z.array(FormattingAnnotationSchema),
  savedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().nullable(),
});

export type ManualDraftRecord = z.infer<typeof ManualDraftSchema>;

export interface ManualDraftPayload {
  draftId: string;
  sectionId: string;
  documentId: string;
  userId: string;
  contentMarkdown: string;
  summaryNote?: string;
  draftVersion: number;
  draftBaseVersion: number;
  conflictState: ManualDraftConflictState;
  conflictReason?: string | null;
  formattingAnnotations?: ManualDraftFormattingAnnotation[];
  savedAt?: string | Date;
  lastSyncedAt?: string | Date | null;
}

export interface ManualDraftStorageConfig {
  dbName?: string;
  storeName?: string;
  driver?: Array<
    typeof localforage.INDEXEDDB | typeof localforage.WEBSQL | typeof localforage.LOCALSTORAGE
  >;
  logger?: Logger;
}

interface NormalizedConfig {
  dbName: string;
  storeName: string;
  driver: Array<
    typeof localforage.INDEXEDDB | typeof localforage.WEBSQL | typeof localforage.LOCALSTORAGE
  >;
  logger: Logger;
}

const buildKey = (documentId: string, sectionId: string, userId: string): string => {
  return `${userId}::${documentId}::${sectionId}`;
};

const toIsoString = (input: string | Date): string => {
  if (input instanceof Date) {
    return input.toISOString();
  }

  const candidate = new Date(input);
  if (Number.isNaN(candidate.getTime())) {
    throw new Error(`Invalid date value: ${input}`);
  }
  return candidate.toISOString();
};

const toNullableIsoString = (input: string | Date | null | undefined): string | null => {
  if (input === null || input === undefined) {
    return null;
  }
  return toIsoString(input);
};

const nowIso = (): string => new Date().toISOString();

const elapsedMs = (start: number): number => {
  const end =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  return Math.max(end - start, 0);
};

/**
 * ManualDraftStorage orchestrates manual draft persistence with telemetry.
 */
export type ManualDraftStore = ReturnType<typeof localforage.createInstance>;

export class ManualDraftStorage {
  private readonly config: NormalizedConfig;
  private readonly store: ManualDraftStore;
  private readonly logger: Logger;
  private readonly ready: Promise<void>;

  constructor(config: ManualDraftStorageConfig = {}) {
    this.config = {
      dbName: config.dbName ?? 'ctrl-freaq-editor',
      storeName: config.storeName ?? 'manual_drafts',
      driver: config.driver ?? [
        localforage.INDEXEDDB,
        localforage.WEBSQL,
        localforage.LOCALSTORAGE,
      ],
      logger: config.logger ?? defaultLogger,
    } satisfies NormalizedConfig;

    this.logger = this.config.logger;
    this.store = localforage.createInstance({
      name: this.config.dbName,
      storeName: this.config.storeName,
      driver: this.config.driver,
    });
    this.ready = this.store.ready();
  }

  /**
   * Persist a manual draft snapshot.
   */
  async saveDraft(payload: ManualDraftPayload): Promise<ManualDraftRecord> {
    await this.ready;
    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    try {
      const record = this.normalizePayload(payload);
      const key = buildKey(record.documentId, record.sectionId, record.userId);
      await this.store.setItem(key, record);

      this.logger.info(
        {
          operation: 'manual_draft.save',
          duration: elapsedMs(start),
          documentId: record.documentId,
          sectionId: record.sectionId,
          draftId: record.draftId,
          userId: record.userId,
        },
        'Manual draft persisted to client storage'
      );

      return record;
    } catch (error) {
      this.logger.error(
        {
          operation: 'manual_draft.save',
          duration: elapsedMs(start),
          documentId: payload.documentId,
          sectionId: payload.sectionId,
          draftId: payload.draftId,
          userId: payload.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to persist manual draft'
      );
      throw error;
    }
  }

  /**
   * Retrieve a persisted manual draft for the given section.
   */
  async loadDraft(
    documentId: string,
    sectionId: string,
    userId: string
  ): Promise<ManualDraftRecord | null> {
    await this.ready;
    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const key = buildKey(documentId, sectionId, userId);

    try {
      const record = await this.store.getItem<ManualDraftRecord>(key);
      if (!record) {
        this.logger.debug(
          {
            operation: 'manual_draft.load',
            duration: elapsedMs(start),
            documentId,
            sectionId,
            userId,
            result: 'miss',
          },
          'Manual draft not found in client storage'
        );
        return null;
      }

      const normalized = ManualDraftSchema.parse(record);
      this.logger.debug(
        {
          operation: 'manual_draft.load',
          duration: elapsedMs(start),
          documentId,
          sectionId,
          userId,
          draftId: normalized.draftId,
          result: 'hit',
        },
        'Manual draft loaded from client storage'
      );
      return normalized;
    } catch (error) {
      this.logger.error(
        {
          operation: 'manual_draft.load',
          duration: elapsedMs(start),
          documentId,
          sectionId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to load manual draft'
      );
      throw error;
    }
  }

  /**
   * Remove a manual draft when it is successfully synced with the API.
   */
  async deleteDraft(documentId: string, sectionId: string, userId: string): Promise<void> {
    await this.ready;
    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const key = buildKey(documentId, sectionId, userId);

    try {
      await this.store.removeItem(key);
      this.logger.info(
        {
          operation: 'manual_draft.delete',
          duration: elapsedMs(start),
          documentId,
          sectionId,
          userId,
        },
        'Manual draft removed from client storage'
      );
    } catch (error) {
      this.logger.error(
        {
          operation: 'manual_draft.delete',
          duration: elapsedMs(start),
          documentId,
          sectionId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete manual draft'
      );
      throw error;
    }
  }

  /**
   * List manual drafts for a document scoped to the current user.
   */
  async listDrafts(documentId: string, userId: string): Promise<ManualDraftRecord[]> {
    await this.ready;
    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const prefix = `${userId}::${documentId}::`;

    try {
      const keys = await this.store.keys();
      const matches = keys.filter(key => key.startsWith(prefix));
      const records: ManualDraftRecord[] = [];

      for (const key of matches) {
        const value = await this.store.getItem<ManualDraftRecord>(key);
        if (!value) {
          continue;
        }
        records.push(ManualDraftSchema.parse(value));
      }

      this.logger.debug(
        {
          operation: 'manual_draft.list',
          duration: elapsedMs(start),
          documentId,
          userId,
          count: records.length,
        },
        'Enumerated manual drafts from client storage'
      );

      return records;
    } catch (error) {
      this.logger.error(
        {
          operation: 'manual_draft.list',
          duration: elapsedMs(start),
          documentId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to list manual drafts'
      );
      throw error;
    }
  }

  private normalizePayload(payload: ManualDraftPayload): ManualDraftRecord {
    const savedAt = toIsoString(payload.savedAt ?? nowIso());
    const updatedAt = nowIso();

    return ManualDraftSchema.parse({
      draftId: payload.draftId,
      sectionId: payload.sectionId,
      documentId: payload.documentId,
      userId: payload.userId,
      contentMarkdown: payload.contentMarkdown,
      summaryNote: payload.summaryNote ?? '',
      draftVersion: payload.draftVersion,
      draftBaseVersion: payload.draftBaseVersion,
      conflictState: payload.conflictState,
      conflictReason: payload.conflictReason ?? null,
      formattingAnnotations: payload.formattingAnnotations ?? [],
      savedAt,
      updatedAt,
      lastSyncedAt: toNullableIsoString(payload.lastSyncedAt ?? null),
    });
  }
}

/**
 * Convenience factory mirroring common defaults.
 */
export const createManualDraftStorage = (
  config: ManualDraftStorageConfig = {}
): ManualDraftStorage => {
  return new ManualDraftStorage(config);
};
