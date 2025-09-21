/**
 * Pending Changes Service
 *
 * Provides methods for managing pending changes in document sections.
 * Handles patch creation, application, and conflict resolution.
 * Follows the OpenAPI contract defined in contracts/sections-api.yaml.
 */

import ApiClient from '../../../lib/api';
import type { PendingChange, PatchDiff } from '../types/pending-change';
import { logger } from '../utils/logger';

// API Request types
export interface CreatePendingChangeRequest {
  patches: PatchDiff[];
  originalContent: string;
  previewContent: string;
}

export interface ApplyPendingChangesRequest {
  changeIds: string[];
}

// API Response types
export interface PendingChangesResponse {
  changes: PendingChange[];
}

export interface CreatePendingChangeResponse {
  change: PendingChange;
}

export interface ApplyPendingChangesResponse {
  appliedChanges: string[];
  failedChanges: Array<{
    changeId: string;
    error: string;
  }>;
}

/**
 * Service class for managing pending changes via API
 *
 * Extends ApiClient to access the private makeRequest method
 */
export class PendingChangesService extends ApiClient {
  constructor() {
    super();
  }

  /**
   * Get pending changes for a section
   * GET /api/v1/sections/{sectionId}/pending-changes
   */
  async getPendingChanges(sectionId: string): Promise<PendingChange[]> {
    const response = await this['makeRequest']<PendingChangesResponse>(
      `/sections/${sectionId}/pending-changes`
    );
    return response.changes;
  }

