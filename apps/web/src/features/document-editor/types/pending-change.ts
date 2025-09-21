/**
 * PendingChange Type Definitions
 *
 * Tracks unsaved changes as Git-style patches per section.
 * Supports diff generation, conflict detection, and change application.
 */

export type PatchOperation = 'add' | 'remove' | 'replace';

export type PendingChangeStatus = 'pending' | 'applying' | 'applied' | 'failed';

/**
 * Represents a single diff operation in a patch
 */
export interface PatchDiff {
  /** Type of operation (add, remove, replace) */
  op: PatchOperation;

  /** JSONPath or line number indicating location of change */
  path: string;

  /** New content for add/replace operations */
  value?: string;

  /** Previous content for remove/replace operations */
  oldValue?: string;
}

/**
 * Core pending change interface based on data-model.md specification
 */
export interface PendingChange {
  /** Change identifier */
  id: string;

  /** Target section */
  sectionId: string;

  /** Parent document (denormalized for performance) */
  documentId: string;

  // Patch data
  /** Array of diff operations */
  patches: PatchDiff[];

  /** Content before changes */
  originalContent: string;

  /** Content after applying patches */
  previewContent: string;

  // Metadata
  /** ISO timestamp when change was created */
  createdAt: string;

  /** User who made changes */
  createdBy: string;

  /** Browser session identifier */
  sessionId: string;

  // State
  /** Current status of the change */
  status: PendingChangeStatus;

  /** IDs of conflicting changes */
  conflictsWith: string[];
}

/**
 * Interface for creating a new pending change
 */
export interface CreatePendingChange {
  sectionId: string;
  documentId: string;
  patches: PatchDiff[];
  originalContent: string;
  previewContent: string;
  createdBy: string;
  sessionId: string;
}

/**
 * Interface for updating pending change status
 */
export interface PendingChangeUpdate {
  id: string;
  status?: PendingChangeStatus;
  conflictsWith?: string[];
}

/**
 * Patch diff statistics for display
 */
export interface PatchStats {
  /** Number of additions */
  additions: number;

  /** Number of deletions */
  deletions: number;

  /** Number of modifications */
  modifications: number;

  /** Total number of changes */
  total: number;
}

/**
 * Conflict resolution options
 */
export interface ConflictResolution {
  changeId: string;
  resolution: 'accept' | 'reject' | 'merge';
  mergedContent?: string;
}

/**
 * Type guard to check if an object is a valid PendingChange
 */
export function isPendingChange(obj: unknown): obj is PendingChange {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as PendingChange).id === 'string' &&
    typeof (obj as PendingChange).sectionId === 'string' &&
    typeof (obj as PendingChange).documentId === 'string' &&
    Array.isArray((obj as PendingChange).patches) &&
    typeof (obj as PendingChange).originalContent === 'string' &&
    typeof (obj as PendingChange).previewContent === 'string' &&
    typeof (obj as PendingChange).createdAt === 'string' &&
    typeof (obj as PendingChange).createdBy === 'string' &&
    typeof (obj as PendingChange).sessionId === 'string' &&
    typeof (obj as PendingChange).status === 'string' &&
    Array.isArray((obj as PendingChange).conflictsWith)
  );
}

/**
 * Type guard to check if an object is a valid PatchDiff
 */
export function isPatchDiff(obj: unknown): obj is PatchDiff {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as PatchDiff).op === 'string' &&
    ['add', 'remove', 'replace'].includes((obj as PatchDiff).op) &&
    typeof (obj as PatchDiff).path === 'string'
  );
}

/**
 * Valid status transitions for pending change state machine
 */
export const PENDING_CHANGE_STATUS_TRANSITIONS: Record<PendingChangeStatus, PendingChangeStatus[]> =
  {
    pending: ['applying'],
    applying: ['applied', 'failed'],
    applied: [], // Terminal state
    failed: ['pending'], // Can retry
  };

/**
 * Helper function to validate status transitions
 */
export function isValidStatusTransition(
  current: PendingChangeStatus,
  next: PendingChangeStatus
): boolean {
  return PENDING_CHANGE_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Helper function to calculate patch statistics
 */
export function calculatePatchStats(patches: PatchDiff[]): PatchStats {
  const stats: PatchStats = {
    additions: 0,
    deletions: 0,
    modifications: 0,
    total: patches.length,
  };

  patches.forEach(patch => {
    switch (patch.op) {
      case 'add':
        stats.additions++;
        break;
      case 'remove':
        stats.deletions++;
        break;
      case 'replace':
        stats.modifications++;
        break;
    }
  });

  return stats;
}

/**
 * Helper function to check if changes conflict
 * Two changes conflict if they modify overlapping content areas
 */
export function changesConflict(change1: PendingChange, change2: PendingChange): boolean {
  if (change1.sectionId !== change2.sectionId) {
    return false;
  }

  if (change1.originalContent !== change2.originalContent) {
    return true;
  }

  // Check if patches modify overlapping paths
  const paths1 = new Set(change1.patches.map(p => p.path));
  const paths2 = new Set(change2.patches.map(p => p.path));

  // Simple overlap check - could be enhanced with more sophisticated conflict detection
  for (const path of paths1) {
    if (paths2.has(path)) {
      return true;
    }
  }

  return false;
}

/**
 * Default values for pending change creation
 */
export const DEFAULT_PENDING_CHANGE: Partial<PendingChange> = {
  status: 'pending',
  conflictsWith: [],
};

/**
 * Maximum limits for pending changes
 */
export const PENDING_CHANGE_LIMITS = {
  /** Maximum number of patches per change */
  MAX_PATCHES_PER_CHANGE: 100,

  /** Maximum content length for original/preview content */
  MAX_CONTENT_LENGTH: 100000,

  /** Maximum number of pending changes per section */
  MAX_PENDING_PER_SECTION: 100,

  /** Maximum age of pending changes in milliseconds (24 hours) */
  MAX_AGE_MS: 24 * 60 * 60 * 1000,
} as const;
