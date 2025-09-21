/**
 * EditorSession Type Definitions
 *
 * Manages the active editing session state including navigation,
 * editor configuration, collaboration, and performance metrics.
 */

export type EditorMode = 'wysiwyg' | 'markdown' | 'preview';

/**
 * Represents a collaborator in the editing session
 */
export interface Collaborator {
  /** User identifier */
  userId: string;

  /** Display name */
  userName: string;

  /** Section currently being edited by this user */
  activeSectionId: string | null;

  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Core editor session interface based on data-model.md specification
 */
export interface EditorSession {
  /** Active document identifier */
  documentId: string;

  /** Current user identifier */
  userId: string;

  /** Unique session identifier */
  sessionId: string;

  // Navigation state
  /** Currently focused section */
  activeSectionId: string | null;

  /** Expanded ToC nodes */
  expandedSections: string[];

  /** Document scroll offset */
  scrollPosition: number;

  // Editor configuration
  /** Current editor mode */
  editorMode: EditorMode;

  /** Whether showing changes/diff view */
  showDiffView: boolean;

  /** Auto-save preference */
  autoSaveEnabled: boolean;

  /** Milliseconds between auto-saves */
  autoSaveInterval: number;

  // Collaboration
  /** Other users in the session */
  collaborators: Collaborator[];

  // Performance metrics
  /** Milliseconds for last save operation */
  lastSaveTime: number;

  /** Number of unsaved changes */
  pendingChangeCount: number;
}

/**
 * Interface for creating a new editor session
 */
export interface CreateEditorSession {
  documentId: string;
  userId: string;
  sessionId?: string; // Auto-generated if not provided
  editorMode?: EditorMode;
  autoSaveEnabled?: boolean;
  autoSaveInterval?: number;
}

/**
 * Interface for updating editor session
 */
export interface EditorSessionUpdate {
  sessionId: string;
  activeSectionId?: string | null;
  expandedSections?: string[];
  scrollPosition?: number;
  editorMode?: EditorMode;
  showDiffView?: boolean;
  autoSaveEnabled?: boolean;
  autoSaveInterval?: number;
  lastSaveTime?: number;
  pendingChangeCount?: number;
}

/**
 * Navigation state for session restoration
 */
export interface NavigationState {
  activeSectionId: string | null;
  expandedSections: string[];
  scrollPosition: number;
}

/**
 * Editor preferences that persist across sessions
 */
export interface EditorPreferences {
  editorMode: EditorMode;
  showDiffView: boolean;
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
}

/**
 * Performance metrics for monitoring session health
 */
export interface SessionPerformanceMetrics {
  /** Average save time in milliseconds */
  averageSaveTime: number;

  /** Maximum save time in milliseconds */
  maxSaveTime: number;

  /** Number of save operations */
  saveCount: number;

  /** Session start time */
  sessionStartTime: string;

  /** Last activity timestamp */
  lastActivityTime: string;

  /** Total navigation events */
  navigationCount: number;

  /** Average navigation time in milliseconds */
  averageNavigationTime: number;
}

/**
 * Type guard to check if an object is a valid EditorSession
 */
export function isEditorSession(obj: unknown): obj is EditorSession {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as EditorSession).documentId === 'string' &&
    typeof (obj as EditorSession).userId === 'string' &&
    typeof (obj as EditorSession).sessionId === 'string' &&
    Array.isArray((obj as EditorSession).expandedSections) &&
    typeof (obj as EditorSession).scrollPosition === 'number' &&
    typeof (obj as EditorSession).editorMode === 'string' &&
    typeof (obj as EditorSession).showDiffView === 'boolean' &&
    typeof (obj as EditorSession).autoSaveEnabled === 'boolean' &&
    typeof (obj as EditorSession).autoSaveInterval === 'number' &&
    Array.isArray((obj as EditorSession).collaborators) &&
    typeof (obj as EditorSession).lastSaveTime === 'number' &&
    typeof (obj as EditorSession).pendingChangeCount === 'number'
  );
}

