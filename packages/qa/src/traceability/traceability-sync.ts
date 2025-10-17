import type { QualityGateStatus } from '@ctrl-freaq/shared-data/models/quality-gates/status';
import type {
  TraceabilityLink,
  TraceabilityCoverageStatus,
  TraceabilitySyncRepository as SharedTraceabilitySyncRepository,
} from '@ctrl-freaq/shared-data';

import {
  getRequirementMetadata,
  getRequirementsForSection,
  type RequirementMetadata,
} from './requirement-catalog.js';

export type TraceabilitySyncRepositoryLike = Pick<
  SharedTraceabilitySyncRepository,
  'upsertLink' | 'listByDocumentId' | 'markRequirementOrphaned'
>;

export interface SectionTraceabilitySyncInput {
  documentId: string;
  sectionId: string;
  runId: string;
  revisionId?: string | null;
  status: QualityGateStatus;
  triggeredBy: string;
  source: 'auto' | 'manual' | 'dashboard';
  completedAt: Date;
}

export interface TraceabilityMatrixEntry {
  requirementId: string;
  sectionId: string;
  title: string;
  preview: string;
  gateStatus: QualityGateStatus;
  coverageStatus: TraceabilityCoverageStatus;
  lastValidatedAt: string | null;
  validatedBy: string | null;
  notes: string[];
  revisionId: string;
  auditTrail: TraceabilityLink['auditTrail'];
}

export interface OrphanRequirementInput {
  documentId: string;
  requirementId: string;
  sectionId: string;
  reason: 'no-link' | 'blocker' | 'warning-override';
  actorId: string;
}

export interface TraceabilitySyncServiceDependencies {
  repository: TraceabilitySyncRepositoryLike;
  getSectionPreview?(sectionId: string): Promise<string> | string;
  clock?: () => Date;
}

export interface TraceabilitySyncService {
  syncSectionRun(input: SectionTraceabilitySyncInput): Promise<void>;
  listDocumentTraceability(documentId: string): Promise<TraceabilityMatrixEntry[]>;
  markRequirementOrphaned(input: OrphanRequirementInput): Promise<TraceabilityLink>;
}

const COVERAGE_STATUS_BY_GATE_STATUS: Record<QualityGateStatus, TraceabilityCoverageStatus> = {
  Pass: 'covered',
  Warning: 'warning',
  Blocker: 'blocker',
  Neutral: 'orphaned',
};

const DEFAULT_PREVIEW = 'No preview available for this requirement.';

const generateEventId = (): string => {
  const globalCrypto = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  const randomSegment = () => Math.random().toString(36).slice(2, 10);
  return `trace-${Date.now().toString(36)}-${randomSegment()}`;
};

function resolvePreview(
  metadata: RequirementMetadata | null,
  sectionId: string,
  previewProvider?: TraceabilitySyncServiceDependencies['getSectionPreview']
): Promise<string> | string {
  if (previewProvider) {
    const resolved = previewProvider(sectionId);
    if (resolved instanceof Promise) {
      return resolved.then(value => value || metadata?.preview || DEFAULT_PREVIEW);
    }
    if (resolved) {
      return resolved;
    }
  }
  return metadata?.preview ?? DEFAULT_PREVIEW;
}

export function createTraceabilitySyncService(
  dependencies: TraceabilitySyncServiceDependencies
): TraceabilitySyncService {
  const clock = dependencies.clock ?? (() => new Date());
  const resolveRevisionId = (input: SectionTraceabilitySyncInput): string => {
    if (input.revisionId && input.revisionId.trim().length > 0) {
      return input.revisionId;
    }
    return `rev-${input.sectionId}-${input.completedAt.getTime()}`;
  };

  return {
    async syncSectionRun(input) {
      const requirements = getRequirementsForSection(input.sectionId);
      if (requirements.length === 0) {
        return;
      }

      const coverageStatus =
        COVERAGE_STATUS_BY_GATE_STATUS[input.status] ?? COVERAGE_STATUS_BY_GATE_STATUS.Pass;

      for (const requirement of requirements) {
        await dependencies.repository.upsertLink({
          requirementId: requirement.requirementId,
          sectionId: input.sectionId,
          documentId: input.documentId,
          revisionId: resolveRevisionId(input),
          gateStatus: input.status,
          coverageStatus,
          validatedBy: input.triggeredBy,
          validatedAt: input.completedAt,
          notes: [],
          auditEvent: {
            eventId: generateEventId(),
            type: 'link-updated',
            timestamp: input.completedAt,
            actorId: input.triggeredBy,
            details: {
              runId: input.runId,
              source: input.source,
              sectionId: input.sectionId,
            },
          },
        });
      }
    },

    async listDocumentTraceability(documentId) {
      const links = await dependencies.repository.listByDocumentId(documentId);

      const entries: TraceabilityMatrixEntry[] = [];

      for (const link of links) {
        const metadata = getRequirementMetadata(link.requirementId);
        const preview = await resolvePreview(
          metadata,
          link.sectionId,
          dependencies.getSectionPreview
        );

        entries.push({
          requirementId: link.requirementId,
          sectionId: link.sectionId,
          title: metadata?.title ?? link.requirementId,
          preview,
          gateStatus: link.gateStatus,
          coverageStatus: link.coverageStatus,
          lastValidatedAt: link.lastValidatedAt?.toISOString() ?? null,
          validatedBy: link.validatedBy ?? null,
          notes: link.notes ?? [],
          revisionId: link.revisionId,
          auditTrail: link.auditTrail,
        });
      }

      return entries;
    },

    async markRequirementOrphaned(input) {
      return dependencies.repository.markRequirementOrphaned({
        requirementId: input.requirementId,
        sectionId: input.sectionId,
        reason: input.reason,
        actorId: input.actorId,
        timestamp: clock(),
      });
    },
  };
}