  /**
   * Create pending changes for a section
   * POST /api/v1/sections/{sectionId}/pending-changes
   */
  async createPendingChange(
    sectionId: string,
    request: CreatePendingChangeRequest
  ): Promise<PendingChange> {
    return this['makeRequest']<PendingChange>(`/sections/${sectionId}/pending-changes`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Apply pending changes to a section
   * POST /api/v1/sections/{sectionId}/save
   */
  async applyPendingChanges(
    sectionId: string,
    changeIds: string[]
  ): Promise<ApplyPendingChangesResponse> {
    return this['makeRequest']<ApplyPendingChangesResponse>(`/sections/${sectionId}/save`, {
      method: 'POST',
      body: JSON.stringify({ changeIds }),
    });
  }

  /**
   * Delete a specific pending change
   * DELETE /api/v1/sections/{sectionId}/pending-changes/{changeId}
   */
  async deletePendingChange(sectionId: string, changeId: string): Promise<void> {
    await this['makeRequest']<void>(`/sections/${sectionId}/pending-changes/${changeId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get pending changes across multiple sections
   * Convenience method for batch operations
   */
  async getMultipleSectionChanges(sectionIds: string[]): Promise<Record<string, PendingChange[]>> {
    const results: Record<string, PendingChange[]> = {};

    // Execute requests in parallel for better performance
    const requests = sectionIds.map(async sectionId => {
      try {
        const changes = await this.getPendingChanges(sectionId);
        results[sectionId] = changes;
      } catch (error) {
        // Log error but don't fail the entire operation
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(
          {
            operation: 'get_pending_changes',
            sectionId,
            error: errorMessage,
          },
          `Failed to get pending changes for section ${sectionId}`
        );
        results[sectionId] = [];
      }
    });

    await Promise.all(requests);
    return results;
  }

  /**
   * Get conflicting changes across sections
   * Identifies changes that might conflict with each other
   */
  async getConflictingChanges(sectionIds: string[]): Promise<
    Array<{
      sectionId: string;
      conflictingChangeIds: string[];
    }>
  > {
    const conflicts: Array<{
      sectionId: string;
      conflictingChangeIds: string[];
    }> = [];

    const allChanges = await this.getMultipleSectionChanges(sectionIds);

    Object.entries(allChanges).forEach(([sectionId, changes]) => {
      const conflictingIds = changes
        .filter(change => change.conflictsWith.length > 0)
        .map(change => change.id);

      if (conflictingIds.length > 0) {
        conflicts.push({
          sectionId,
          conflictingChangeIds: conflictingIds,
        });
      }
    });

    return conflicts;
  }

  /**
   * Create and apply changes in a single operation
   * Convenience method for immediate saves
   */
  async createAndApplyChange(
    sectionId: string,
    request: CreatePendingChangeRequest
  ): Promise<{
    change: PendingChange;
    applied: boolean;
    error?: string;
  }> {
    try {
      // Create the pending change
      const change = await this.createPendingChange(sectionId, request);

      // Apply it immediately
      const applyResult = await this.applyPendingChanges(sectionId, [change.id]);

      const applied = applyResult.appliedChanges.includes(change.id);
      const failed = applyResult.failedChanges.find(f => f.changeId === change.id);

      return {
        change,
        applied,
        error: failed?.error,
      };
    } catch (error) {
      throw new Error(
        `Failed to create and apply change for section ${sectionId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get pending changes summary for a document
   * Returns statistics about pending changes across all sections
   */
  async getDocumentChangesSummary(sectionIds: string[]): Promise<{
    totalChanges: number;
    sectionsWithChanges: number;
    conflictingSections: number;
    oldestChangeDate: string | null;
    newestChangeDate: string | null;
  }> {
    const allChanges = await this.getMultipleSectionChanges(sectionIds);

    let totalChanges = 0;
    let sectionsWithChanges = 0;
    let conflictingSections = 0;
    const dates: Date[] = [];

    Object.values(allChanges).forEach(changes => {
      if (changes.length > 0) {
        sectionsWithChanges++;
        totalChanges += changes.length;

        const hasConflicts = changes.some(change => change.conflictsWith.length > 0);
        if (hasConflicts) {
          conflictingSections++;
        }

        changes.forEach(change => {
          const changeDate = new Date(change.createdAt);
          dates.push(changeDate);
        });
      }
    });

    // Calculate oldest and newest dates
    const oldestDate = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    const newestDate = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    return {
      totalChanges,
      sectionsWithChanges,
      conflictingSections,
      oldestChangeDate: oldestDate?.toISOString() ?? null,
      newestChangeDate: newestDate?.toISOString() ?? null,
    };
  }

  /**
   * Validate patch operations before creating pending changes
   * Checks patch structure and content validity
   */
  validatePatchOperations(patches: PatchDiff[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!patches || patches.length === 0) {
      errors.push('At least one patch operation is required');
      return { valid: false, errors };
    }

    patches.forEach((patch, index) => {
      // Validate operation type
      if (!['add', 'remove', 'replace'].includes(patch.op)) {
        errors.push(`Invalid operation "${patch.op}" at index ${index}`);
      }

      // Validate path
      if (!patch.path || typeof patch.path !== 'string') {
        errors.push(`Invalid or missing path at index ${index}`);
      }

      // Validate operation-specific requirements
      if (patch.op === 'add' || patch.op === 'replace') {
        if (patch.value === undefined) {
          errors.push(`Missing value for ${patch.op} operation at index ${index}`);
        }
      }

      if (patch.op === 'remove' || patch.op === 'replace') {
        if (patch.oldValue === undefined) {
          errors.push(`Missing oldValue for ${patch.op} operation at index ${index}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create pending change with validation
   * Validates patch operations before making API call
   */
  async createValidatedPendingChange(
    sectionId: string,
    request: CreatePendingChangeRequest
  ): Promise<PendingChange> {
    const validation = this.validatePatchOperations(request.patches);

    if (!validation.valid) {
      throw new Error(`Invalid patch operations: ${validation.errors.join(', ')}`);
    }

    return this.createPendingChange(sectionId, request);
  }
}

/**
 * Factory function to create a PendingChangesService instance
 */
export function createPendingChangesService(): PendingChangesService {
  return new PendingChangesService();
}

// Export types for external use
export type { PendingChange, PatchDiff };
