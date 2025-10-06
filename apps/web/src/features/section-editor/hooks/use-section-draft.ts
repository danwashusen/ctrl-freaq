import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DraftStorageQuotaError,
  createDraftStore,
  createManualDraftStorage,
  type DraftStore,
  type ManualDraftPayload,
  type ManualDraftRecord,
  type ManualDraftStorage,
  type SectionDraftSnapshot,
} from '@ctrl-freaq/editor-persistence';
import { createPatchEngine } from '@ctrl-freaq/editor-core';

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
import {
  DraftPersistenceClient,
  type DraftSectionSubmission,
} from '@/features/document-editor/services/draft-client';
import {
  fetchProjectRetentionPolicy,
  type ProjectRetentionPolicy,
} from '@/features/document-editor/services/project-retention';

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
  projectSlug?: string;
  documentSlug?: string;
  sectionTitle?: string;
  sectionPath?: string;
  initialSummaryNote?: string | null;
  initialFormattingWarnings?: FormattingAnnotationDTO[];
  initialConflictState?: SectionDraftHookState['conflictState'];
  initialDraftId?: string | null;
  initialDraftVersion?: number | null;
  storage?: ManualDraftPersistence | null;
  diffPollingIntervalMs?: number;
  autoStartDiffPolling?: boolean;
  loadPersistedDraft?: boolean;
  draftClient?: DraftPersistenceClient;
}

export interface UseSectionDraftReturn {
  state: SectionDraftHookState;
  updateDraft: (content: string) => void;
  setSummary: (summary: string) => void;
  manualSave: () => Promise<SectionDraftResponseDTO | ConflictCheckResponseDTO | null>;
  refreshDiff: () => Promise<DiffResponseDTO | null>;
  resolveConflicts: () => Promise<ConflictCheckResponseDTO | null>;
}

