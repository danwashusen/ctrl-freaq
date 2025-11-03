import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shallow } from 'zustand/shallow';

import type ApiClient from '@/lib/api';
import { useApi, useApiClient } from '@/lib/api-context';
import { emitQualityGateValidationMetric } from '@/lib/telemetry/client-events';
import type { EventEnvelope } from '@/lib/streaming/event-hub';

import {
  documentQualityStore,
  useDocumentQualityStore,
  type DocumentQualityStoreState,
  type DocumentQualitySummary,
} from '../stores/document-quality-store';
import {
  sectionQualityStore,
  useSectionQualityStore,
  type QualityGateRunSource,
  type RemediationCard,
  type SectionQualitySnapshot,
  type SectionQualityStoreState,
} from '../stores/section-quality-store';
import {
  fetchSectionQualityResult,
  fetchDocumentQualitySummary,
  runDocumentQualityGate,
  runSectionQualityGate,
  type DocumentRunInput,
  type SectionRunInput,
} from '../services/quality-gates-api';

const SECTION_RESULT_QUERY_KEY = (documentId: string | null, sectionId: string | null) =>
  ['quality-gates', documentId ?? 'unknown', sectionId ?? 'unknown'] as const;
const DOCUMENT_SUMMARY_QUERY_KEY = (documentId: string | null) =>
  ['quality-gates', 'document', documentId ?? 'unknown'] as const;

const TICK_INTERVAL_MS = 200;

const reportQualityGateWarning = (message: string) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(message);
  }
};

type SectionResultEventPayload = {
  sectionId: string;
  documentId: string;
  runId: string;
  status: SectionQualitySnapshot['status'];
  rules: SectionQualitySnapshot['rules'];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  triggeredBy: string;
  source: SectionQualitySnapshot['source'];
  durationMs: number;
  remediationState: SectionQualitySnapshot['remediationState'];
  incidentId: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
};

interface QualityGateProgressEventPayload {
  runId: string;
  requestId: string;
  documentId: string;
  sectionId?: string | null;
  status: 'running' | 'completed' | 'failed';
  stage: string;
  percentComplete: number;
  incidentId: string | null;
  durationMs?: number | null;
  triggeredBy?: string | null;
  result?: SectionResultEventPayload | null;
}

type QualityGateSummaryEventPayload = DocumentQualitySummary & {
  status: string;
};

export interface UseQualityGatesOptions {
  sectionId?: string | null;
  documentId?: string | null;
  reason?: QualityGateRunSource;
  client?: ApiClient;
  serviceOverrides?: {
    fetchSectionResult?: typeof fetchSectionQualityResult;
    fetchDocumentSummary?: typeof fetchDocumentQualitySummary;
    runSection?: typeof runSectionQualityGate;
    runDocument?: typeof runDocumentQualityGate;
  };
}

