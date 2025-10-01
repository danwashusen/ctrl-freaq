import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from './base-repository.js';
import type { QueryOptions } from '../types/index.js';

/**
 * PatchDiff entity schema
 * Represents a single diff operation in Git-style patches
 */
export const PatchDiffSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string().min(1, 'Path is required'),
  value: z.string().optional(),
  oldValue: z.string().optional(),
});

export type PatchDiff = z.infer<typeof PatchDiffSchema>;

/**
 * PendingChange entity schema
 * Tracks unsaved changes as Git-style patches per section
 */
export const PendingChangeSchema = z.object({
  id: z.string().uuid('Invalid pending change ID format'),
  sectionId: z.string().uuid('Invalid section ID format'),
  documentId: z.string().uuid('Invalid document ID format'),

  // Patch data
  patches: z.array(PatchDiffSchema).min(1, 'At least one patch is required'),
  originalContent: z.string(),
  previewContent: z.string(),

  // Metadata
  createdAt: z.date(),
  createdBy: z.string().min(1, 'Created by is required'),
  sessionId: z.string().min(1, 'Session ID is required'),

  // State
  status: z.enum(['pending', 'applying', 'applied', 'failed']),
  conflictsWith: z.array(z.string().uuid()),

  // Base entity fields
  updatedAt: z.date(),
});

export type PendingChange = z.infer<typeof PendingChangeSchema>;

/**
 * Input schema for creating a pending change
 */
export const CreatePendingChangeSchema = PendingChangeSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreatePendingChangeInput = z.infer<typeof CreatePendingChangeSchema>;

/**
 * Query options for pending change-specific queries
 */
export interface PendingChangeQueryOptions extends QueryOptions {
  sectionId?: string;
  documentId?: string;
  sessionId?: string;
  status?: PendingChange['status'];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Pending change repository interface
 */
export interface PendingChangeRepository {
  findById(id: string): Promise<PendingChange | null>;
  findAll(options?: PendingChangeQueryOptions): Promise<PendingChange[]>;
  create(change: CreatePendingChangeInput): Promise<PendingChange>;
  update(id: string, updates: Partial<PendingChange>): Promise<PendingChange>;
  delete(id: string, deletedBy: string): Promise<boolean>;

  // Section-specific queries
  findBySectionId(sectionId: string, options?: QueryOptions): Promise<PendingChange[]>;
  findBySessionId(sessionId: string, options?: QueryOptions): Promise<PendingChange[]>;
  findByDocumentId(documentId: string, options?: QueryOptions): Promise<PendingChange[]>;

  // Status management
  updateStatus(id: string, status: PendingChange['status']): Promise<PendingChange>;
  markAsApplied(id: string): Promise<PendingChange>;
  markAsFailed(id: string, error?: string): Promise<PendingChange>;

  // Conflict detection
  findConflicts(sectionId: string, excludeId?: string): Promise<PendingChange[]>;
  markConflicts(changeId: string, conflictingIds: string[]): Promise<void>;

  // Cleanup operations
  clearAppliedChanges(sectionId: string, beforeDate?: Date): Promise<number>;
  clearOldChanges(beforeDate: Date): Promise<number>;
  clearSessionChanges(sessionId: string): Promise<number>;
}

/**
 * Pending change repository implementation
 */
export class PendingChangeRepositoryImpl
  extends BaseRepository<PendingChange>
  implements PendingChangeRepository
{
  constructor(db: Database.Database) {
    super(db, 'pending_changes', PendingChangeSchema);
  }

  /**
   * Find pending changes by section ID
   */
  async findBySectionId(sectionId: string, options: QueryOptions = {}): Promise<PendingChange[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, section_id: sectionId },
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });
  }

  /**
   * Find pending changes by session ID
   */
  async findBySessionId(sessionId: string, options: QueryOptions = {}): Promise<PendingChange[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, session_id: sessionId },
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });
  }

  /**
   * Find pending changes by document ID
   */
  async findByDocumentId(documentId: string, options: QueryOptions = {}): Promise<PendingChange[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, document_id: documentId },
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });
  }

  /**
   * Update pending change status
   */
  async updateStatus(id: string, status: PendingChange['status']): Promise<PendingChange> {
    return this.update(id, { status });
  }

  /**
   * Mark pending change as applied
   */
  async markAsApplied(id: string): Promise<PendingChange> {
    return this.updateStatus(id, 'applied');
  }

  /**
   * Mark pending change as failed
   */
  async markAsFailed(id: string, _error?: string): Promise<PendingChange> {
    // Note: error parameter could be stored in metadata if needed
    return this.updateStatus(id, 'failed');
  }

  /**
   * Find conflicting pending changes for a section
   */
  async findConflicts(sectionId: string, excludeId?: string): Promise<PendingChange[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE section_id = ? AND status IN ('pending', 'applying')`;
    const params: unknown[] = [sectionId];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    query += ' ORDER BY created_at ASC';

    const stmt = this.getStatement(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Mark conflicts between pending changes
   */
  async markConflicts(changeId: string, conflictingIds: string[]): Promise<void> {
    const existing = await this.findById(changeId);
    if (!existing) {
      throw new Error(`Pending change not found: ${changeId}`);
    }

    // Merge existing conflicts with new ones
    const allConflicts = [...new Set([...existing.conflictsWith, ...conflictingIds])];

    await this.update(changeId, {
      conflictsWith: allConflicts,
    });
  }

  /**
   * Clear applied pending changes for a section
   */
  async clearAppliedChanges(sectionId: string, beforeDate?: Date): Promise<number> {
    let query = `DELETE FROM ${this.tableName} WHERE section_id = ? AND status = 'applied'`;
    const params: unknown[] = [sectionId];

    if (beforeDate) {
      query += ' AND created_at < ?';
      params.push(beforeDate.toISOString());
    }

    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);

    return result.changes;
  }

  /**
   * Clear old pending changes across all sections
   */
  async clearOldChanges(beforeDate: Date): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE created_at < ? AND status IN ('applied', 'failed')`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(beforeDate.toISOString());

    return result.changes;
  }

  /**
   * Clear all pending changes for a session
   */
  async clearSessionChanges(sessionId: string): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE session_id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(sessionId);

    return result.changes;
  }

  /**
   * Override to handle JSON serialization of patches and conflicts arrays
   */
  protected override mapEntityToRow(entity: PendingChange): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);

    // Serialize patches as JSON
    if (entity.patches) {
      row.patches = JSON.stringify(entity.patches);
    }

    // Serialize conflicts array as JSON
    if (entity.conflictsWith) {
      row.conflicts_with = JSON.stringify(entity.conflictsWith);
    }

    return row;
  }

  /**
   * Override to handle JSON parsing of patches and conflicts arrays
   */
  protected override mapRowToEntity(row: Record<string, unknown>): PendingChange {
    // Parse patches JSON
    if (row.patches && typeof row.patches === 'string') {
      try {
        row.patches = JSON.parse(row.patches);
      } catch (error) {
        throw new Error(`Invalid patches JSON for pending change ${row.id}: ${error}`);
      }
    }

    // Parse conflicts array JSON
    if (row.conflicts_with && typeof row.conflicts_with === 'string') {
      try {
        row.conflicts_with = JSON.parse(row.conflicts_with);
      } catch {
        // Default to empty array if parsing fails
        row.conflicts_with = [];
      }
    } else if (!row.conflicts_with) {
      row.conflicts_with = [];
    }

    return super.mapRowToEntity(row);
  }
}