type DraftPersistenceStatus = 'draft' | 'ready' | 'conflict';

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
    projectSlug,
    documentSlug,
    sectionTitle,
    sectionPath,
    initialSummaryNote = null,
    initialFormattingWarnings,
    initialConflictState = 'clean',
    initialDraftId = null,
    initialDraftVersion = null,
    storage: storageOverride = null,
    diffPollingIntervalMs = 45_000,
    autoStartDiffPolling = true,
    loadPersistedDraft = true,
    draftClient,
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
  const [retentionPolicy, setRetentionPolicy] = useState<ProjectRetentionPolicy | null>(null);

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

  const draftStore = useMemo<DraftStore | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return createDraftStore();
    } catch (error) {
      logger.warn('Failed to initialise draft store; draft persistence features disabled', {
        sectionId,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, [sectionId]);

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

  const patchEngineRef = useRef(createPatchEngine());
  const baselineContentRef = useRef(initialContent);
  const lastDraftContentRef = useRef(initialContent);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const hasPersistedDraftRef = useRef(false);
  const lastPersistedComplianceRef = useRef(false);

  useEffect(() => {
    baselineContentRef.current = initialContent;
    lastDraftContentRef.current = initialContent;
  }, [initialContent, sectionId]);

  const resolvedProjectSlug = projectSlug ?? documentId ?? 'local-project';
  const resolvedDocumentSlug = documentSlug ?? documentId ?? 'document-local';
  const resolvedSectionTitle = sectionTitle ?? sectionId;
  const resolvedSectionPath = sectionPath ?? sectionId;

  const computePatchPayload = useCallback(
    (contentValue: string) => {
      try {
        const patches = patchEngineRef.current.createPatch(
          baselineContentRef.current ?? '',
          contentValue
        );
        return JSON.stringify(patches);
      } catch (error) {
        logger.warn('Failed to generate patch diff for draft snapshot', {
          sectionId,
          reason: error instanceof Error ? error.message : String(error),
        });
        return contentValue;
      }
    },
    [sectionId]
  );

  const bundleClient = useMemo(() => draftClient ?? new DraftPersistenceClient(), [draftClient]);

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

  const persistDraftToStore = useCallback(
    async (contentValue: string, status: DraftPersistenceStatus) => {
      if (
        !draftStore ||
        !resolvedProjectSlug ||
        !resolvedDocumentSlug ||
        !resolvedSectionPath ||
        typeof window === 'undefined' ||
        sectionId.startsWith('inactive-') ||
        !userId
      ) {
        return;
      }

      const draftStateSnapshot = useSectionDraftStore.getState();
      const baselineFromState = draftStateSnapshot.draftBaseVersion ?? approvedVersion ?? 0;
      const baselineVersionLabel = `rev-${baselineFromState}`;
      const shouldMarkComplianceWarning =
        Boolean(retentionPolicy) || Boolean(draftStateSnapshot.conflictReason);

      try {
        const result = await draftStore.saveDraft({
          projectSlug: resolvedProjectSlug,
          documentSlug: resolvedDocumentSlug,
          sectionTitle: resolvedSectionTitle,
          sectionPath: resolvedSectionPath,
          authorId: userId,
          baselineVersion: baselineVersionLabel,
          patch: computePatchPayload(contentValue),
          status,
          lastEditedAt: new Date(),
          complianceWarning: shouldMarkComplianceWarning,
        });

        lastDraftContentRef.current = contentValue;
        hasPersistedDraftRef.current = true;
        lastPersistedComplianceRef.current = shouldMarkComplianceWarning;

        window.dispatchEvent(
          new CustomEvent('draft-storage:updated', {
            detail: { draftKey: result.record.draftKey },
          })
        );

        if (result.prunedDraftKeys.length > 0) {
          window.dispatchEvent(
            new CustomEvent('draft-storage:quota-exceeded', {
              detail: {
                message:
                  'Browser storage limit reached. Oldest drafts were removed to continue saving drafts.',
                prunedKeys: result.prunedDraftKeys,
              },
            })
          );
        }
      } catch (caught: unknown) {
        if (caught instanceof DraftStorageQuotaError) {
          const quotaError = caught as DraftStorageQuotaError;
          window.dispatchEvent(
            new CustomEvent('draft-storage:quota-exhausted', {
              detail: {
                message:
                  'Browser storage is full. Remove older drafts or submit changes before continuing.',
                prunedKeys: quotaError.prunedDraftKeys,
                draftKey: quotaError.draftKey,
              },
            })
          );
        }
        const reason = caught instanceof Error ? caught.message : String(caught);
        logger.warn('Failed to persist draft snapshot to DraftStore', {
          sectionId,
          projectSlug: resolvedProjectSlug,
          documentSlug: resolvedDocumentSlug,
          reason,
        });
      }
    },
    [
      draftStore,
      resolvedProjectSlug,
      resolvedDocumentSlug,
      resolvedSectionTitle,
      resolvedSectionPath,
      userId,
      computePatchPayload,
      approvedVersion,
      sectionId,
      retentionPolicy,
    ]
  );

  const persistDraft = useCallback(
    async (payload: ManualDraftPayload) => {
      if (!storage || !documentId || !userId) {
        return;
      }

      try {
        await storage.saveDraft(payload);
      } catch (caught: unknown) {
        const reason = caught instanceof Error ? caught.message : String(caught);
        logger.warn('Unable to persist manual draft snapshot', {
          sectionId,
          documentId,
          userId,
          reason,
        });
      }

      const status: DraftPersistenceStatus =
        payload.conflictState === 'clean' ? 'draft' : 'conflict';
      void persistDraftToStore(payload.contentMarkdown, status);
    },
    [storage, documentId, userId, sectionId, persistDraftToStore]
  );

  useEffect(() => {
    if (
      !draftStore ||
      !resolvedProjectSlug ||
      !documentId ||
      !userId ||
      sectionId.startsWith('inactive-') ||
      typeof window === 'undefined'
    ) {
      return;
    }

    if (contentRef.current === lastDraftContentRef.current) {
      return;
    }

    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      const conflictState = useSectionDraftStore.getState().conflictState;
      const status: DraftPersistenceStatus = conflictState === 'clean' ? 'draft' : 'conflict';
      void persistDraftToStore(contentRef.current, status);
      autoSaveTimeoutRef.current = null;
    }, 750);

    return () => {
      if (autoSaveTimeoutRef.current !== null) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    content,
    draftStore,
    resolvedProjectSlug,
    documentId,
    userId,
    sectionId,
    persistDraftToStore,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!resolvedProjectSlug) {
      setRetentionPolicy(null);
      return () => {
        cancelled = true;
      };
    }

    const loadPolicy = async () => {
      try {
        const policy = await fetchProjectRetentionPolicy(resolvedProjectSlug);
        if (!cancelled) {
          setRetentionPolicy(policy);
        }
      } catch (error) {
        if (!cancelled) {
          setRetentionPolicy(null);
        }
        logger.debug('Failed to load retention policy for section drafts', {
          projectSlug: resolvedProjectSlug,
          sectionId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void loadPolicy();

    return () => {
      cancelled = true;
    };
  }, [resolvedProjectSlug, sectionId]);

  useEffect(() => {
    if (
      !retentionPolicy ||
      !hasPersistedDraftRef.current ||
      lastPersistedComplianceRef.current ||
      !lastDraftContentRef.current
    ) {
      return;
    }

    logger.debug('Reflagging persisted draft for compliance after retention policy load', {
      projectSlug: resolvedProjectSlug,
      documentSlug: resolvedDocumentSlug,
      sectionId,
    });

    const conflictSnapshot = useSectionDraftStore.getState().conflictState;
    const status: DraftPersistenceStatus = conflictSnapshot === 'clean' ? 'draft' : 'conflict';

    void persistDraftToStore(lastDraftContentRef.current, status);
  }, [retentionPolicy, persistDraftToStore, resolvedProjectSlug, resolvedDocumentSlug, sectionId]);

  const manualSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

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

      const bundleAuthorId = userId ?? 'user-local-author';
      const targetDocumentId = documentId ?? resolvedDocumentSlug;
      const bundleDraftKey = `${resolvedProjectSlug}/${resolvedDocumentSlug}/${resolvedSectionTitle}/${bundleAuthorId}`;
      const shouldMarkComplianceWarning =
        Boolean(retentionPolicy) || Boolean(storeState.conflictReason);

      const buildQualityGateReport = (
        snapshot: Pick<SectionDraftSnapshot, 'status' | 'complianceWarning'>
      ): DraftSectionSubmission['qualityGateReport'] => {
        const issues: DraftSectionSubmission['qualityGateReport']['issues'] = [];

        if (snapshot.status === 'conflict') {
          issues.push({
            gateId: 'draft.conflict',
            severity: 'blocker',
            message: 'Resolve draft conflicts before applying bundled saves.',
          });
        }

        if (snapshot.complianceWarning) {
          issues.push({
            gateId: 'draft.compliance',
            severity: 'warning',
            message: 'Retention policy flagged this draft; capture compliance warning.',
          });
        }

        const hasBlockingIssue = issues.some(issue => issue.severity === 'blocker');

        return {
          status: hasBlockingIssue ? 'fail' : 'pass',
          issues,
        };
      };

      const currentSectionSubmission: DraftSectionSubmission = {
        draftKey: bundleDraftKey,
        sectionPath: resolvedSectionPath,
        patch: computePatchPayload(contentRef.current),
        baselineVersion: `rev-${draftBaseVersion}`,
        qualityGateReport: buildQualityGateReport({
          status: storeState.conflictState === 'clean' ? 'draft' : 'conflict',
          complianceWarning: shouldMarkComplianceWarning,
        }),
      };

      const submittedSections: DraftSectionSubmission[] = [currentSectionSubmission];

      if (draftStore && resolvedProjectSlug && resolvedDocumentSlug && bundleAuthorId) {
        try {
          const storedDrafts = await draftStore.listDrafts({
            authorId: bundleAuthorId,
            projectSlug: resolvedProjectSlug,
            documentSlug: resolvedDocumentSlug,
          });

          for (const storedDraft of storedDrafts) {
            if (
              storedDraft.draftKey === bundleDraftKey ||
              storedDraft.sectionPath === resolvedSectionPath
            ) {
              continue;
            }

            submittedSections.push({
              draftKey: storedDraft.draftKey,
              sectionPath: storedDraft.sectionPath,
              patch: storedDraft.patch,
              baselineVersion: storedDraft.baselineVersion,
              qualityGateReport: buildQualityGateReport(storedDraft),
            });
          }
        } catch (error) {
          logger.warn('Failed to enumerate stored drafts for bundled save', {
            sectionId,
            projectSlug: resolvedProjectSlug,
            documentId: targetDocumentId,
            authorId: bundleAuthorId,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const targetedDraftKeys = new Set(submittedSections.map(section => section.draftKey));

      let bundleFailure: unknown = null;
      const appliedDraftKeys = new Set<string>();

      if (bundleClient && targetDocumentId) {
        try {
          const bundleResponse = await bundleClient.applyDraftBundle(
            resolvedProjectSlug,
            targetDocumentId,
            {
              submittedBy: bundleAuthorId,
              sections: submittedSections,
            }
          );

          for (const sectionPath of bundleResponse?.appliedSections ?? []) {
            const match = submittedSections.find(section => section.sectionPath === sectionPath);
            if (match) {
              appliedDraftKeys.add(match.draftKey);
            }
          }
        } catch (bundleError) {
          logger.error(
            'Failed to apply bundled draft save',
            {
              sectionId,
              projectSlug: resolvedProjectSlug,
              documentId: targetDocumentId,
            },
            bundleError instanceof Error ? bundleError : undefined
          );
          bundleFailure = bundleError;
        }
      }

      completeSave(response, { requestId, draftBaseVersion });
      useSectionDraftStore.setState(current => ({
        ...current,
        conflictState: response.conflictState === 'clean' ? 'clean' : current.conflictState,
        conflictReason: response.conflictState === 'clean' ? null : current.conflictReason,
      }));
      setDerivedState(current => ({
        ...current,
        conflictState: response.conflictState === 'clean' ? 'clean' : current.conflictState,
        summaryNote: response.summaryNote ?? current.summaryNote,
        formattingWarnings: response.formattingAnnotations.map(toFormattingAnnotation),
      }));

      if (response.conflictState === 'rebase_required' || response.conflictState === 'blocked') {
        applyConflict({
          status: response.conflictState,
          conflictReason: response.summaryNote ?? null,
          latestApprovedVersion: draftBaseVersion,
          rebasedDraft: undefined,
          events: [],
        });
        useSectionDraftStore.setState(current => ({
          ...current,
          conflictState: 'clean',
        }));
        setDerivedState(current => ({
          ...current,
          conflictState: 'clean',
        }));
      }

      const isCleanResponse = (response.conflictState ?? '').toLowerCase() === 'clean';

      const expectedSectionCount = submittedSections.length;
      const bundleClientAvailable = Boolean(bundleClient && targetDocumentId);

      if (
        isCleanResponse &&
        bundleClientAvailable &&
        !bundleFailure &&
        appliedDraftKeys.size !== expectedSectionCount
      ) {
        bundleFailure = new Error('Incomplete draft bundle response');
      }

      const bundleAppliedSuccessfully =
        !bundleFailure &&
        (!bundleClientAvailable || appliedDraftKeys.size === expectedSectionCount);

      if (bundleAppliedSuccessfully && isCleanResponse) {
        baselineContentRef.current = contentRef.current;
        lastDraftContentRef.current = contentRef.current;
        useSectionDraftStore.setState(current => ({
          ...current,
          draftBaseVersion: response.draftVersion,
        }));

        const draftKeysToRetire =
          appliedDraftKeys.size > 0 ? Array.from(appliedDraftKeys) : Array.from(targetedDraftKeys);

        if (draftStore && userId) {
          for (const draftKey of draftKeysToRetire) {
            try {
              await draftStore.removeDraft(draftKey);
            } catch (error) {
              logger.warn('Failed to retire DraftStore entry after bundled save', {
                sectionId,
                projectSlug: resolvedProjectSlug,
                documentId: targetDocumentId,
                draftKey,
                reason: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          for (const draftKey of draftKeysToRetire) {
            try {
              window.localStorage.setItem(
                `draft-store:cleared:${draftKey}`,
                new Date().toISOString()
              );
            } catch (storageError) {
              logger.debug('Unable to record cleared draft marker', {
                sectionId,
                draftKey,
                reason: storageError instanceof Error ? storageError.message : String(storageError),
              });
            }
          }
        }

        if (typeof window !== 'undefined' && window.sessionStorage) {
          for (const draftKey of draftKeysToRetire) {
            try {
              window.sessionStorage.setItem(
                `draft-store:recent-clean:${draftKey}`,
                Date.now().toString()
              );
            } catch (storageError) {
              logger.debug('Unable to record recent clean draft marker', {
                sectionId,
                draftKey,
                reason: storageError instanceof Error ? storageError.message : String(storageError),
              });
            }
          }
        }

        if (storage && documentId && userId) {
          try {
            await storage.deleteDraft(documentId, sectionId, userId);
          } catch (error) {
            logger.warn('Unable to delete manual draft snapshot after successful save', {
              sectionId,
              documentId,
              userId,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else if (documentId && userId) {
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

      if (!bundleAppliedSuccessfully) {
        const failureMessage =
          'Bundled save failed. Draft kept locally—review conflicts and retry.';

        logger.warn('Bundled save rejected; drafts retained locally', {
          sectionId,
          projectSlug: resolvedProjectSlug,
          documentId: targetDocumentId,
          reason: bundleFailure instanceof Error ? bundleFailure.message : String(bundleFailure),
        });

        if (!isCleanResponse) {
          if (enableDiffAutomation) {
            void refreshDiff();
          }

          syncDerivedStateFromStore();
          return response;
        }

        const guidanceError = new SectionEditorClientError(failureMessage, {
          status: bundleFailure instanceof SectionEditorClientError ? bundleFailure.status : 409,
          requestId,
          body:
            bundleFailure instanceof SectionEditorClientError
              ? bundleFailure.body
              : { reason: bundleFailure instanceof Error ? bundleFailure.message : undefined },
        });

        failSave(guidanceError, { requestId });
        syncDerivedStateFromStore();
        throw guidanceError;
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
    retentionPolicy,
    documentId,
    userId,
    enableDiffAutomation,
    refreshDiff,
    syncDerivedStateFromStore,
    setDerivedState,
    bundleClient,
    resolvedProjectSlug,
    resolvedDocumentSlug,
    resolvedSectionTitle,
    resolvedSectionPath,
    computePatchPayload,
    draftStore,
    storage,
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
