import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDraftStore,
  type DraftStore,
  type DocumentDraftState,
} from '@ctrl-freaq/editor-persistence';
import { logDraftComplianceWarning } from '@ctrl-freaq/qa';
import {
  emitComplianceWarning,
  emitDraftPruned,
  emitDraftSaved,
} from '@/lib/telemetry/client-events';
import logger from '@/lib/logger';
import { useDraftStateStore } from '../stores/draft-state';
import { DraftPersistenceClient, type DraftComplianceRequest } from '../services/draft-client';

export interface UseDraftPersistenceParams {
  projectId: string;
  projectSlug: string;
  documentSlug: string;
  sectionTitle: string;
  sectionPath: string;
  authorId: string;
}

export interface UseDraftPersistenceResult {
  statusLabel: string;
  ariaAnnouncement: string | null;
  revertToPublished(): Promise<void>;
  handleLogout(): Promise<void>;
  draftKey: string;
  requiresConfirmation: boolean;
  confirmRecoveredDraft(): Promise<void>;
  discardRecoveredDraft(): Promise<void>;
  lastUpdatedLabel: string | null;
  lastUpdatedIso: string | null;
}

const buildDraftKey = ({
  projectSlug,
  documentSlug,
  sectionTitle,
  authorId,
}: Pick<
  UseDraftPersistenceParams,
  'projectSlug' | 'documentSlug' | 'sectionTitle' | 'authorId'
>): string => {
  return `${projectSlug}/${documentSlug}/${sectionTitle}/${authorId}`;
};

