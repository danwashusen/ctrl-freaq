import Database from 'better-sqlite3';

import { BaseRepository } from '../base-repository.js';
import {
  CreateTraceabilityLinkSchema,
  TraceabilityLinkSchema,
  type CreateTraceabilityLinkInput,
  type TraceabilityLink,
  type UpdateTraceabilityLinkInput,
} from '../../models/traceability/traceability-link.js';
import {
  TraceabilityAuditEventSchema,
  type TraceabilityAuditEvent,
} from '../../models/traceability/traceability-audit-event.js';

const TABLE_NAME = 'traceability_links';

interface CoverageUpdateInput {
  gateStatus?: UpdateTraceabilityLinkInput['gateStatus'];
  coverageStatus?: UpdateTraceabilityLinkInput['coverageStatus'];
  lastValidatedAt?: UpdateTraceabilityLinkInput['lastValidatedAt'];
  validatedBy?: UpdateTraceabilityLinkInput['validatedBy'];
  notes?: UpdateTraceabilityLinkInput['notes'];
  auditEvent?: TraceabilityAuditEvent;
}

export class TraceabilityRepository extends BaseRepository<TraceabilityLink> {
  constructor(db: Database.Database) {
    super(db, TABLE_NAME, TraceabilityLinkSchema);
  }

  protected override mapEntityToRow(entity: TraceabilityLink): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    row.notes = JSON.stringify(entity.notes ?? []);
    row.audit_trail = JSON.stringify(entity.auditTrail ?? []);
    return row;
  }

  protected override mapRowToEntity(row: Record<string, unknown>): TraceabilityLink {
    const toCamelCase = (str: string) =>
      str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const mappedEntries = Object.entries(row).map(([key, value]) => {
      const camelKey = toCamelCase(key);
      if (typeof value === 'string' && key.endsWith('_at')) {
        return [camelKey, new Date(value)];
      }
      return [camelKey, value];
    });

    const mapped = Object.fromEntries(mappedEntries) as Record<string, unknown>;

    const notesRaw = mapped.notes;
    const notes =
      Array.isArray(notesRaw) && notesRaw.every(item => typeof item === 'string')
        ? (notesRaw as string[])
        : typeof notesRaw === 'string' && notesRaw.length > 0
          ? (JSON.parse(notesRaw) as string[])
          : [];

    const auditTrailRaw =
      Array.isArray(mapped.auditTrail) && mapped.auditTrail.length
        ? (mapped.auditTrail as Array<Record<string, unknown>>)
        : typeof mapped.auditTrail === 'string' && mapped.auditTrail.length
          ? (JSON.parse(mapped.auditTrail) as Array<Record<string, unknown>>)
          : typeof mapped.audit_trail === 'string' && mapped.audit_trail.length
            ? (JSON.parse(mapped.audit_trail as string) as Array<Record<string, unknown>>)
            : [];

    const auditTrail = auditTrailRaw.map(event =>
      TraceabilityAuditEventSchema.parse({
        eventId: String(event.eventId),
        type: event.type,
        timestamp:
          event.timestamp instanceof Date ? event.timestamp : new Date(String(event.timestamp)),
        actorId: String(event.actorId),
        details:
          event.details && typeof event.details === 'object'
            ? Object.fromEntries(
                Object.entries(event.details as Record<string, unknown>).map(([key, value]) => [
                  key,
                  typeof value === 'string' ? value : String(value),
                ])
              )
            : {},
      })
    );

    return {
      id: String(mapped.id),
      requirementId: String(mapped.requirementId),
      sectionId: String(mapped.sectionId),
      documentId: String(mapped.documentId),
      revisionId: String(mapped.revisionId),
      gateStatus: mapped.gateStatus as TraceabilityLink['gateStatus'],
      coverageStatus: mapped.coverageStatus as TraceabilityLink['coverageStatus'],
      lastValidatedAt:
        mapped.lastValidatedAt instanceof Date
          ? mapped.lastValidatedAt
          : new Date(String(mapped.lastValidatedAt)),
      validatedBy: String(mapped.validatedBy),
      notes,
      auditTrail,
      createdAt:
        mapped.createdAt instanceof Date ? mapped.createdAt : new Date(String(mapped.createdAt)),
      updatedAt:
        mapped.updatedAt instanceof Date ? mapped.updatedAt : new Date(String(mapped.updatedAt)),
    };
  }

  async findByRequirement(
    requirementId: string,
    sectionId: string
  ): Promise<TraceabilityLink | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${TABLE_NAME} WHERE requirement_id = ? AND section_id = ?`
    );
    const row = stmt.get(requirementId, sectionId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async listByDocumentId(documentId: string): Promise<TraceabilityLink[]> {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE document_id = ?`);
    const rows = stmt.all(documentId) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async upsertLink(payload: CreateTraceabilityLinkInput): Promise<TraceabilityLink> {
    const sanitized = CreateTraceabilityLinkSchema.parse(payload);
    const existing = await this.findByRequirement(sanitized.requirementId, sanitized.sectionId);
    if (existing) {
      const auditTrail = sanitized.auditTrail?.length
        ? [...existing.auditTrail, ...sanitized.auditTrail]
        : existing.auditTrail;
      return this.update(existing.id, {
        ...sanitized,
        auditTrail,
      });
    }
    return this.create(sanitized);
  }

  async appendAuditEvent(
    requirementId: string,
    sectionId: string,
    event: TraceabilityAuditEvent
  ): Promise<TraceabilityLink> {
    const existing = await this.findByRequirement(requirementId, sectionId);
    if (!existing) {
      throw new Error(
        `Traceability link not found for requirement ${requirementId} and section ${sectionId}`
      );
    }

    return this.update(existing.id, {
      auditTrail: [...existing.auditTrail, event],
    });
  }

  async updateCoverageState(
    requirementId: string,
    sectionId: string,
    updates: CoverageUpdateInput
  ): Promise<TraceabilityLink> {
    const existing = await this.findByRequirement(requirementId, sectionId);
    if (!existing) {
      throw new Error(
        `Traceability link not found for requirement ${requirementId} and section ${sectionId}`
      );
    }

    const updatedAuditTrail = updates.auditEvent
      ? [...existing.auditTrail, updates.auditEvent]
      : existing.auditTrail;

    const updatedEntity: TraceabilityLink = {
      ...existing,
      gateStatus: updates.gateStatus ?? existing.gateStatus,
      coverageStatus: updates.coverageStatus ?? existing.coverageStatus,
      lastValidatedAt: updates.lastValidatedAt ?? new Date(),
      validatedBy: updates.validatedBy ?? existing.validatedBy,
      notes: updates.notes ?? existing.notes,
      auditTrail: updatedAuditTrail,
      updatedAt: new Date(),
    };

    const row = this.mapEntityToRow(updatedEntity);
    const entries = Object.entries(row).filter(([column]) => column !== 'id');
    const setClause = entries.map(([column]) => `${column} = ?`).join(', ');
    const stmt = this.db.prepare(`UPDATE ${TABLE_NAME} SET ${setClause} WHERE id = ?`);
    stmt.run(...entries.map(([, value]) => value), row.id);

    return updatedEntity;
  }
}