/**
 * Type guard to check if an object is a valid Collaborator
 */
export function isCollaborator(obj: unknown): obj is Collaborator {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Collaborator).userId === 'string' &&
    typeof (obj as Collaborator).userName === 'string' &&
    (typeof (obj as Collaborator).activeSectionId === 'string' ||
      (obj as Collaborator).activeSectionId === null) &&
    typeof (obj as Collaborator).lastActivity === 'string'
  );
}

/**
 * Default editor session values
 */
export const DEFAULT_EDITOR_SESSION: Partial<EditorSession> = {
  activeSectionId: null,
  expandedSections: [],
  scrollPosition: 0,
  editorMode: 'wysiwyg',
  showDiffView: false,
  autoSaveEnabled: true,
  autoSaveInterval: 30000, // 30 seconds
  collaborators: [],
  lastSaveTime: 0,
  pendingChangeCount: 0,
};

/**
 * Default editor preferences
 */
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  editorMode: 'wysiwyg',
  showDiffView: false,
  autoSaveEnabled: true,
  autoSaveInterval: 30000, // 30 seconds
};

/**
 * Session configuration limits and constraints
 */
export const SESSION_LIMITS = {
  /** Minimum auto-save interval in milliseconds (10 seconds) */
  MIN_AUTO_SAVE_INTERVAL: 10000,

  /** Maximum auto-save interval in milliseconds (5 minutes) */
  MAX_AUTO_SAVE_INTERVAL: 300000,

  /** Maximum number of expanded sections to track */
  MAX_EXPANDED_SECTIONS: 50,

  /** Maximum number of collaborators per session */
  MAX_COLLABORATORS: 10,

  /** Session timeout in milliseconds (2 hours) */
  SESSION_TIMEOUT_MS: 2 * 60 * 60 * 1000,

  /** Collaborator activity timeout in milliseconds (5 minutes) */
  COLLABORATOR_TIMEOUT_MS: 5 * 60 * 1000,
} as const;

/**
 * Helper function to generate a new session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper function to check if auto-save interval is valid
 */
export function isValidAutoSaveInterval(interval: number): boolean {
  return (
    interval >= SESSION_LIMITS.MIN_AUTO_SAVE_INTERVAL &&
    interval <= SESSION_LIMITS.MAX_AUTO_SAVE_INTERVAL
  );
}

/**
 * Helper function to check if a collaborator is active
 */
export function isCollaboratorActive(collaborator: Collaborator): boolean {
  const lastActivity = new Date(collaborator.lastActivity).getTime();
  const now = Date.now();
  return now - lastActivity < SESSION_LIMITS.COLLABORATOR_TIMEOUT_MS;
}

/**
 * Helper function to filter active collaborators
 */
export function getActiveCollaborators(collaborators: Collaborator[]): Collaborator[] {
  return collaborators.filter(isCollaboratorActive);
}

/**
 * Helper function to check if session is expired
 */
export function isSessionExpired(session: EditorSession): boolean {
  // Use lastSaveTime as a proxy for last activity
  const lastActivity = session.lastSaveTime || 0;
  const now = Date.now();
  return lastActivity > 0 && now - lastActivity > SESSION_LIMITS.SESSION_TIMEOUT_MS;
}

/**
 * Helper function to create navigation state snapshot
 */
export function createNavigationSnapshot(session: EditorSession): NavigationState {
  return {
    activeSectionId: session.activeSectionId,
    expandedSections: [...session.expandedSections],
    scrollPosition: session.scrollPosition,
  };
}

/**
 * Helper function to restore navigation state
 */
export function restoreNavigationState(
  session: EditorSession,
  snapshot: NavigationState
): EditorSessionUpdate {
  return {
    sessionId: session.sessionId,
    activeSectionId: snapshot.activeSectionId,
    expandedSections: [...snapshot.expandedSections],
    scrollPosition: snapshot.scrollPosition,
  };
}
