import { createStore } from 'zustand/vanilla';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { StoreApi } from 'zustand';

import {
  createDocQualityTranslator,
  docQualityMessages,
  type DocQualityTranslator,
} from '@/lib/i18n';

const DEFAULT_DOCUMENT_SLA_MS = 5000;

export type QualityGateCoverageGapReason = 'no-link' | 'blocker' | 'warning-override';

export interface DocumentCoverageGap {
  requirementId: string;
  reason: QualityGateCoverageGapReason;
  linkedSections: string[];
}

export interface DocumentQualitySummary {
  documentId: string;
  statusCounts: {
    pass: number;
    warning: number;
    blocker: number;
    neutral: number;
  };
  blockerSections: string[];
  warningSections: string[];
  lastRunAt: string | null;
  triggeredBy: string;
  requestId: string;
  publishBlocked: boolean;
  coverageGaps: DocumentCoverageGap[];
}

type DocumentStatusKey = keyof typeof docQualityMessages.status;

export interface BeginDocumentRunPayload {
  documentId: string;
  requestId: string;
  triggeredBy: string;
  startedAt?: number;
}

export interface FailDocumentRunPayload {
  requestId?: string | null;
  error: Error | { message?: string };
  incidentId?: string | null;
}

export interface DocumentQualityStoreData {
  status: 'idle' | 'running' | 'ready' | 'failed';
  statusMessage: string;
  slaWarningCopy: string | null;
  publishCopy: string | null;
  durationMs: number | null;
  summary: DocumentQualitySummary | null;
  lastRunAt: string | null;
  requestId: string | null;
  triggeredBy: string | null;
  documentId: string | null;
  isPublishBlocked: boolean;
}

export interface DocumentQualityStoreActions {
  hydrateSummary(summary: DocumentQualitySummary): void;
  beginBatchRun(payload: BeginDocumentRunPayload): void;
  tick(now: number): void;
  completeBatchRun(summary: DocumentQualitySummary): void;
  failBatchRun(payload: FailDocumentRunPayload): void;
  reset(): void;
}

interface DocumentQualityStoreInternals {
  _startedAt: number | null;
  _slowNotified: boolean;
  _translator: DocQualityTranslator;
  _slaMs: number;
  _clock: () => number;
}

export type DocumentQualityStoreState = DocumentQualityStoreData &
  DocumentQualityStoreActions &
  DocumentQualityStoreInternals;

export type DocumentQualityStore = StoreApi<DocumentQualityStoreState>;

export interface DocumentQualityStoreOptions {
  translator?: DocQualityTranslator;
  clock?: () => number;
  slaMs?: number;
}

const deriveStatusKey = (summary: DocumentQualitySummary | null): DocumentStatusKey => {
  if (!summary) {
    return 'idle';
  }

  if (summary.publishBlocked || summary.statusCounts.blocker > 0) {
    return 'blocker';
  }

  if (
    summary.statusCounts.warning > 0 ||
    summary.coverageGaps.some(gap => gap.reason === 'warning-override')
  ) {
    return 'warning';
  }

  return 'documentUpdated';
};

const resolvePublishCopy = (
  summary: DocumentQualitySummary | null,
  translator: DocQualityTranslator
): string | null => {
  if (!summary) {
    return null;
  }

  if (summary.publishBlocked) {
    const incidentCount = Math.max(summary.statusCounts.blocker, summary.coverageGaps.length);
    return translator.helper('blocked', { count: incidentCount });
  }

  return translator.helper('ready');
};

const resolveDuration = (startedAt: number | null, now: number): number => {
  if (startedAt == null) {
    return 0;
  }
  return Math.max(0, now - startedAt);
};

const createInitialState = (translator: DocQualityTranslator): DocumentQualityStoreData => ({
  status: 'idle',
  statusMessage: translator.status('idle'),
  slaWarningCopy: null,
  publishCopy: null,
  durationMs: null,
  summary: null,
  lastRunAt: null,
  requestId: null,
  triggeredBy: null,
  documentId: null,
  isPublishBlocked: false,
});

