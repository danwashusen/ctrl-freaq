import { logger } from '@/lib/logger';

interface DraftEventPayload {
  draftKey: string;
  projectSlug: string;
  documentSlug: string;
  sectionPath: string;
  authorId: string;
}

export const emitDraftSaved = (payload: DraftEventPayload) => {
  logger.info('Draft saved locally', {
    event: 'draft.saved',
    ...payload,
  });
};

export const emitDraftPruned = (payload: DraftEventPayload & { prunedKeys: string[] }) => {
  logger.warn('Draft pruned due to storage constraints', {
    event: 'draft.pruned',
    ...payload,
  });
};

export const emitDraftConflict = (payload: DraftEventPayload & { reason: string }) => {
  logger.warn('Draft entered conflict state', {
    event: 'draft.conflict',
    ...payload,
  });
};

export const emitComplianceWarning = (
  payload: DraftEventPayload & { policyId: string; detectedAt: string }
) => {
  logger.warn('Compliance warning captured client-side', {
    event: 'compliance.warning',
    ...payload,
  });
};
