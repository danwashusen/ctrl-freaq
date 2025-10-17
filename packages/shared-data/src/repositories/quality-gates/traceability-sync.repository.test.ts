import { randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import type { TraceabilityLink } from '../../models/traceability/traceability-link.js';
import type { TraceabilityAuditEvent } from '../../models/traceability/traceability-audit-event.js';
import {
  TraceabilitySyncRepository,
  type TraceabilitySyncRepositoryDependencies,
  type TraceabilitySyncUpsertInput,
} from './traceability-sync.repository.js';

interface CoverageUpdateInput {
  gateStatus?: TraceabilityLink['gateStatus'];
  coverageStatus?: TraceabilityLink['coverageStatus'];
  lastValidatedAt?: Date;
  validatedBy?: string;
  notes?: string[];
  auditEvent?: TraceabilityAuditEvent;
}

class InMemoryTraceabilityRepository
  implements
    Pick<
      TraceabilitySyncRepositoryDependencies['repository'],
      'upsertLink' | 'listByDocumentId' | 'updateCoverageState'
    >
{
  private links: TraceabilityLink[] = [];

  async upsertLink(
    input: TraceabilitySyncUpsertInput & { auditTrail?: TraceabilityAuditEvent[] }
  ): Promise<TraceabilityLink> {
    const existing = this.links.find(
      link => link.requirementId === input.requirementId && link.sectionId === input.sectionId
    );
    const now = new Date();

    if (existing) {
      existing.gateStatus = input.gateStatus;
      existing.coverageStatus = input.coverageStatus;
      existing.lastValidatedAt = input.validatedAt;
      existing.validatedBy = input.validatedBy;
      existing.notes = input.notes ?? [];
      if (input.auditEvent) {
        existing.auditTrail = [...existing.auditTrail, input.auditEvent];
      } else if (input.auditTrail?.length) {
        existing.auditTrail = [...existing.auditTrail, ...input.auditTrail];
      }
      existing.revisionId = input.revisionId;
      existing.updatedAt = now;
      return existing;
    }

    const link: TraceabilityLink = {
      id: randomUUID(),
      requirementId: input.requirementId,
      sectionId: input.sectionId,
      documentId: input.documentId,
      revisionId: input.revisionId,
      gateStatus: input.gateStatus,
      coverageStatus: input.coverageStatus,
      lastValidatedAt: input.validatedAt,
      validatedBy: input.validatedBy,
      notes: input.notes ?? [],
      auditTrail: input.auditTrail ?? (input.auditEvent ? [input.auditEvent] : []),
      createdAt: now,
      updatedAt: now,
    };

    this.links.push(link);
    return link;
  }

  async listByDocumentId(documentId: string): Promise<TraceabilityLink[]> {
    return this.links.filter(link => link.documentId === documentId);
  }

  async updateCoverageState(
    requirementId: string,
    sectionId: string,
    updates: CoverageUpdateInput
  ): Promise<TraceabilityLink> {
    const existing = this.links.find(
      link => link.requirementId === requirementId && link.sectionId === sectionId
    );

    if (!existing) {
      throw new Error('Traceability link not found');
    }

    existing.gateStatus = updates.gateStatus ?? existing.gateStatus;
    existing.coverageStatus = updates.coverageStatus ?? existing.coverageStatus;
    existing.lastValidatedAt = updates.lastValidatedAt ?? existing.lastValidatedAt;
    existing.validatedBy = updates.validatedBy ?? existing.validatedBy;
    existing.notes = updates.notes ?? existing.notes;
    if (updates.auditEvent) {
      existing.auditTrail = [...existing.auditTrail, updates.auditEvent];
    }
    existing.updatedAt = new Date();

    return existing;
  }
}

describe('TraceabilitySyncRepository', () => {
  let repository: TraceabilitySyncRepository;
  let backing: InMemoryTraceabilityRepository;

  beforeEach(() => {
    backing = new InMemoryTraceabilityRepository();
    repository = new TraceabilitySyncRepository({
      repository: backing as unknown as TraceabilitySyncRepositoryDependencies['repository'],
    });
  });

  const baseInput: TraceabilitySyncUpsertInput = {
    requirementId: 'req-governance-escalation',
    sectionId: 'sec-overview',
    documentId: 'demo-architecture',
    revisionId: 'rev-001',
    gateStatus: 'Warning',
    coverageStatus: 'warning',
    validatedBy: 'user-nova',
    validatedAt: new Date('2025-10-13T10:15:00.000Z'),
    notes: ['Escalation policy missing mitigation summary.'],
    auditEvent: {
      eventId: 'evt-initial',
      type: 'link-created',
      timestamp: new Date('2025-10-13T10:15:00.000Z'),
      actorId: 'user-nova',
      details: { reason: 'initial-sync' },
    },
  };

  it('creates a new traceability link with normalized payload', async () => {
    const created = await repository.upsertLink(baseInput);

    expect(created.requirementId).toBe(baseInput.requirementId);
    expect(created.sectionId).toBe(baseInput.sectionId);
    expect(created.gateStatus).toBe('Warning');
    expect(created.auditTrail).toHaveLength(1);
    expect(created.auditTrail[0]?.type).toBe('link-created');
  });

  it('updates an existing link and appends audit history', async () => {
    await repository.upsertLink(baseInput);

    const updated = await repository.upsertLink({
      ...baseInput,
      revisionId: 'rev-002',
      gateStatus: 'Pass',
      coverageStatus: 'covered',
      validatedAt: new Date('2025-10-13T11:45:00.000Z'),
      auditEvent: {
        eventId: 'evt-update',
        type: 'link-updated',
        timestamp: new Date('2025-10-13T11:45:00.000Z'),
        actorId: 'user-morgan',
        details: { runId: 'run-002' },
      },
    });

    expect(updated.gateStatus).toBe('Pass');
    expect(updated.coverageStatus).toBe('covered');
    expect(updated.auditTrail).toHaveLength(2);
    expect(updated.auditTrail.at(-1)?.type).toBe('link-updated');
  });

  it('marks a requirement as orphaned and records an audit event', async () => {
    await repository.upsertLink(baseInput);

    const orphaned = await repository.markRequirementOrphaned({
      requirementId: baseInput.requirementId,
      sectionId: baseInput.sectionId,
      reason: 'no-link',
      actorId: 'user-qa',
      timestamp: new Date('2025-10-14T08:30:00.000Z'),
    });

    expect(orphaned.coverageStatus).toBe('orphaned');
    expect(orphaned.auditTrail.at(-1)?.type).toBe('link-orphaned');
    expect(orphaned.validatedBy).toBe('user-qa');
  });
});
