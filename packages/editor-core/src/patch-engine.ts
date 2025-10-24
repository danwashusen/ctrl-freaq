/**
 * Patch Engine for Document Editor Core Infrastructure
 *
 * Git-style patch generation and application using diff-match-patch.
 * Supports content change tracking, patch preview, and conflict resolution.
 */

import DiffMatchPatchModule from 'diff-match-patch';
import { z, type ZodErrorMap } from 'zod';
import { logger } from './logger';

// Validation schemas
const patchOperationError: ZodErrorMap = issue => {
  if (issue.code === 'invalid_value') {
    return { message: 'Invalid enum value' };
  }
  return issue.message;
};

export const PatchDiffSchema = z.object({
  op: z.enum(['add', 'remove', 'replace'] as ['add', 'remove', 'replace'], {
    error: patchOperationError,
  }),
  path: z.string(),
  value: z.string().optional(),
  oldValue: z.string().optional(),
});

export const PendingChangeSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  documentId: z.string(),
  patches: z.array(PatchDiffSchema),
  originalContent: z.string(),
  previewContent: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
  sessionId: z.string(),
  status: z.enum(['pending', 'applying', 'applied', 'failed']),
  conflictsWith: z.array(z.string()),
});

// Types from data model
export type PatchDiff = z.infer<typeof PatchDiffSchema>;
export type PendingChange = z.infer<typeof PendingChangeSchema>;

export interface PatchResult {
  success: boolean;
  content?: string;
  error?: string;
  conflicted?: boolean;
}

export interface PatchPreview {
  additions: number;
  deletions: number;
  preview: string;
  patches: PatchDiff[];
}

export interface PatchEngineConfig {
  maxPatchSize?: number;
  diffTimeout?: number;
  diffEditCost?: number;
  matchThreshold?: number;
  deleteThreshold?: number;
}

/**
 * Core patch engine using Google's diff-match-patch library
 */
const { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } =
  DiffMatchPatchModule as typeof DiffMatchPatchModule & {
    diff_match_patch: typeof import('diff-match-patch').diff_match_patch;
    DIFF_DELETE: typeof import('diff-match-patch').DIFF_DELETE;
    DIFF_INSERT: typeof import('diff-match-patch').DIFF_INSERT;
    DIFF_EQUAL: typeof import('diff-match-patch').DIFF_EQUAL;
  };

type DmpPatchArray = ReturnType<InstanceType<typeof diff_match_patch>['patch_make']>;

export class PatchEngine {
  private dmp: InstanceType<typeof diff_match_patch>;
  private config: Required<PatchEngineConfig>;

  constructor(config: PatchEngineConfig = {}) {
    this.dmp = new diff_match_patch();
    this.config = {
      maxPatchSize: 32,
      diffTimeout: 1.0,
      diffEditCost: 4,
      matchThreshold: 0.5,
      deleteThreshold: 0.5,
      ...config,
    };

    // Configure diff-match-patch settings for performance
    this.dmp.Diff_Timeout = this.config.diffTimeout;
    this.dmp.Diff_EditCost = this.config.diffEditCost;
    this.dmp.Match_Threshold = this.config.matchThreshold;
    this.dmp.Patch_DeleteThreshold = this.config.deleteThreshold;
  }

