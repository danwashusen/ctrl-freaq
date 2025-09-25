/**
 * SectionView Type Definitions
 *
 * Represents the view state of a document section in the editor.
 * Supports hierarchical document sections with read/edit modes,
 * pending changes tracking, and section lifecycle management.
 */

export type SectionViewState = 'idle' | 'read_mode' | 'edit_mode' | 'saving';

export type SectionStatus = 'idle' | 'assumptions' | 'drafting' | 'review' | 'ready';

export type QualityGateStatus = 'pending' | 'passed' | 'failed' | null;

/**
 * Core section view interface based on data-model.md specification
 */
export interface SectionView {
  /** Section unique identifier */
  id: string;

  /** Parent document ID */
  docId: string;

  /** Parent section for hierarchy */
  parentSectionId: string | null;

  /** Section key from template */
  key: string;

  /** Display title */
  title: string;

  /** Nesting level (0 = root, max 5) */
  depth: number;

  /** Sort order within parent */
  orderIndex: number;

  // Content states
  /** Current saved content */
  contentMarkdown: string;

  /** Template placeholder when empty */
  placeholderText: string;

  /** Whether section has saved content */
  hasContent: boolean;

  // Editor states
  /** Current view state in editor */
  viewState: SectionViewState;

  /** User currently editing (for collaboration) */
  editingUser: string | null;

  /** ISO timestamp of last change */
  lastModified: string;

  // Section lifecycle
  /** Current status in document workflow */
  status: SectionStatus;

  /** Whether assumptions have been addressed */
  assumptionsResolved: boolean;

  /** Quality gate validation status */
  qualityGateStatus: QualityGateStatus;

  // Approval metadata
  /** Latest approved version number */
  approvedVersion: number | null;
  /** Timestamp of most recent approval */
  approvedAt: string | null;
  /** User who approved most recently */
  approvedBy: string | null;
  /** Reviewer summary captured during approval */
  lastSummary: string | null;

  // Draft + conflict metadata
  draftId: string | null;
  draftVersion: number | null;
  draftBaseVersion: number | null;
  latestApprovedVersion: number | null;
  conflictState: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  conflictReason: string | null;

  // Manual save metadata
  summaryNote: string | null;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
  lastManualSaveAt: number | null;
}

/**
 * Partial interface for section updates
 * Used when modifying specific fields without requiring all properties
 */
export interface SectionViewUpdate {
  id: string;
  viewState?: SectionViewState;
  contentMarkdown?: string;
  hasContent?: boolean;
  editingUser?: string | null;
  lastModified?: string;
  status?: SectionStatus;
  assumptionsResolved?: boolean;
  qualityGateStatus?: QualityGateStatus;
  approvedVersion?: number | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  lastSummary?: string | null;
  draftId?: string | null;
  draftVersion?: number | null;
  draftBaseVersion?: number | null;
  latestApprovedVersion?: number | null;
  conflictState?: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  conflictReason?: string | null;
  summaryNote?: string | null;
  lastSavedAt?: string | null;
  lastSavedBy?: string | null;
  lastManualSaveAt?: number | null;
}

/**
 * Section creation interface
 * Required fields when creating a new section
 */
export interface CreateSectionView {
  docId: string;
  parentSectionId: string | null;
  key: string;
  title: string;
  depth: number;
  orderIndex: number;
  placeholderText: string;
}

/**
 * Type guard to check if an object is a valid SectionView
 */
export function isSectionView(obj: unknown): obj is SectionView {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as SectionView).id === 'string' &&
    typeof (obj as SectionView).docId === 'string' &&
    typeof (obj as SectionView).title === 'string' &&
    typeof (obj as SectionView).depth === 'number' &&
    typeof (obj as SectionView).orderIndex === 'number' &&
    typeof (obj as SectionView).contentMarkdown === 'string' &&
    typeof (obj as SectionView).placeholderText === 'string' &&
    typeof (obj as SectionView).hasContent === 'boolean' &&
    typeof (obj as SectionView).viewState === 'string' &&
    typeof (obj as SectionView).lastModified === 'string' &&
    typeof (obj as SectionView).status === 'string' &&
    typeof (obj as SectionView).assumptionsResolved === 'boolean'
  );
}

/**
 * Default section view values for initialization
 */
export const DEFAULT_SECTION_VIEW: Partial<SectionView> = {
  contentMarkdown: '',
  hasContent: false,
  viewState: 'idle',
  editingUser: null,
  status: 'idle',
  assumptionsResolved: false,
  qualityGateStatus: null,
  approvedVersion: null,
  approvedAt: null,
  approvedBy: null,
  lastSummary: null,
  draftId: null,
  draftVersion: null,
  draftBaseVersion: null,
  latestApprovedVersion: null,
  conflictState: 'clean',
  conflictReason: null,
  summaryNote: null,
  lastSavedAt: null,
  lastSavedBy: null,
  lastManualSaveAt: null,
};

/**
 * Valid state transitions for view state machine
 */
export const SECTION_VIEW_STATE_TRANSITIONS: Record<SectionViewState, SectionViewState[]> = {
  idle: ['read_mode'],
  read_mode: ['edit_mode', 'idle'],
  edit_mode: ['saving', 'read_mode'],
  saving: ['read_mode', 'edit_mode'], // Can return to edit_mode on save failure
};

/**
 * Valid status transitions for section lifecycle
 */
export const SECTION_STATUS_TRANSITIONS: Record<SectionStatus, SectionStatus[]> = {
  idle: ['assumptions'],
  assumptions: ['drafting'],
  drafting: ['review'],
  review: ['ready', 'drafting'], // Can return to drafting if issues found
  ready: [], // Terminal state
};

/**
 * Helper function to validate state transitions
 */
export function isValidViewStateTransition(
  current: SectionViewState,
  next: SectionViewState
): boolean {
  return SECTION_VIEW_STATE_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Helper function to validate status transitions
 */
export function isValidStatusTransition(current: SectionStatus, next: SectionStatus): boolean {
  return SECTION_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}
