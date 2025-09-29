import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createManualDraftStorage,
  type ManualDraftPayload,
  type ManualDraftRecord,
  type ManualDraftStorage,
} from '@ctrl-freaq/editor-persistence';

import { logger } from '@/lib/logger';

import {
  type ConflictCheckResponseDTO,
  type ConflictLogEntryDTO,
  type DiffResponseDTO,
  type FormattingAnnotationDTO,
  type SectionDraftResponseDTO,
} from '../api/section-editor.mappers';
import { SectionEditorClientError, SectionEditorConflictError } from '../api/section-editor.client';
import { useSectionDraftStore } from '../stores/section-draft-store';
import type { SectionDraftStoreState } from '../stores/section-draft-store';

export interface FormattingAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  markType: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface SectionDraftHookState {
  content: string;
  summaryNote: string;
  conflictState: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  formattingWarnings: FormattingAnnotation[];
  isSaving: boolean;
  diff: DiffResponseDTO | null;
  isDiffRefreshing: boolean;
  lastDiffFetchedAt: number | null;
}

type DraftConflictTrigger = 'entry' | 'save';

interface SaveDraftPayload {
  sectionId: string;
  contentMarkdown: string;
  draftVersion: number;
  draftBaseVersion: number;
  summaryNote?: string;
  formattingAnnotations?: FormattingAnnotationDTO[];
}

interface ConflictCheckPayload {
  sectionId: string;
  draftVersion: number;
  draftBaseVersion: number;
  approvedVersion: number;
  requestId: string;
  triggeredBy: DraftConflictTrigger;
}

interface DiffRequestPayload {
  sectionId: string;
}

interface ConflictLogListPayload {
  sectionId: string;
}

type ManualDraftPersistence = Pick<ManualDraftStorage, 'saveDraft' | 'loadDraft' | 'deleteDraft'>;

export interface UseSectionDraftOptions {
  api: {
    saveDraft: (payload: SaveDraftPayload) => Promise<SectionDraftResponseDTO>;
    checkConflicts?: (payload: ConflictCheckPayload) => Promise<ConflictCheckResponseDTO>;
    fetchDiff?: (payload: DiffRequestPayload) => Promise<DiffResponseDTO>;
    listConflictLogs?: (
      payload: ConflictLogListPayload
    ) => Promise<{ events: ConflictLogEntryDTO[] }>;
  };
  sectionId: string;
  initialContent: string;
  approvedVersion: number;
  documentId?: string;
  userId?: string;
  initialSummaryNote?: string | null;
  initialFormattingWarnings?: FormattingAnnotationDTO[];
  initialConflictState?: SectionDraftHookState['conflictState'];
  initialDraftId?: string | null;
  initialDraftVersion?: number | null;
  storage?: ManualDraftPersistence | null;
  diffPollingIntervalMs?: number;
  autoStartDiffPolling?: boolean;
  loadPersistedDraft?: boolean;
}

export interface UseSectionDraftReturn {
  state: SectionDraftHookState;
  updateDraft: (content: string) => void;
  setSummary: (summary: string) => void;
  manualSave: () => Promise<SectionDraftResponseDTO | ConflictCheckResponseDTO | null>;
  refreshDiff: () => Promise<DiffResponseDTO | null>;
  resolveConflicts: () => Promise<ConflictCheckResponseDTO | null>;
}

const randomSegment = (length = 6) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + length);