const createDocumentQualityStoreState =
  (options: DocumentQualityStoreOptions = {}) =>
  (
    set: DocumentQualityStore['setState'],
    get: DocumentQualityStore['getState']
  ): DocumentQualityStoreState => {
    const translator = options.translator ?? createDocQualityTranslator();
    const clock = options.clock ?? (() => Date.now());
    const slaMs = options.slaMs ?? DEFAULT_DOCUMENT_SLA_MS;

    return {
      ...createInitialState(translator),
      _startedAt: null,
      _slowNotified: false,
      _translator: translator,
      _clock: clock,
      _slaMs: slaMs,
      hydrateSummary(summary) {
        const statusKey = deriveStatusKey(summary);
        set(state => ({
          status: statusKey === 'idle' ? 'idle' : ('ready' as const),
          statusMessage: translator.status(statusKey),
          slaWarningCopy: null,
          publishCopy: resolvePublishCopy(summary, translator),
          durationMs: summary ? state.durationMs : null,
          summary,
          lastRunAt: summary?.lastRunAt ?? null,
          requestId: summary?.requestId ?? null,
          triggeredBy: summary?.triggeredBy ?? null,
          documentId: summary?.documentId ?? null,
          isPublishBlocked: summary?.publishBlocked ?? false,
          _startedAt: null,
          _slowNotified: false,
        }));
      },
      beginBatchRun(payload: BeginDocumentRunPayload) {
        const startedAt = payload.startedAt ?? clock();
        set(state => ({
          status: 'running' as const,
          statusMessage: translator.status('validating'),
          slaWarningCopy: null,
          publishCopy: state.publishCopy,
          durationMs: 0,
          requestId: payload.requestId,
          triggeredBy: payload.triggeredBy,
          documentId: payload.documentId,
          _startedAt: startedAt,
          _slowNotified: false,
        }));
      },
      tick(now: number) {
        const { status, _startedAt, _slowNotified } = get();
        if (status !== 'running' || _startedAt == null) {
          return;
        }
        const elapsed = resolveDuration(_startedAt, now);
        const exceededSla = !_slowNotified && elapsed >= slaMs;
        set(state => ({
          durationMs: elapsed,
          statusMessage: exceededSla ? translator.status('slow') : state.statusMessage,
          slaWarningCopy: exceededSla ? translator.status('slow') : state.slaWarningCopy,
          _slowNotified: exceededSla || state._slowNotified,
        }));
      },
      completeBatchRun(summary: DocumentQualitySummary) {
        const now = clock();
        const elapsed = resolveDuration(get()._startedAt, now);
        const statusKey = deriveStatusKey(summary);
        set(() => ({
          status: statusKey === 'idle' ? ('idle' as const) : ('ready' as const),
          statusMessage: translator.status(statusKey),
          slaWarningCopy: null,
          publishCopy: resolvePublishCopy(summary, translator),
          durationMs: elapsed,
          summary,
          lastRunAt: summary.lastRunAt,
          requestId: summary.requestId,
          triggeredBy: summary.triggeredBy,
          documentId: summary.documentId,
          isPublishBlocked: summary.publishBlocked,
          _startedAt: null,
          _slowNotified: false,
        }));
      },
      failBatchRun(payload: FailDocumentRunPayload) {
        const now = clock();
        const elapsed = resolveDuration(get()._startedAt, now);
        set(state => ({
          status: 'failed' as const,
          statusMessage: translator.status('failed'),
          slaWarningCopy: translator.helper('genericFailure'),
          publishCopy: state.publishCopy,
          durationMs: elapsed,
          requestId: payload.requestId ?? state.requestId,
          _startedAt: null,
          _slowNotified: false,
          summary: state.summary,
          lastRunAt: state.lastRunAt,
          triggeredBy: state.triggeredBy,
          documentId: state.documentId,
          isPublishBlocked: true,
        }));
      },
      reset() {
        set(() => ({
          ...createInitialState(translator),
          _startedAt: null,
          _slowNotified: false,
        }));
      },
    };
  };

export const createDocumentQualityStore = (
  options: DocumentQualityStoreOptions = {}
): DocumentQualityStore => {
  const initializer = createDocumentQualityStoreState(options);
  return createStore<DocumentQualityStoreState>((set, get) => initializer(set, get));
};

const defaultDocumentQualityStore = createDocumentQualityStore();

export const useDocumentQualityStore = <T>(
  selector: (state: DocumentQualityStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean
) => useStoreWithEqualityFn(defaultDocumentQualityStore, selector, equalityFn);

export const DOCUMENT_VALIDATION_SLA_MS = DEFAULT_DOCUMENT_SLA_MS;

export const documentQualityStore = defaultDocumentQualityStore;
