import { randomUUID } from 'node:crypto';

import type { TraceabilityAuditEvent } from '../../models/traceability/traceability-audit-event.js';
import type {
  TraceabilityCoverageStatus,
  TraceabilityGateStatus,
  TraceabilityLink,
} from '../../models/traceability/traceability-link.js';
import { TraceabilityRepository } from '../../repositories/traceability/traceability.repository.js';

export interface TraceabilitySyncUpsertInput {
  requirementId: string;
  sectionId: string;
  documentId: string;
  revisionId: string;
  gateStatus: TraceabilityGateStatus;
  coverageStatus: TraceabilityCoverageStatus;
  validatedBy: string;
  validatedAt: Date;
  notes?: string[] | null;
  auditEvent?: TraceabilityAuditEvent | null;
}

export interface MarkRequirementOrphanedInput {
  requirementId: string;
  sectionId: string;
  reason: 'no-link' | 'blocker' | 'warning-override';
  actorId: string;
  timestamp: Date;
}

export interface TraceabilitySyncRepositoryDependencies {
  repository: TraceabilityRepository;
  clock?: () => Date;
}

export class TraceabilitySyncRepository {
  constructor(private readonly dependencies: TraceabilitySyncRepositoryDependencies) {}

  private now(): Date {
    return this.dependencies.clock ? this.dependencies.clock() : new Date();
  }

  async upsertLink(input: TraceabilitySyncUpsertInput): Promise<TraceabilityLink> {
    const auditTrail: TraceabilityAuditEvent[] = [];
    if (input.auditEvent) {
      auditTrail.push({
        ...input.auditEvent,
        timestamp: input.auditEvent.timestamp ?? input.validatedAt,
      });
    }

    return this.dependencies.repository.upsertLink({
      requirementId: input.requirementId,
      sectionId: input.sectionId,
      documentId: input.documentId,
      revisionId: input.revisionId,
      gateStatus: input.gateStatus,
      coverageStatus: input.coverageStatus,
      lastValidatedAt: input.validatedAt,
      validatedBy: input.validatedBy,
      notes: input.notes ?? [],
      auditTrail,
    });
  }

  async markRequirementOrphaned(input: MarkRequirementOrphanedInput): Promise<TraceabilityLink> {
    const timestamp = input.timestamp ?? this.now();
    return this.dependencies.repository.updateCoverageState(input.requirementId, input.sectionId, {
      gateStatus: 'Blocker',
      coverageStatus: 'orphaned',
      lastValidatedAt: timestamp,
      validatedBy: input.actorId,
      auditEvent: {
        eventId: randomUUID(),
        type: 'link-orphaned',
        timestamp,
        actorId: input.actorId,
        details: { reason: input.reason },
      },
    });
  }

  async listByDocumentId(documentId: string): Promise<TraceabilityLink[]> {
    return this.dependencies.repository.listByDocumentId(documentId);
  }
}