export interface QualityGateRuntime {
  runSection: (options?: { reason?: QualityGateRunSource }) => Promise<void>;
  runDocument: (options?: { reason?: QualityGateRunSource }) => Promise<void>;
  isRunning: boolean;
  status: SectionQualityStoreState['status'];
  statusMessage: string;
  timeoutCopy: string | null;
  lastStatus: SectionQualityStoreState['lastStatus'];
  remediation: RemediationCard[];
  isSubmissionBlocked: boolean;
  blockerCount: number;
  incidentId: string | null;
  documentStatus: DocumentQualityStoreState['status'];
  documentStatusMessage: string;
  documentPublishCopy: string | null;
  documentSlaWarningCopy: string | null;
  documentSummary: DocumentQualitySummary | null;
  documentLastRunAt: string | null;
  documentRequestId: string | null;
  documentTriggeredBy: string | null;
  documentDurationMs: number | null;
  isDocumentPublishBlocked: boolean;
  isDocumentRunning: boolean;
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

const extractIncidentId = (error: unknown): string | null => {
  const record = toRecord(error);
  if (!record) {
    return null;
  }

  const details = toRecord(record.details);
  const incidentFromDetails = details?.incidentId;
  if (typeof incidentFromDetails === 'string') {
    return incidentFromDetails;
  }

  const incidentFromRoot = record.incidentId;
  return typeof incidentFromRoot === 'string' ? incidentFromRoot : null;
};

const extractRequestId = (error: unknown): string | null => {
  const record = toRecord(error);
  if (!record) {
    return null;
  }

  const body = toRecord(record.body);
  if (body && typeof body.requestId === 'string') {
    return body.requestId;
  }

  if (typeof record.requestId === 'string') {
    return record.requestId;
  }

  const details = toRecord(record.details);
  if (details && typeof details.requestId === 'string') {
    return details.requestId;
  }

  return null;
};

export const useQualityGates = (options: UseQualityGatesOptions = {}): QualityGateRuntime => {
  const apiClientFromContext = useApiClient();
  const client = options.client ?? apiClientFromContext;
  const queryClient = useQueryClient();

  const sectionId = options.sectionId ?? null;
  const documentId = options.documentId ?? null;

  const fetchSection = options.serviceOverrides?.fetchSectionResult ?? fetchSectionQualityResult;
  const fetchDocumentSummaryFn =
    options.serviceOverrides?.fetchDocumentSummary ?? fetchDocumentQualitySummary;
  const runSectionService = options.serviceOverrides?.runSection ?? runSectionQualityGate;
  const runDocumentService = options.serviceOverrides?.runDocument ?? runDocumentQualityGate;
  const { eventHub, eventHubHealth, eventHubEnabled } = useApi();
  const shouldPoll = !eventHubEnabled || eventHubHealth.fallbackActive;

  const {
    status,
    statusMessage,
    timeoutCopy,
    lastStatus,
    remediation,
    isSubmissionBlocked,
    blockerCount,
    incidentId,
  } = useSectionQualityStore(
    store => ({
      status: store.status,
      statusMessage: store.statusMessage,
      timeoutCopy: store.timeoutCopy,
      lastStatus: store.lastStatus,
      remediation: store.remediation,
      isSubmissionBlocked: store.isSubmissionBlocked,
      blockerCount: store.blockerCount,
      incidentId: store.incidentId,
    }),
    shallow
  );

  const {
    status: documentStatus,
    statusMessage: documentStatusMessage,
    publishCopy: documentPublishCopy,
    slaWarningCopy: documentSlaWarningCopy,
    summary: documentSummary,
    lastRunAt: documentLastRunAt,
    requestId: documentRequestId,
    triggeredBy: documentTriggeredBy,
    durationMs: documentDurationMs,
    isPublishBlocked: isDocumentPublishBlocked,
  } = useDocumentQualityStore(
    store => ({
      status: store.status,
      statusMessage: store.statusMessage,
      publishCopy: store.publishCopy,
      slaWarningCopy: store.slaWarningCopy,
      summary: store.summary,
      lastRunAt: store.lastRunAt,
      requestId: store.requestId,
      triggeredBy: store.triggeredBy,
      durationMs: store.durationMs,
      isPublishBlocked: store.isPublishBlocked,
    }),
    shallow
  );

  useEffect(() => {
    if (!eventHubEnabled) {
      return;
    }

    const handleSectionProgress = (payload: QualityGateProgressEventPayload) => {
      if (!sectionId || payload.sectionId !== sectionId) {
        return;
      }

      const sectionState = sectionQualityStore.getState();

      if (payload.status === 'running') {
        sectionState.beginValidation({
          requestId: payload.requestId ?? payload.runId,
          runId: payload.runId,
          triggeredBy: payload.triggeredBy ?? 'unknown',
          startedAt: Date.now(),
          source: options.reason ?? 'manual',
        });
        return;
      }

      if (payload.status === 'failed') {
        sectionState.failValidation({
          incidentId: payload.incidentId ?? null,
          error: new Error('Quality gate validation failed'),
          requestId: payload.requestId ?? null,
          runId: payload.runId,
          durationMs: payload.durationMs ?? null,
        });
        emitQualityGateValidationMetric({
          requestId: payload.requestId ?? 'failed-request',
          documentId: payload.documentId,
          sectionId: payload.sectionId ?? sectionId ?? 'unknown',
          triggeredBy: payload.triggeredBy ?? null,
          durationMs: payload.durationMs ?? 0,
          status: 'failed',
          scope: 'section',
          incidentId: payload.incidentId ?? undefined,
        });
        return;
      }

      if (payload.status === 'completed' && payload.result) {
        const snapshot = payload.result;
        sectionState.completeValidation({
          runId: snapshot.runId,
          status: snapshot.status,
          durationMs: payload.durationMs ?? snapshot.durationMs ?? 0,
          rules: snapshot.rules ?? [],
          triggeredBy: snapshot.triggeredBy ?? null,
          requestId: snapshot.requestId ?? null,
          lastRunAt: snapshot.lastRunAt ?? null,
          lastSuccessAt: snapshot.lastSuccessAt ?? null,
          remediationState: snapshot.remediationState ?? 'pending',
          incidentId: snapshot.incidentId ?? null,
        });

        queryClient.setQueryData(
          SECTION_RESULT_QUERY_KEY(documentId, sectionId),
          snapshot
        );

        emitQualityGateValidationMetric({
          requestId: snapshot.requestId ?? payload.requestId ?? 'section-complete',
          documentId: snapshot.documentId,
          sectionId: snapshot.sectionId,
          triggeredBy: snapshot.triggeredBy ?? null,
          durationMs: payload.durationMs ?? snapshot.durationMs,
          status: 'completed',
          scope: 'section',
          incidentId: snapshot.incidentId ?? undefined,
          outcome: snapshot.status,
        });
      }
    };

    const handleDocumentProgress = (payload: QualityGateProgressEventPayload) => {
      if (payload.sectionId && payload.sectionId !== sectionId) {
        return;
      }
      if (documentId && payload.documentId !== documentId) {
        return;
      }

      const documentState = documentQualityStore.getState();

      if (payload.status === 'running') {
        documentState.beginBatchRun({
          documentId: payload.documentId,
          requestId: payload.requestId ?? payload.runId,
          triggeredBy: payload.triggeredBy ?? 'unknown',
          startedAt: Date.now(),
        });
        return;
      }

      if (payload.status === 'failed') {
        documentState.failBatchRun({
          requestId: payload.requestId ?? null,
          error: new Error('Document validation failed'),
          incidentId: payload.incidentId ?? null,
        });
        emitQualityGateValidationMetric({
          requestId: payload.requestId ?? 'failed-request',
          documentId: payload.documentId,
          sectionId: undefined,
          triggeredBy: payload.triggeredBy ?? null,
          durationMs: payload.durationMs ?? 0,
          status: 'failed',
          scope: 'document',
          incidentId: payload.incidentId ?? undefined,
        });
      }
    };

    const handleProgress = (envelope: EventEnvelope<QualityGateProgressEventPayload>) => {
      const payload = envelope.payload;
      if (payload.sectionId) {
        handleSectionProgress(payload);
        return;
      }
      handleDocumentProgress(payload);
    };

    const handleSummary = (envelope: EventEnvelope<QualityGateSummaryEventPayload>) => {
      const payload = envelope.payload;
      if (documentId && payload.documentId !== documentId) {
        return;
      }

      const summary: DocumentQualitySummary = {
        documentId: payload.documentId,
        statusCounts: payload.statusCounts,
        blockerSections: payload.blockerSections,
        warningSections: payload.warningSections,
        lastRunAt: payload.lastRunAt,
        triggeredBy: payload.triggeredBy,
        requestId: payload.requestId,
        publishBlocked: payload.publishBlocked,
        coverageGaps: payload.coverageGaps ?? [],
      };

      const documentState = documentQualityStore.getState();
      if (documentState.status === 'running') {
        documentState.completeBatchRun(summary);
      } else {
        documentState.hydrateSummary(summary);
      }

      queryClient.setQueryData(DOCUMENT_SUMMARY_QUERY_KEY(documentId), summary);

      const nextDocumentState = documentQualityStore.getState();
      emitQualityGateValidationMetric({
        requestId: summary.requestId ?? 'document-summary',
        documentId: summary.documentId,
        sectionId: undefined,
        triggeredBy: summary.triggeredBy ?? null,
        durationMs: nextDocumentState.durationMs ?? 0,
        status: 'completed',
        scope: 'document',
        incidentId: undefined,
      });
    };

    const unsubscribes = [
      eventHub.subscribe({ topic: 'quality-gate.progress' }, handleProgress),
      eventHub.subscribe({ topic: 'quality-gate.summary' }, handleSummary),
    ];

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [documentId, eventHub, eventHubEnabled, options.reason, queryClient, sectionId]);

  useEffect(() => {
    if (status !== 'validating' || typeof window === 'undefined' || !shouldPoll) {
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) {
        return;
      }
      sectionQualityStore.getState().tick(Date.now());
    };

    tick();
    const intervalId = window.setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [status, shouldPoll]);

  useEffect(() => {
    if (documentStatus !== 'running' || typeof window === 'undefined' || !shouldPoll) {
      return;
    }

    let cancelled = false;
    const tick = () => {
      if (cancelled) {
        return;
      }
      documentQualityStore.getState().tick(Date.now());
    };

    tick();
    const intervalId = window.setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [documentStatus, shouldPoll]);

  const sectionResultQuery = useQuery({
    queryKey: SECTION_RESULT_QUERY_KEY(documentId, sectionId),
    enabled: Boolean(sectionId) && Boolean(documentId),
    refetchInterval: shouldPoll && status === 'validating' ? 500 : false,
    refetchIntervalInBackground: shouldPoll && status === 'validating',
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      if (!sectionId || !documentId) {
        throw new Error(
          'Section and document identifiers are required to fetch quality gate result.'
        );
      }
      return fetchSection(client, documentId, sectionId);
    },
  });
  useEffect(() => {
    const snapshot = sectionResultQuery.data;
    if (!snapshot) {
      return;
    }

    const state = sectionQualityStore.getState();

    if (state.status === 'validating') {
      if (!state.runId || snapshot.runId !== state.runId) {
        return;
      }

      state.completeValidation({
        runId: snapshot.runId,
        status: snapshot.status,
        durationMs: snapshot.durationMs,
        rules: snapshot.rules,
        triggeredBy: snapshot.triggeredBy,
        requestId: snapshot.requestId ?? state.requestId,
        lastRunAt: snapshot.lastRunAt,
        lastSuccessAt: snapshot.lastSuccessAt,
        remediationState: snapshot.remediationState,
        incidentId: snapshot.incidentId ?? null,
      });

      emitQualityGateValidationMetric({
        requestId: snapshot.requestId ?? state.requestId ?? snapshot.runId ?? 'unknown',
        documentId: snapshot.documentId,
        sectionId: snapshot.sectionId,
        triggeredBy: snapshot.triggeredBy ?? null,
        durationMs: snapshot.durationMs,
        status: 'completed',
        scope: 'section',
        incidentId: snapshot.incidentId ?? undefined,
        outcome: snapshot.status,
      });
      return;
    }

    state.hydrateFromResult(snapshot);
  }, [sectionResultQuery.data, status]);

  const documentSummaryQuery = useQuery({
    queryKey: DOCUMENT_SUMMARY_QUERY_KEY(documentId),
    enabled: Boolean(documentId),
    refetchInterval: shouldPoll && documentStatus === 'running' ? 1000 : false,
    refetchIntervalInBackground: shouldPoll && documentStatus === 'running',
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      if (!documentId) {
        throw new Error('Document identifier required to fetch quality gate summary.');
      }
      return fetchDocumentSummaryFn(client, documentId);
    },
  });

  useEffect(() => {
    if (!documentSummaryQuery.data) {
      return;
    }
    documentQualityStore.getState().hydrateSummary(documentSummaryQuery.data);
  }, [documentSummaryQuery.data]);

  const sectionRunMutation = useMutation({
    mutationFn: async (reason?: QualityGateRunSource | null) => {
      if (!sectionId || !documentId) {
        throw new Error('Section and document identifiers are required to run section validation.');
      }
      const input: SectionRunInput = {
        sectionId,
        documentId,
        reason: reason ?? options.reason,
      };
      return runSectionService(client, input);
    },
    onSuccess: (acknowledgement, reason) => {
      const validationSource: QualityGateRunSource = reason ?? options.reason ?? 'manual';

      sectionQualityStore.getState().beginValidation({
        requestId: acknowledgement.requestId,
        runId: acknowledgement.runId,
        triggeredBy: acknowledgement.triggeredBy ?? 'unknown',
        startedAt: Date.now(),
        source: validationSource,
      });

      emitQualityGateValidationMetric({
        requestId: acknowledgement.requestId,
        documentId: acknowledgement.documentId,
        sectionId: acknowledgement.sectionId ?? sectionId ?? 'unknown',
        triggeredBy: acknowledgement.triggeredBy ?? null,
        durationMs: 0,
        status: acknowledgement.status === 'queued' ? 'queued' : 'running',
        scope: acknowledgement.sectionId ? 'section' : 'document',
      });

      void queryClient.invalidateQueries({
        queryKey: SECTION_RESULT_QUERY_KEY(documentId, sectionId),
      });
    },
    onError: error => {
      const incidentId = extractIncidentId(error);
      const requestId = extractRequestId(error);

      sectionQualityStore.getState().failValidation({
        incidentId,
        error: error instanceof Error ? error : new Error('Quality gate run failed'),
        requestId: requestId ?? null,
      });

      if (sectionId) {
        emitQualityGateValidationMetric({
          requestId: requestId ?? 'failed-request',
          documentId: documentId ?? 'unknown',
          sectionId,
          triggeredBy: null,
          durationMs: 0,
          status: 'failed',
          scope: 'section',
          incidentId: incidentId ?? undefined,
        });
      }
    },
  });

  const documentRunMutation = useMutation({
    mutationFn: async (reason?: QualityGateRunSource | null) => {
      if (!documentId) {
        throw new Error('Document identifier required to run document validation.');
      }
      const input: DocumentRunInput = {
        documentId,
        reason: reason ?? options.reason,
      };
      return runDocumentService(client, input);
    },
    onSuccess: acknowledgement => {
      documentQualityStore.getState().beginBatchRun({
        documentId: acknowledgement.documentId,
        requestId: acknowledgement.requestId,
        triggeredBy: acknowledgement.triggeredBy ?? 'unknown',
        startedAt: Date.now(),
      });
      emitQualityGateValidationMetric({
        requestId: acknowledgement.requestId,
        documentId: acknowledgement.documentId,
        sectionId: acknowledgement.sectionId,
        triggeredBy: acknowledgement.triggeredBy ?? null,
        durationMs: 0,
        status: acknowledgement.status === 'queued' ? 'queued' : 'running',
        scope: 'document',
      });
      void queryClient.invalidateQueries({
        queryKey: DOCUMENT_SUMMARY_QUERY_KEY(documentId),
      });
    },
    onError: error => {
      const incidentId = extractIncidentId(error);
      const requestId = extractRequestId(error);

      documentQualityStore.getState().failBatchRun({
        requestId,
        error: error instanceof Error ? error : new Error('Document validation failed'),
        incidentId: incidentId ?? undefined,
      });

      emitQualityGateValidationMetric({
        requestId: requestId ?? 'failed-request',
        documentId: documentId ?? 'unknown',
        sectionId: undefined,
        triggeredBy: null,
        durationMs: 0,
        status: 'failed',
        scope: 'document',
        incidentId: incidentId ?? undefined,
      });
    },
  });

  const runSection = useCallback(
    async (override?: { reason?: QualityGateRunSource }) => {
      if (!sectionId || !documentId) {
        reportQualityGateWarning(
          '[quality-gates] runSection requested without section/document identifiers.'
        );
        return;
      }
      await sectionRunMutation.mutateAsync(override?.reason ?? options.reason);
    },
    [documentId, options.reason, sectionId, sectionRunMutation]
  );

  const runDocument = useCallback(
    async (override?: { reason?: QualityGateRunSource }) => {
      if (!documentId) {
        reportQualityGateWarning(
          '[quality-gates] runDocument requested without document identifier.'
        );
        return;
      }
      await documentRunMutation.mutateAsync(override?.reason ?? options.reason);
    },
    [documentId, options.reason, documentRunMutation]
  );

  return useMemo(
    () => ({
      runSection,
      runDocument,
      isRunning: status === 'validating',
      status,
      statusMessage,
      timeoutCopy,
      lastStatus,
      remediation,
      isSubmissionBlocked,
      blockerCount,
      incidentId,
      documentStatus,
      documentStatusMessage,
      documentPublishCopy,
      documentSlaWarningCopy,
      documentSummary,
      documentLastRunAt,
      documentRequestId,
      documentTriggeredBy,
      documentDurationMs,
      isDocumentPublishBlocked,
      isDocumentRunning: documentStatus === 'running',
    }),
    [
      blockerCount,
      documentDurationMs,
      documentLastRunAt,
      documentPublishCopy,
      documentSlaWarningCopy,
      documentRequestId,
      documentStatus,
      documentStatusMessage,
      documentSummary,
      documentTriggeredBy,
      isDocumentPublishBlocked,
      incidentId,
      isSubmissionBlocked,
      lastStatus,
      remediation,
      runDocument,
      runSection,
      status,
      statusMessage,
      timeoutCopy,
    ]
  );
};

export default useQualityGates;
