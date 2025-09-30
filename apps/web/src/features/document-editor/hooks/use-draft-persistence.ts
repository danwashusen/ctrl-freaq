import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDraftStore,
  type DraftStore,
  type DocumentDraftState,
} from '@ctrl-freaq/editor-persistence';
import {
  emitComplianceWarning,
  emitDraftPruned,
  emitDraftSaved,
} from '@/lib/telemetry/client-events';
import logger from '@/lib/logger';

export interface UseDraftPersistenceParams {
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
}

const buildDraftKey = ({
  projectSlug,
  documentSlug,
  sectionTitle,
  authorId,
}: UseDraftPersistenceParams): string => {
  return `${projectSlug}/${documentSlug}/${sectionTitle}/${authorId}`;
};

export function useDraftPersistence(params: UseDraftPersistenceParams): UseDraftPersistenceResult {
  const [statusLabel, setStatusLabel] = useState('Synced');
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string | null>(null);

  const draftStore = useMemo<DraftStore>(() => createDraftStore(), []);
  const draftKey = useMemo(() => buildDraftKey(params), [params]);

  useEffect(() => {
    let cancelled = false;

    const rehydrate = () => {
      draftStore
        .rehydrateDocumentState({
          projectSlug: params.projectSlug,
          documentSlug: params.documentSlug,
          authorId: params.authorId,
        })
        .then((state: DocumentDraftState | null) => {
          if (cancelled) return;

          if (!state || state.sections.length === 0) {
            setStatusLabel('Synced');
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
            return;
          }

          setStatusLabel('Draft pending');
          emitDraftSaved({
            draftKey,
            projectSlug: params.projectSlug,
            documentSlug: params.documentSlug,
            sectionPath: matchingSection.sectionPath ?? params.sectionPath,
            authorId: params.authorId,
          });

          if (state.pendingComplianceWarning) {
            emitComplianceWarning({
              draftKey,
              projectSlug: params.projectSlug,
              documentSlug: params.documentSlug,
              sectionPath: matchingSection.sectionPath ?? params.sectionPath,
              authorId: params.authorId,
              policyId: 'retention-client-only',
              detectedAt: new Date().toISOString(),
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatusLabel('Synced');
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
    params.projectSlug,
    params.documentSlug,
    params.authorId,
    params.sectionPath,
    draftKey,
  ]);

  const revertToPublished = useCallback(async () => {
    try {
      await draftStore.removeDraft(draftKey);
      setStatusLabel('Synced');
      setAriaAnnouncement('Draft reverted to published content');
      emitDraftPruned({
        draftKey,
        projectSlug: params.projectSlug,
        documentSlug: params.documentSlug,
        sectionPath: params.sectionPath,
        authorId: params.authorId,
        prunedKeys: [draftKey],
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('draft-storage:quota-cleared'));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        'Failed to revert draft to published content',
        {
          draftKey,
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
    params.projectSlug,
    params.documentSlug,
    params.sectionPath,
    params.authorId,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      await draftStore.clearAuthorDrafts(params.authorId);
      setStatusLabel('Synced');
      setAriaAnnouncement('Drafts cleared after logout for security');
      emitDraftPruned({
        draftKey,
        projectSlug: params.projectSlug,
        documentSlug: params.documentSlug,
        sectionPath: params.sectionPath,
        authorId: params.authorId,
        prunedKeys: [draftKey],
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('draft-storage:quota-cleared'));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        'Failed to clear drafts during logout',
        {
          draftKey,
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
    params.projectSlug,
    params.documentSlug,
    params.sectionPath,
    params.authorId,
  ]);

  return {
    statusLabel,
    ariaAnnouncement,
    revertToPublished,
    handleLogout,
    draftKey,
  };
}
