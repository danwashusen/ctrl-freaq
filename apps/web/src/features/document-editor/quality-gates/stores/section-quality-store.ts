import { createStore } from 'zustand/vanilla';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import type { StoreApi } from 'zustand';

import type { QualityGateStatus } from '@ctrl-freaq/editor-core/quality-gates/status';

import {
  createDocQualityTranslator,
  docQualityMessages,
  type DocQualityTranslator,
} from '@/lib/i18n';

const DEFAULT_SLA_MS = 2000;

export type QualityGateRunSource = 'auto' | 'manual' | 'dashboard';
export type RemediationState = 'pending' | 'in-progress' | 'resolved';

export interface SectionQualityRule {
  ruleId: string;
  title: string;
  severity: QualityGateStatus;
  guidance: string[];
  docLink?: string | null;
  location?: {
    path: string;
    start: number;
    end: number;
  };
}

export interface RemediationCard {
  ruleId: string;
  summary: string;
  severity: QualityGateStatus;
  steps: string[];
  docLink: { label: string; href: string } | null;
  location?: SectionQualityRule['location'];
}

export interface SectionQualitySnapshot {
  sectionId: string;
  documentId: string;
  runId: string;
  status: QualityGateStatus;
  rules: SectionQualityRule[];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  triggeredBy: string;
  source: QualityGateRunSource;
  durationMs: number;
  remediationState: RemediationState;
  incidentId?: string | null;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeginValidationPayload {
  requestId: string;
  triggeredBy: string;
  runId?: string | null;
  startedAt?: number;
  source?: QualityGateRunSource;
}

export interface CompleteValidationPayload {
  runId: string;
  status: QualityGateStatus;
  durationMs: number;
  rules: SectionQualityRule[];
  triggeredBy?: string | null;
  requestId?: string | null;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  remediationState?: RemediationState;
  incidentId?: string | null;
}

export interface FailValidationPayload {
  incidentId: string | null;
  error: Error | { message?: string };
  requestId?: string | null;
  runId?: string | null;
  durationMs?: number | null;
}

export interface SectionQualityStoreData {
  status: 'idle' | 'validating' | 'completed' | 'failed';
  statusMessage: string;
  timeoutCopy: string | null;
  durationMs: number | null;
  requestId: string | null;
  runId: string | null;
  triggeredBy: string | null;
  incidentId: string | null;
  lastStatus: QualityGateStatus | null;
  isSubmissionBlocked: boolean;
  blockerCount: number;
  warningCount: number;
  rules: SectionQualityRule[];
  remediation: RemediationCard[];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
}

export interface SectionQualityStoreActions {
  beginValidation(payload: BeginValidationPayload): void;
  tick(now: number): void;
  completeValidation(payload: CompleteValidationPayload): void;
  failValidation(payload: FailValidationPayload): void;
  hydrateFromResult(snapshot: SectionQualitySnapshot): void;
  reset(): void;
}

interface SectionQualityStoreInternals {
  _startedAt: number | null;
  _slowNotified: boolean;
  _source: QualityGateRunSource | null;
}

export type SectionQualityStoreState = SectionQualityStoreData &
  SectionQualityStoreActions &
  SectionQualityStoreInternals;

export type SectionQualityStore = StoreApi<SectionQualityStoreState>;

export interface SectionQualityStoreOptions {
  clock?: () => number;
  slaMs?: number;
  translator?: DocQualityTranslator;
}

const resolveErrorMessage = (error: FailValidationPayload['error']): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  return 'Validation failed';
};

const toRemediationCard = (
  rule: SectionQualityRule,
  translator: DocQualityTranslator
): RemediationCard => ({
  ruleId: rule.ruleId,
  summary: rule.title,
  severity: rule.severity,
  steps: [...rule.guidance],
  docLink: rule.docLink ? { label: translator.links('policy'), href: rule.docLink } : null,
  location: rule.location,
});

type StatusMessageKey = keyof (typeof docQualityMessages)['status'];

const mapStatusToMessageKey = (status: QualityGateStatus): StatusMessageKey => {
  switch (status) {
    case 'Pass':
      return 'passed';
    case 'Warning':
      return 'warning';
    case 'Blocker':
      return 'blocker';
    default:
      return 'idle';
  }
};

const createInitialData = (
  translator: DocQualityTranslator
): SectionQualityStoreData & SectionQualityStoreInternals => ({
  status: 'idle',
  statusMessage: translator.status('idle'),
  timeoutCopy: null,
  durationMs: null,
  requestId: null,
  runId: null,
  triggeredBy: null,
  incidentId: null,
  lastStatus: null,
  isSubmissionBlocked: false,
  blockerCount: 0,
  warningCount: 0,
  rules: [],
  remediation: [],
  lastRunAt: null,
  lastSuccessAt: null,
  _startedAt: null,
  _slowNotified: false,
  _source: null,
});

const createElapsedCalculator =
  (clock: () => number) =>
  (startedAt: number | null, explicitDuration?: number | null): number | null => {
    if (typeof explicitDuration === 'number' && explicitDuration >= 0) {
      return explicitDuration;
    }
    if (startedAt == null) {
      return null;
    }
    return Math.max(0, clock() - startedAt);
  };