  /**
   * Generate patches between original and modified content
   * Performance goal: <100ms for typical document sections
   */
  createPatch(originalContent: string, modifiedContent: string): PatchDiff[] {
    const startTime = performance.now();

    try {
      // Generate diffs using diff-match-patch
      const diffs = this.dmp.diff_main(originalContent, modifiedContent);
      this.dmp.diff_cleanupSemantic(diffs);

      // Convert diffs to our PatchDiff format
      const patches: PatchDiff[] = [];
      let _position = 0;
      let lineNumber = 1;

      for (const [operation, text] of diffs) {
        const lines = text.split('\n');

        switch (operation) {
          case DIFF_DELETE:
            patches.push({
              op: 'remove',
              path: `/line/${lineNumber}`,
              oldValue: text,
            });
            lineNumber += lines.length - 1;
            break;

          case DIFF_INSERT:
            patches.push({
              op: 'add',
              path: `/line/${lineNumber}`,
              value: text,
            });
            break;

          case DIFF_EQUAL:
            _position += text.length;
            lineNumber += lines.length - 1;
            break;
        }
      }

      // Optimize patches by merging adjacent operations
      const optimizedPatches = this.optimizePatches(patches);

      const duration = performance.now() - startTime;
      if (duration > 100) {
        logger.warn(
          {
            operation: 'create_patch',
            duration: parseFloat(duration.toFixed(1)),
            threshold: 100,
          },
          `Patch generation took ${duration.toFixed(1)}ms (>100ms target)`
        );
      }

      return optimizedPatches;
    } catch (error) {
      throw new Error(
        `Failed to create patch: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply patches to original content
   */
  applyPatch(originalContent: string, patches: PatchDiff[]): PatchResult {
    try {
      // Validate patches
      const validationResult = this.validatePatches(patches);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid patches: ${validationResult.errors.join(', ')}`,
        };
      }

      // Convert our PatchDiff format to diff-match-patch patches
      const dmpPatches = this.convertToDmpPatches(originalContent, patches);

      // Apply patches
      const [resultContent, results] = this.dmp.patch_apply(
        dmpPatches as unknown as Parameters<typeof this.dmp.patch_apply>[0],
        originalContent
      );

      // Check if all patches applied successfully
      const allApplied = results.every((result: boolean) => result === true);

      if (!allApplied) {
        const failedCount = results.filter((r: boolean) => !r).length;
        return {
          success: false,
          error: `${failedCount} of ${results.length} patches failed to apply`,
          conflicted: true,
        };
      }

      return {
        success: true,
        content: resultContent,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate preview of changes with statistics
   */
  previewPatch(originalContent: string, modifiedContent: string): PatchPreview {
    const patches = this.createPatch(originalContent, modifiedContent);

    // Calculate statistics
    let additions = 0;
    let deletions = 0;
    const previewLines: string[] = [];

    for (const patch of patches) {
      switch (patch.op) {
        case 'add':
          additions++;
          if (patch.value) {
            previewLines.push(`+ ${patch.value}`);
          }
          break;
        case 'remove':
          deletions++;
          if (patch.oldValue) {
            previewLines.push(`- ${patch.oldValue}`);
          }
          break;
        case 'replace':
          additions++;
          deletions++;
          if (patch.oldValue) {
            previewLines.push(`- ${patch.oldValue}`);
          }
          if (patch.value) {
            previewLines.push(`+ ${patch.value}`);
          }
          break;
      }
    }

    return {
      additions,
      deletions,
      preview: previewLines.join('\n'),
      patches,
    };
  }

  /**
   * Create a pending change record
   */
  createPendingChange(
    sectionId: string,
    documentId: string,
    originalContent: string,
    modifiedContent: string,
    createdBy: string,
    sessionId: string
  ): PendingChange {
    const patches = this.createPatch(originalContent, modifiedContent);

    return {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sectionId,
      documentId,
      patches,
      originalContent,
      previewContent: modifiedContent,
      createdAt: new Date().toISOString(),
      createdBy,
      sessionId,
      status: 'pending',
      conflictsWith: [],
    };
  }

  /**
   * Check for conflicts between pending changes
   */
  detectConflicts(existingChanges: PendingChange[], newChange: PendingChange): string[] {
    const conflicts: string[] = [];

    for (const existing of existingChanges) {
      if (existing.sectionId !== newChange.sectionId) continue;
      if (existing.status === 'applied' || existing.status === 'failed') continue;

      // Check if patches overlap
      const hasOverlap = this.patchesOverlap(existing.patches, newChange.patches);
      if (hasOverlap) {
        conflicts.push(existing.id);
      }
    }

    return conflicts;
  }

  /**
   * Optimize patches by merging adjacent operations
   */
  private optimizePatches(patches: PatchDiff[]): PatchDiff[] {
    if (patches.length <= 1) return patches;

    const optimized: PatchDiff[] = [];
    let current = patches[0];
    if (!current) return patches;

    for (let i = 1; i < patches.length; i++) {
      const next = patches[i];
      if (!next) continue;

      // Try to merge adjacent patches of the same operation
      if (this.canMergePatches(current, next)) {
        current = this.mergePatches(current, next);
      } else {
        optimized.push(current);
        current = next;
      }
    }

    optimized.push(current);
    return optimized;
  }

  /**
   * Check if two patches can be merged
   */
  private canMergePatches(patch1: PatchDiff, patch2: PatchDiff): boolean {
    // Only merge patches of the same operation
    if (patch1.op !== patch2.op) return false;

    // Check if paths are adjacent
    const path1 = this.extractLineNumber(patch1.path);
    const path2 = this.extractLineNumber(patch2.path);

    return Math.abs(path1 - path2) <= 1;
  }

  /**
   * Merge two compatible patches
   */
  private mergePatches(patch1: PatchDiff, patch2: PatchDiff): PatchDiff {
    const minPath = Math.min(
      this.extractLineNumber(patch1.path),
      this.extractLineNumber(patch2.path)
    );

    switch (patch1.op) {
      case 'add':
        return {
          op: 'add',
          path: `/line/${minPath}`,
          value: (patch1.value || '') + '\n' + (patch2.value || ''),
        };
      case 'remove':
        return {
          op: 'remove',
          path: `/line/${minPath}`,
          oldValue: (patch1.oldValue || '') + '\n' + (patch2.oldValue || ''),
        };
      case 'replace':
        return {
          op: 'replace',
          path: `/line/${minPath}`,
          oldValue: (patch1.oldValue || '') + '\n' + (patch2.oldValue || ''),
          value: (patch1.value || '') + '\n' + (patch2.value || ''),
        };
    }
  }

  /**
   * Extract line number from patch path
   */
  private extractLineNumber(path: string): number {
    const match = path.match(/\/line\/(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : 0;
  }

  /**
   * Validate patch operations
   */
  validatePatches(patches: PatchDiff[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [index, patch] of patches.entries()) {
      try {
        PatchDiffSchema.parse(patch);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(`Patch ${index}: ${error.issues.map(e => e.message).join(', ')}`);
        }
      }

      // Validate operation-specific requirements
      if (patch.op === 'add' && !patch.value) {
        errors.push(`Patch ${index}: 'add' operation requires 'value'`);
      }
      if (patch.op === 'remove' && !patch.oldValue) {
        errors.push(`Patch ${index}: 'remove' operation requires 'oldValue'`);
      }
      if (patch.op === 'replace' && (!patch.value || !patch.oldValue)) {
        errors.push(`Patch ${index}: 'replace' operation requires both 'value' and 'oldValue'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert our PatchDiff format to diff-match-patch patches
   */
  private convertToDmpPatches(originalContent: string, patches: PatchDiff[]): DmpPatchArray {
    // Create a simple diff representing the changes
    const diffs: [number, string][] = [];

    // This is a simplified conversion - in practice, you might need more
    // sophisticated logic to reconstruct proper diffs from PatchDiff
    for (const patch of patches) {
      switch (patch.op) {
        case 'add':
          if (patch.value) {
            diffs.push([DIFF_INSERT, patch.value]);
          }
          break;
        case 'remove':
          if (patch.oldValue) {
            diffs.push([DIFF_DELETE, patch.oldValue]);
          }
          break;
        case 'replace':
          if (patch.oldValue) {
            diffs.push([DIFF_DELETE, patch.oldValue]);
          }
          if (patch.value) {
            diffs.push([DIFF_INSERT, patch.value]);
          }
          break;
      }
    }

    return this.dmp.patch_make(originalContent, diffs) as DmpPatchArray;
  }

  /**
   * Check if two sets of patches overlap
   */
  private patchesOverlap(patches1: PatchDiff[], patches2: PatchDiff[]): boolean {
    for (const p1 of patches1) {
      for (const p2 of patches2) {
        const line1 = this.extractLineNumber(p1.path);
        const line2 = this.extractLineNumber(p2.path);

        // Consider patches as overlapping if they affect adjacent lines
        if (Math.abs(line1 - line2) <= 1) {
          return true;
        }
      }
    }
    return false;
  }
}

// Factory function for creating configured patch engine
export function createPatchEngine(config?: PatchEngineConfig): PatchEngine {
  return new PatchEngine(config);
}

// Export default instance
export const patchEngine = createPatchEngine();