const createRequestId = (prefix: string) => {
  const unique =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${randomSegment(8)}`;
  return `${prefix}-${unique}`;
};

const toFormattingAnnotation = (input: FormattingAnnotationDTO): FormattingAnnotation => ({
  id: input.id,
  startOffset: input.startOffset,
  endOffset: input.endOffset,
  markType: input.markType,
  message: input.message,
  severity: input.severity,
});

export function useSectionDraft(options: UseSectionDraftOptions): UseSectionDraftReturn {
  const {
    api,
    sectionId,
    initialContent,
    approvedVersion,
    documentId,
    userId,
    initialSummaryNote = null,
    initialFormattingWarnings,
    initialConflictState = 'clean',
    initialDraftId = null,
    initialDraftVersion = null,
    storage: storageOverride = null,
    diffPollingIntervalMs = 45_000,
    autoStartDiffPolling = true,
    loadPersistedDraft = true,
  } = options;

  const [content, setContent] = useState(initialContent);
  const contentRef = useRef(initialContent);

  useEffect(() => {
    setContent(initialContent);
    contentRef.current = initialContent;
  }, [initialContent, sectionId]);

  const [diff, setDiff] = useState<DiffResponseDTO | null>(null);
  const [isDiffRefreshing, setIsDiffRefreshing] = useState(false);
  const [lastDiffFetchedAt, setLastDiffFetchedAt] = useState<number | null>(null);

  const enableDiffAutomation = autoStartDiffPolling && typeof api.fetchDiff === 'function';

  const storage = useMemo<ManualDraftPersistence | null>(() => {
    if (storageOverride) {
      return storageOverride;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return createManualDraftStorage();
    } catch (error) {
      logger.warn(
        'Failed to initialise manual draft storage; falling back to in-memory operations',
        {
          sectionId,
          reason: error instanceof Error ? error.message : String(error),
        }
      );
      return null;
    }
  }, [storageOverride, sectionId]);

  const conflictState = useSectionDraftStore(state => state.conflictState);
  const formattingAnnotations = useSectionDraftStore(state => state.formattingAnnotations);
  const isSaving = useSectionDraftStore(state => state.isSaving);
  const summaryNote = useSectionDraftStore(state => state.summaryNote);
  const initialize = useSectionDraftStore(state => state.initialize);
  const setSummaryInternal = useSectionDraftStore(state => state.setSummary);
  const beginSave = useSectionDraftStore(state => state.beginSave);
  const completeSave = useSectionDraftStore(state => state.completeSave);
  const failSave = useSectionDraftStore(state => state.failSave);
  const applyConflict = useSectionDraftStore(state => state.applyConflict);
  const recordConflictEvents = useSectionDraftStore(state => state.recordConflictEvents);

  const lastInitializedSectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastInitializedSectionRef.current === sectionId) {
      return;
    }

    initialize({
      sectionId,
      draftId: initialDraftId ?? null,
      draftVersion: initialDraftVersion ?? null,
      draftBaseVersion: approvedVersion,
      summaryNote: initialSummaryNote ?? null,
      conflictState: initialConflictState,
      formattingAnnotations: initialFormattingWarnings,
    });
    if (initialSummaryNote) {
      setSummaryInternal(initialSummaryNote);
    }
    lastInitializedSectionRef.current = sectionId;
  }, [
    initialize,
    sectionId,
    approvedVersion,
    initialSummaryNote,
    initialFormattingWarnings,
    initialConflictState,
    initialDraftId,
    initialDraftVersion,
    setSummaryInternal,
  ]);

  useEffect(() => {
    if (!storage || !documentId || !userId || !loadPersistedDraft) {
      return;
    }

    let cancelled = false;

    storage
      .loadDraft(documentId, sectionId, userId)
      .then((record: ManualDraftRecord | null) => {
        if (!record || cancelled) {
          return;
        }

        hydrateFromManualDraft(record, {
          initialize,
          setContent,
          contentRef,
          setSummary: setSummaryInternal,
        });
      })
      .catch((error: unknown) => {
        logger.warn('Failed to hydrate manual draft from persistence', {
          sectionId,
          documentId,
          userId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [storage, documentId, userId, sectionId, initialize, setSummaryInternal, loadPersistedDraft]);

  const formattingWarnings = useMemo(
    () => formattingAnnotations.map(toFormattingAnnotation),
    [formattingAnnotations]
  );

  const [derivedState, setDerivedState] = useState<SectionDraftHookState>({
    content,
    summaryNote,
    conflictState,
    formattingWarnings,
    isSaving,
    diff,
    isDiffRefreshing,
    lastDiffFetchedAt,
  });

  useEffect(() => {
    setDerivedState({
      content,
      summaryNote,
      conflictState,
      formattingWarnings,
      isSaving,
      diff,
      isDiffRefreshing,
      lastDiffFetchedAt,
    });
  }, [
    content,
    summaryNote,
    conflictState,
    formattingWarnings,
    isSaving,
    diff,
    isDiffRefreshing,
    lastDiffFetchedAt,
  ]);

  const syncDerivedStateFromStore = useCallback(() => {
    const snapshot = useSectionDraftStore.getState();
    setDerivedState({
      content: contentRef.current,
      summaryNote: snapshot.summaryNote,
      conflictState: snapshot.conflictState,
      formattingWarnings: snapshot.formattingAnnotations.map(toFormattingAnnotation),
      isSaving: snapshot.isSaving,
      diff,
      isDiffRefreshing,
      lastDiffFetchedAt,
    });
  }, [diff, isDiffRefreshing, lastDiffFetchedAt]);

  const updateDraft = useCallback((value: string) => {
    setContent(value);
    contentRef.current = value;
  }, []);

  const setSummary = useCallback(
    (value: string) => {
      setSummaryInternal(value);
    },
    [setSummaryInternal]
  );

  const refreshDiff = useCallback(async (): Promise<DiffResponseDTO | null> => {
    if (typeof api.fetchDiff !== 'function') {
      return null;
    }

    setIsDiffRefreshing(true);

    try {
      const response = await api.fetchDiff({ sectionId });
      setDiff(response);
      setLastDiffFetchedAt(Date.now());
      return response;
    } catch (error) {
      logger.error(
        'Failed to refresh section diff',
        { sectionId },
        error instanceof Error ? error : undefined
      );
      throw error;
    } finally {
      setIsDiffRefreshing(false);
    }
  }, [api, sectionId]);

  useEffect(() => {
    if (!enableDiffAutomation || diffPollingIntervalMs <= 0 || typeof window === 'undefined') {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshDiff();
    }, diffPollingIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [enableDiffAutomation, diffPollingIntervalMs, refreshDiff]);

  const persistDraft = useCallback(
    async (payload: ManualDraftPayload) => {
      if (!storage || !documentId || !userId) {
        return;
      }

      try {
        await storage.saveDraft(payload);
      } catch (error) {
        logger.warn('Unable to persist manual draft snapshot', {
          sectionId,
          documentId,
          userId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [storage, documentId, userId, sectionId]
  );

  const manualSave = useCallback(async () => {
    const requestId = createRequestId('section-draft');
    beginSave(requestId);

    const storeState = useSectionDraftStore.getState();
    const nextDraftVersion = (storeState.draftVersion ?? 0) + 1;
    const draftBaseVersion = storeState.draftBaseVersion ?? approvedVersion;
    const summary = storeState.summaryNote ?? undefined;

    try {
      const response = await api.saveDraft({
        sectionId,
        contentMarkdown: contentRef.current,
        draftVersion: nextDraftVersion,
        draftBaseVersion,
        summaryNote: summary,
        formattingAnnotations: storeState.formattingAnnotations,
      });

      completeSave(response, { requestId, draftBaseVersion });

      if (documentId && userId) {
        void persistDraft({
          draftId: response.draftId,
          sectionId,
          documentId,
          userId,
          contentMarkdown: contentRef.current,
          summaryNote: response.summaryNote ?? summary ?? '',
          draftVersion: response.draftVersion,
          draftBaseVersion,
          conflictState: response.conflictState,
          conflictReason: null,
          formattingAnnotations: response.formattingAnnotations,
          savedAt: response.savedAt,
          lastSyncedAt: response.savedAt,
        });
      }

      if (enableDiffAutomation) {
        void refreshDiff();
      }

      syncDerivedStateFromStore();

      return response;
    } catch (error) {
      if (error instanceof SectionEditorConflictError) {
        const conflict = error.conflict;
        applyConflict(conflict);
        recordConflictEvents(conflict.events ?? []);
        failSave(error, { requestId });

        if (conflict.rebasedDraft?.contentMarkdown) {
          setContent(conflict.rebasedDraft.contentMarkdown);
          contentRef.current = conflict.rebasedDraft.contentMarkdown;
        }

        if (documentId && userId && conflict.rebasedDraft) {
          void persistDraft({
            draftId:
              storeState.draftId ??
              `${sectionId}-rebased-${conflict.rebasedDraft.draftVersion ?? randomSegment(4)}`,
            sectionId,
            documentId,
            userId,
            contentMarkdown: conflict.rebasedDraft.contentMarkdown,
            summaryNote: summary ?? '',
            draftVersion: conflict.rebasedDraft.draftVersion,
            draftBaseVersion: conflict.latestApprovedVersion,
            conflictState: conflict.status,
            conflictReason: conflict.conflictReason ?? null,
            formattingAnnotations: conflict.rebasedDraft.formattingAnnotations,
            savedAt: new Date().toISOString(),
            lastSyncedAt: null,
          });
        }

        syncDerivedStateFromStore();

        return conflict;
      }

      const normalizedError =
        error instanceof SectionEditorClientError
          ? error
          : new SectionEditorClientError(
              error instanceof Error ? error.message : 'Failed to save section draft',
              {
                status: 0,
                requestId,
                body: undefined,
              }
            );

      failSave(normalizedError, { requestId });
      throw normalizedError;
    }
  }, [
    api,
    sectionId,
    approvedVersion,
    beginSave,
    completeSave,
    applyConflict,
    recordConflictEvents,
    failSave,
    persistDraft,
    documentId,
    userId,
    enableDiffAutomation,
    refreshDiff,
    syncDerivedStateFromStore,
  ]);

  const resolveConflicts = useCallback(async () => {
    if (typeof api.checkConflicts !== 'function') {
      return null;
    }

    const requestId = createRequestId('section-conflict');
    const snapshot = useSectionDraftStore.getState();

    try {
      const response = await api.checkConflicts({
        sectionId,
        draftVersion: snapshot.draftVersion ?? 0,
        draftBaseVersion: snapshot.draftBaseVersion ?? approvedVersion,
        approvedVersion,
        requestId,
        triggeredBy: 'save',
      });

      applyConflict(response);
      recordConflictEvents(response.events ?? []);

      if (response.rebasedDraft?.contentMarkdown) {
        setContent(response.rebasedDraft.contentMarkdown);
        contentRef.current = response.rebasedDraft.contentMarkdown;
      }

      syncDerivedStateFromStore();

      return response;
    } catch (error) {
      logger.error(
        'Conflict resolution attempt failed',
        { sectionId },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }, [
    api,
    sectionId,
    approvedVersion,
    applyConflict,
    recordConflictEvents,
    syncDerivedStateFromStore,
  ]);

  useEffect(() => {
    if (typeof api.listConflictLogs !== 'function') {
      return;
    }

    let cancelled = false;

    api
      .listConflictLogs({ sectionId })
      .then(result => {
        if (!cancelled) {
          recordConflictEvents(result.events ?? []);
        }
      })
      .catch(error => {
        logger.debug('Unable to hydrate conflict log history', {
          sectionId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [api, sectionId, recordConflictEvents]);

  return {
    state: derivedState,
    updateDraft,
    setSummary,
    manualSave,
    refreshDiff,
    resolveConflicts,
  };
}

function hydrateFromManualDraft(
  record: ManualDraftRecord,
  context: {
    initialize: (payload: Parameters<SectionDraftStoreState['initialize']>[0]) => void;
    setContent: (value: string) => void;
    contentRef: MutableRefObject<string>;
    setSummary: (value: string) => void;
  }
) {
  const lastManualSaveAt = Date.parse(record.savedAt);

  context.initialize({
    sectionId: record.sectionId,
    draftId: record.draftId,
    draftVersion: record.draftVersion,
    draftBaseVersion: record.draftBaseVersion,
    summaryNote: record.summaryNote,
    conflictState: record.conflictState,
    conflictReason: record.conflictReason,
    formattingAnnotations: record.formattingAnnotations,
    lastSavedAt: record.savedAt,
    lastManualSaveAt: Number.isNaN(lastManualSaveAt) ? Date.now() : lastManualSaveAt,
    latestApprovedVersion: record.draftBaseVersion,
  });

  context.setContent(record.contentMarkdown);
  context.contentRef.current = record.contentMarkdown;
  context.setSummary(record.summaryNote);
}