const createSectionQualityStoreState = (options: SectionQualityStoreOptions) => {
  const clock = options.clock ?? (() => Date.now());
  const slaMs = options.slaMs ?? DEFAULT_SLA_MS;
  const translator = options.translator ?? createDocQualityTranslator();
  const elapsed = createElapsedCalculator(clock);
  const initialData = createInitialData(translator);

  return (set: SectionQualityStore['setState'], get: SectionQualityStore['getState']) => ({
    ...initialData,
    beginValidation: (payload: BeginValidationPayload) => {
      const startedAt = typeof payload.startedAt === 'number' ? payload.startedAt : clock();
      set(() => ({
        status: 'validating' as const,
        statusMessage: translator.status('validating'),
        timeoutCopy: null,
        durationMs: 0,
        requestId: payload.requestId,
        runId: payload.runId ?? null,
        triggeredBy: payload.triggeredBy,
        incidentId: null,
        rules: [],
        remediation: [],
        blockerCount: 0,
        warningCount: 0,
        _startedAt: startedAt,
        _slowNotified: false,
        _source: payload.source ?? null,
      }));
    },
    tick: (now: number) => {
      const state = get();
      if (state._startedAt == null || state.status !== 'validating') {
        return;
      }

      const durationMs = Math.max(0, now - state._startedAt);
      const shouldAnnounceSlow = !state._slowNotified && durationMs >= slaMs;

      set(() => ({
        durationMs,
        statusMessage: shouldAnnounceSlow ? translator.status('slow') : state.statusMessage,
        _slowNotified: state._slowNotified || shouldAnnounceSlow,
      }));
    },
    completeValidation: (payload: CompleteValidationPayload) => {
      const blockerCount = payload.rules.filter(rule => rule.severity === 'Blocker').length;
      const warningCount = payload.rules.filter(rule => rule.severity === 'Warning').length;
      const statusKey = mapStatusToMessageKey(payload.status);
      const durationMs = Number.isFinite(payload.durationMs)
        ? payload.durationMs
        : (elapsed(get()._startedAt) ?? 0);

      set(state => ({
        status: payload.status === 'Neutral' ? ('idle' as const) : ('completed' as const),
        statusMessage:
          payload.status === 'Neutral' ? translator.status('idle') : translator.status(statusKey),
        timeoutCopy: null,
        durationMs,
        requestId: payload.requestId ?? state.requestId,
        runId: payload.runId,
        triggeredBy: payload.triggeredBy ?? state.triggeredBy,
        incidentId: payload.incidentId ?? null,
        lastStatus: payload.status,
        isSubmissionBlocked: payload.status === 'Blocker',
        blockerCount,
        warningCount,
        rules: payload.rules,
        remediation: payload.rules.map(rule => toRemediationCard(rule, translator)),
        lastRunAt: payload.lastRunAt ?? state.lastRunAt,
        lastSuccessAt: payload.lastSuccessAt ?? state.lastSuccessAt,
        _startedAt: null,
        _slowNotified: false,
        _source: state._source,
      }));
    },
    failValidation: (payload: FailValidationPayload) => {
      const durationMs = payload.durationMs ?? elapsed(get()._startedAt) ?? 0;
      const errorMessage = resolveErrorMessage(payload.error);
      const incidentCopy = payload.incidentId
        ? translator.helper('incident', { incidentId: payload.incidentId })
        : translator.helper('genericFailure');

      set(state => ({
        status: 'failed' as const,
        statusMessage: translator.status('failed'),
        timeoutCopy: `${incidentCopy} ${errorMessage}`.trim(),
        durationMs,
        requestId: payload.requestId ?? state.requestId,
        runId: payload.runId ?? state.runId,
        incidentId: payload.incidentId,
        isSubmissionBlocked: true,
        _startedAt: null,
        _slowNotified: false,
      }));
    },
    hydrateFromResult: (snapshot: SectionQualitySnapshot) => {
      const blockerCount = snapshot.rules.filter(rule => rule.severity === 'Blocker').length;
      const warningCount = snapshot.rules.filter(rule => rule.severity === 'Warning').length;
      const messageKey = mapStatusToMessageKey(snapshot.status);
      const status = snapshot.status === 'Neutral' ? ('idle' as const) : ('completed' as const);

      set(() => ({
        status,
        statusMessage:
          snapshot.status === 'Neutral' ? translator.status('idle') : translator.status(messageKey),
        timeoutCopy: null,
        durationMs: snapshot.durationMs,
        requestId: snapshot.requestId ?? null,
        runId: snapshot.runId,
        triggeredBy: snapshot.triggeredBy,
        incidentId: snapshot.incidentId ?? null,
        lastStatus: snapshot.status,
        isSubmissionBlocked: snapshot.status === 'Blocker',
        blockerCount,
        warningCount,
        rules: snapshot.rules,
        remediation: snapshot.rules.map(rule => toRemediationCard(rule, translator)),
        lastRunAt: snapshot.lastRunAt,
        lastSuccessAt: snapshot.lastSuccessAt,
        _startedAt: null,
        _slowNotified: false,
        _source: snapshot.source,
      }));
    },
    reset: () => {
      set(() => ({
        ...createInitialData(translator),
      }));
    },
  });
};

export const createSectionQualityStore = (
  options: SectionQualityStoreOptions = {}
): SectionQualityStore => {
  const initializer = createSectionQualityStoreState(options);
  return createStore<SectionQualityStoreState>((set, get) => initializer(set, get));
};

const defaultSectionQualityStore = createSectionQualityStore();

export const useSectionQualityStore = <T>(
  selector: (state: SectionQualityStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean
) => useStoreWithEqualityFn(defaultSectionQualityStore, selector, equalityFn);

export const SECTION_VALIDATION_SLA_MS = DEFAULT_SLA_MS;

export const sectionQualityStore = defaultSectionQualityStore;