export function useDraftPersistence(params: UseDraftPersistenceParams): UseDraftPersistenceResult {
  const [statusLabel, setStatusLabel] = useState('Synced');
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const draftStore = useMemo<DraftStore>(() => createDraftStore(), []);
  const draftKey = useMemo(() => buildDraftKey(params), [params]);
  const markDraftRehydrated = useDraftStateStore(state => state.markDraftRehydrated);
  const resolveRehydratedDraft = useDraftStateStore(state => state.resolveRehydratedDraft);
  const clearRehydratedDraft = useDraftStateStore(state => state.clearRehydratedDraft);
  const draftClient = useMemo(() => new DraftPersistenceClient(), []);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    []
  );
  const lastUpdatedLabel = useMemo(
    () => (lastUpdatedAt ? dateFormatter.format(lastUpdatedAt) : null),
    [dateFormatter, lastUpdatedAt]
  );
  const lastUpdatedIso = useMemo(
    () => (lastUpdatedAt ? lastUpdatedAt.toISOString() : null),
    [lastUpdatedAt]
  );

  const revertToPublished = useCallback(async () => {
    try {
      await draftStore.removeDraft(draftKey);
      setStatusLabel('Synced');
      setAriaAnnouncement('Draft reverted to published content');
      setRequiresConfirmation(false);
      setLastUpdatedAt(null);
      emitDraftPruned({
        draftKey,
        projectId: params.projectId,
        projectSlug: params.projectSlug,
        documentSlug: params.documentSlug,
        sectionPath: params.sectionPath,
        authorId: params.authorId,
        prunedKeys: [draftKey],
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('draft-storage:quota-cleared'));
      }
      resolveRehydratedDraft(draftKey, 'discarded');
      clearRehydratedDraft(draftKey);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        'Failed to revert draft to published content',
        {
          draftKey,
          projectId: params.projectId,
          projectSlug: params.projectSlug,
          documentSlug: params.documentSlug,
          sectionPath: params.sectionPath,
          authorId: params.authorId,
        },
        err
      );
      setAriaAnnouncement('Unable to revert draft. Try again.');
    }
  }, [
    draftStore,
    draftKey,
    params.projectId,
    params.projectSlug,
    params.documentSlug,
    params.sectionPath,
    params.authorId,
    resolveRehydratedDraft,
    clearRehydratedDraft,
  ]);

  const confirmRecoveredDraft = useCallback(async () => {
    setStatusLabel('Draft pending');
    setRequiresConfirmation(false);
    setAriaAnnouncement('Recovered draft ready for review.');
    resolveRehydratedDraft(draftKey, 'applied');
  }, [draftKey, resolveRehydratedDraft]);

  const discardRecoveredDraft = useCallback(async () => {
    await revertToPublished();
  }, [revertToPublished]);

  const handleLogout = useCallback(async () => {
    try {
      await draftStore.clearAuthorDrafts(params.authorId);
      setStatusLabel('Synced');
      setAriaAnnouncement('Drafts cleared after logout for security');
      setRequiresConfirmation(false);
      setLastUpdatedAt(null);
      emitDraftPruned({
        draftKey,
        projectId: params.projectId,
        projectSlug: params.projectSlug,
        documentSlug: params.documentSlug,
        sectionPath: params.sectionPath,
        authorId: params.authorId,
        prunedKeys: [draftKey],
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('draft-storage:quota-cleared'));
      }
      resolveRehydratedDraft(draftKey, 'discarded');
      clearRehydratedDraft(draftKey);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        'Failed to clear drafts during logout',
        {
          draftKey,
          projectId: params.projectId,
          projectSlug: params.projectSlug,
          documentSlug: params.documentSlug,
          sectionPath: params.sectionPath,
          authorId: params.authorId,
        },
        err
      );
      setAriaAnnouncement('Unable to clear drafts. Check console for details.');
    }
  }, [
    draftStore,
    draftKey,
    params.projectId,
    params.projectSlug,
    params.documentSlug,
    params.sectionPath,
    params.authorId,
    resolveRehydratedDraft,
    clearRehydratedDraft,
  ]);

  useEffect(() => {
    let cancelled = false;

    const rehydrate = () => {
      draftStore
        .rehydrateDocumentState({
          projectId: params.projectId,
          projectSlug: params.projectSlug,
          documentSlug: params.documentSlug,
          authorId: params.authorId,
        })
        .then((state: DocumentDraftState | null) => {
          if (cancelled) return;

          if (!state || state.sections.length === 0) {
            setStatusLabel('Synced');
            setAriaAnnouncement(null);
            setRequiresConfirmation(false);
            clearRehydratedDraft(draftKey);
            setLastUpdatedAt(null);
            return;
          }

          const matchingSection = state.sections.find(
            (section: DocumentDraftState['sections'][number]) => {
              if (section.draftKey) {
                return section.draftKey === draftKey;
              }
              return section.sectionPath === params.sectionPath;
            }
          );

          if (!matchingSection) {
            setStatusLabel('Synced');
            setAriaAnnouncement(null);
            setRequiresConfirmation(false);
            clearRehydratedDraft(draftKey);
            setLastUpdatedAt(null);
            return;
          }

          const resolvedDraftKey =
            matchingSection.draftKey ??
            `${params.projectSlug}/${params.documentSlug}/${matchingSection.sectionTitle ?? params.sectionTitle}/${params.authorId}`;

          const lastEditedAtDate =
            matchingSection.lastEditedAt instanceof Date
              ? matchingSection.lastEditedAt
              : new Date(matchingSection.lastEditedAt ?? Date.now());
          const lastEditedTimestamp = lastEditedAtDate.getTime();

          let shouldAutoDiscard = false;

          if (typeof window !== 'undefined') {
            try {
              const clearedMarkerKey = `draft-store:cleared:${resolvedDraftKey}`;
              const clearedMarker = window.localStorage?.getItem(clearedMarkerKey);
              if (clearedMarker) {
                const clearedTimestamp = Date.parse(clearedMarker);
                if (!Number.isNaN(clearedTimestamp) && lastEditedTimestamp <= clearedTimestamp) {
                  shouldAutoDiscard = true;
                }
                window.localStorage.removeItem(clearedMarkerKey);
              }

              const recentCleanMarkerKey = `draft-store:recent-clean:${resolvedDraftKey}`;
              const recentCleanMarker = window.sessionStorage?.getItem(recentCleanMarkerKey);
              if (recentCleanMarker !== null) {
                const recentCleanTimestamp = Number.parseInt(recentCleanMarker, 10);
                if (
                  !Number.isNaN(recentCleanTimestamp) &&
                  lastEditedTimestamp <= recentCleanTimestamp
                ) {
                  shouldAutoDiscard = true;
                }
                window.sessionStorage.removeItem(recentCleanMarkerKey);
              }
            } catch (storageError) {
              logger.debug('Unable to inspect draft persistence markers', {
                draftKey: resolvedDraftKey,
                reason: storageError instanceof Error ? storageError.message : String(storageError),
              });
            }
          }

          if (shouldAutoDiscard) {
            setStatusLabel('Synced');
            setAriaAnnouncement(null);
            setRequiresConfirmation(false);
            clearRehydratedDraft(draftKey);
            void discardRecoveredDraft().catch(error => {
              logger.debug('Auto-discard of recovered draft failed', {
                draftKey,
                projectId: params.projectId,
                reason: error instanceof Error ? error.message : String(error),
              });
            });
            setLastUpdatedAt(null);
            return;
          }

          setStatusLabel('Review recovered draft');
          setAriaAnnouncement('Draft restored from local recovery. Review before continuing.');
          setRequiresConfirmation(true);
          setLastUpdatedAt(lastEditedAtDate);
          markDraftRehydrated({
            draftKey,
            sectionTitle: matchingSection.sectionTitle ?? params.sectionTitle,
            sectionPath: matchingSection.sectionPath ?? params.sectionPath,
            baselineVersion: matchingSection.baselineVersion,
            lastEditedAt: lastEditedAtDate.getTime(),
            confirm: confirmRecoveredDraft,
            discard: discardRecoveredDraft,
          });

          emitDraftSaved({
            draftKey,
            projectId: params.projectId,
            projectSlug: params.projectSlug,
            documentSlug: params.documentSlug,
            sectionPath: matchingSection.sectionPath ?? params.sectionPath,
            authorId: params.authorId,
          });

          if (state.pendingComplianceWarning) {
            const detectedAt = new Date();
            const compliancePayload = {
              authorId: params.authorId,
              policyId: 'retention-client-only',
              detectedAt: detectedAt.toISOString(),
              context: {
                draftKey,
                sectionPath: matchingSection.sectionPath ?? params.sectionPath,
              },
            } satisfies DraftComplianceRequest;
            const qaLogger = {
              warn(payload: Record<string, unknown>, message?: string) {
                logger.warn(message ?? 'Draft retention policy warning recorded', payload);
              },
            };
            logDraftComplianceWarning(qaLogger, {
              projectId: params.projectId,
              projectSlug: params.projectSlug,
              documentSlug: params.documentSlug,
              authorId: params.authorId,
              policyId: compliancePayload.policyId,
              detectedAt,
              context: {
                draftKey,
                sectionPath: matchingSection.sectionPath ?? params.sectionPath,
              },
            });
            void Promise.resolve(
              draftClient.logComplianceWarning({
                projectSlug: params.projectSlug,
                documentId: params.documentSlug,
                payload: compliancePayload,
              })
            ).catch(error => {
              logger.warn('Failed to log compliance warning', {
                draftKey,
                projectId: params.projectId,
                projectSlug: params.projectSlug,
                documentSlug: params.documentSlug,
                errorMessage: error instanceof Error ? error.message : String(error),
              });
            });
            emitComplianceWarning({
              draftKey,
              projectId: params.projectId,
              projectSlug: params.projectSlug,
              documentSlug: params.documentSlug,
              sectionPath: matchingSection.sectionPath ?? params.sectionPath,
              authorId: params.authorId,
              policyId: 'retention-client-only',
              detectedAt: detectedAt.toISOString(),
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatusLabel('Synced');
            setAriaAnnouncement(null);
            setRequiresConfirmation(false);
            setLastUpdatedAt(null);
          }
        });
    };

    rehydrate();

    if (typeof window !== 'undefined') {
      const handleUpdate = (event: Event) => {
        const detail = (event as CustomEvent<{ draftKey?: string }>).detail;
        if (detail?.draftKey) {
          const matchesProject =
            !params.projectSlug ||
            detail.draftKey.startsWith(`${params.projectSlug}/${params.documentSlug ?? ''}`);
          const matchesAuthor = !params.authorId || detail.draftKey.endsWith(`/${params.authorId}`);
          if (!matchesProject || !matchesAuthor) {
            return;
          }
        }
        rehydrate();
      };

      window.addEventListener('draft-storage:updated', handleUpdate);

      return () => {
        cancelled = true;
        window.removeEventListener('draft-storage:updated', handleUpdate);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [
    draftStore,
    params.projectId,
    params.projectSlug,
    params.documentSlug,
    params.authorId,
    params.sectionPath,
    draftKey,
    markDraftRehydrated,
    confirmRecoveredDraft,
    discardRecoveredDraft,
    clearRehydratedDraft,
    draftClient,
    params.sectionTitle,
  ]);

  return {
    statusLabel,
    ariaAnnouncement,
    revertToPublished,
    handleLogout,
    draftKey,
    requiresConfirmation,
    confirmRecoveredDraft,
    discardRecoveredDraft,
    lastUpdatedLabel,
    lastUpdatedIso,
  };
}