/**
 * Validation functions
 */
export const validatePendingChange = (data: unknown): PendingChange => {
  return PendingChangeSchema.parse(data);
};

export const validateCreatePendingChange = (data: unknown): CreatePendingChangeInput => {
  return CreatePendingChangeSchema.parse(data);
};

export const validatePatchDiff = (data: unknown): PatchDiff => {
  return PatchDiffSchema.parse(data);
};

/**
 * Pending change utility functions
 */
export const PendingChangeUtils = {
  /**
   * Check if pending change is in a final state
   */
  isFinal(change: PendingChange): boolean {
    return change.status === 'applied' || change.status === 'failed';
  },

  /**
   * Check if pending change can be applied
   */
  canApply(change: PendingChange): boolean {
    return change.status === 'pending' && change.conflictsWith.length === 0;
  },

  /**
   * Check if pending change has conflicts
   */
  hasConflicts(change: PendingChange): boolean {
    return change.conflictsWith.length > 0;
  },

  /**
   * Calculate the size of changes in terms of additions/deletions
   */
  calculateChangeSize(change: PendingChange): {
    additions: number;
    deletions: number;
    modifications: number;
  } {
    let additions = 0;
    let deletions = 0;
    let modifications = 0;

    for (const patch of change.patches) {
      switch (patch.op) {
        case 'add':
          additions++;
          break;
        case 'remove':
          deletions++;
          break;
        case 'replace':
          modifications++;
          break;
      }
    }

    return { additions, deletions, modifications };
  },

  /**
   * Generate a summary of the pending change
   */
  generateSummary(change: PendingChange): string {
    const { additions, deletions, modifications } = PendingChangeUtils.calculateChangeSize(change);
    const parts: string[] = [];

    if (additions > 0) parts.push(`+${additions}`);
    if (deletions > 0) parts.push(`-${deletions}`);
    if (modifications > 0) parts.push(`~${modifications}`);

    return parts.join(' ') || 'No changes';
  },

  /**
   * Check if two pending changes conflict based on their patches
   */
  detectConflict(change1: PendingChange, change2: PendingChange): boolean {
    if (change1.sectionId !== change2.sectionId) {
      return false;
    }

    // Simple conflict detection: check if patches affect overlapping paths
    const paths1 = new Set(change1.patches.map(p => p.path));
    const paths2 = new Set(change2.patches.map(p => p.path));

    // Check for path overlaps
    for (const path of paths1) {
      if (paths2.has(path)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Validate patch sequence for consistency
   */
  validatePatches(patches: PatchDiff[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (patches.length === 0) {
      errors.push('At least one patch is required');
      return { valid: false, errors };
    }

    for (const [index, patch] of patches.entries()) {
      // Validate required fields based on operation
      if (patch.op === 'add' && !patch.value) {
        errors.push(`Patch ${index}: 'add' operation requires 'value' field`);
      }

      if (patch.op === 'remove' && !patch.oldValue) {
        errors.push(`Patch ${index}: 'remove' operation requires 'oldValue' field`);
      }

      if (patch.op === 'replace' && (!patch.value || !patch.oldValue)) {
        errors.push(
          `Patch ${index}: 'replace' operation requires both 'value' and 'oldValue' fields`
        );
      }

      // Validate path format
      if (!patch.path.startsWith('/')) {
        errors.push(`Patch ${index}: path must start with '/'`);
      }
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Calculate age of pending change in hours
   */
  getAgeInHours(change: PendingChange): number {
    const now = new Date();
    const diffMs = now.getTime() - change.createdAt.getTime();
    return diffMs / (1000 * 60 * 60);
  },

  /**
   * Check if pending change is stale (older than threshold)
   */
  isStale(change: PendingChange, thresholdHours: number = 24): boolean {
    return PendingChangeUtils.getAgeInHours(change) > thresholdHours;
  },
};
