/**
 * Editor Session Service
 *
 * Provides methods for managing editor sessions and collaboration state.
 * Handles session persistence, user presence, and editor configuration.
 * Follows the OpenAPI contract defined in contracts/sections-api.yaml.
 */

import ApiClient from '../../../lib/api';
import type { EditorSession, EditorSessionUpdate } from '../types/editor-session';

// API Request types
export interface CreateSessionRequest {
  documentId: string;
  editorMode?: 'wysiwyg' | 'markdown' | 'preview';
  autoSaveEnabled?: boolean;
  autoSaveInterval?: number;
}

// Simplified update request that doesn't require sessionId (handled by API path)
export interface UpdateSessionRequest {
  activeSectionId?: string | null;
  expandedSections?: string[];
  scrollPosition?: number;
  editorMode?: 'wysiwyg' | 'markdown' | 'preview';
  showDiffView?: boolean;
  autoSaveEnabled?: boolean;
  autoSaveInterval?: number;
  lastSaveTime?: number;
  pendingChangeCount?: number;
}

// API Response types
export interface SessionResponse {
  session: EditorSession;
}

export interface SessionListResponse {
  sessions: EditorSession[];
  activeCount: number;
}

// Local types for service operations
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  collaboratorCount: number;
}

export interface CollaboratorInfo {
  userId: string;
  userName: string;
  activeSectionId: string | null;
  lastActivity: string;
  isOnline: boolean;
}

/**
 * Service class for managing editor sessions via API
 *
 * Extends ApiClient to access the private makeRequest method
 */
export class SessionService extends ApiClient {
  constructor() {
    super();
  }

  /**
   * Get current editor session for a document
   * GET /api/v1/documents/{docId}/editor-session
   */
  async getSession(docId: string): Promise<EditorSession> {
    return this['makeRequest']<EditorSession>(`/documents/${docId}/editor-session`);
  }

  /**
   * Create or update editor session
   * PUT /api/v1/documents/{docId}/editor-session
   */
  async updateSession(docId: string, updates: UpdateSessionRequest): Promise<EditorSession> {
    return this['makeRequest']<EditorSession>(`/documents/${docId}/editor-session`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete/end editor session
   * DELETE /api/v1/documents/{docId}/editor-session
   */
  async endSession(docId: string): Promise<void> {
    await this['makeRequest']<void>(`/documents/${docId}/editor-session`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all active sessions for a user
   * GET /api/v1/editor-sessions
   */
  async getUserSessions(): Promise<EditorSession[]> {
    const response = await this['makeRequest']<SessionListResponse>('/editor-sessions');
    return response.sessions;
  }

  /**
   * Update active section in session
   * Convenience method for common operation
   */
  async setActiveSection(docId: string, sectionId: string | null): Promise<EditorSession> {
    return this.updateSession(docId, {
      activeSectionId: sectionId,
    });
  }

  /**
   * Update editor mode (wysiwyg, markdown, preview)
   * Convenience method for mode switching
   */
  async setEditorMode(
    docId: string,
    mode: 'wysiwyg' | 'markdown' | 'preview'
  ): Promise<EditorSession> {
    return this.updateSession(docId, {
      editorMode: mode,
    });
  }

  /**
   * Update scroll position for session restoration
   * Convenience method for scroll tracking
   */
  async updateScrollPosition(docId: string, position: number): Promise<EditorSession> {
    return this.updateSession(docId, {
      scrollPosition: position,
    });
  }

  /**
   * Toggle expanded sections in ToC
   * Convenience method for ToC state management
   */
  async updateExpandedSections(docId: string, expandedSections: string[]): Promise<EditorSession> {
    return this.updateSession(docId, {
      expandedSections,
    });
  }

  /**
   * Configure auto-save settings
   * Convenience method for auto-save management
   */
  async configureAutoSave(
    docId: string,
    enabled: boolean,
    interval?: number
  ): Promise<EditorSession> {
    const updates: UpdateSessionRequest = {
      autoSaveEnabled: enabled,
    };

    if (interval !== undefined) {
      updates.autoSaveInterval = Math.max(interval, 10000); // Minimum 10 seconds
    }

    return this.updateSession(docId, updates);
  }

  /**
   * Toggle diff view mode
   * Convenience method for diff view management
   */
  async toggleDiffView(docId: string): Promise<EditorSession> {
    const session = await this.getSession(docId);
    return this.updateSession(docId, {
      showDiffView: !session.showDiffView,
    });
  }

  /**
   * Initialize session with default settings
   * Creates a new session with sensible defaults
   */
  async initializeSession(
    docId: string,
    options: Partial<CreateSessionRequest> = {}
  ): Promise<EditorSession> {
    const defaultSettings: UpdateSessionRequest = {
      editorMode: 'wysiwyg',
      autoSaveEnabled: true,
      autoSaveInterval: 30000, // 30 seconds
      showDiffView: false,
      expandedSections: [],
      scrollPosition: 0,
      activeSectionId: null,
      ...options,
    };

    return this.updateSession(docId, defaultSettings);
  }

  /**
   * Get collaborator information for a document
   * Extracts collaborator data from session
   */
  async getCollaborators(docId: string): Promise<CollaboratorInfo[]> {
    const session = await this.getSession(docId);

    return session.collaborators.map(collaborator => ({
      ...collaborator,
      isOnline: this.isUserOnline(collaborator.lastActivity),
    }));
  }

  /**
   * Get session metrics and statistics
   * Provides analytics about editor usage
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    const sessions = await this.getUserSessions();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s =>
      this.isUserOnline(s.collaborators[0]?.lastActivity || '')
    ).length;

    // Calculate average session duration (simplified)
    const now = Date.now();
    const durations = sessions.map(session => {
      const lastActivity = session.collaborators[0]?.lastActivity;
      if (!lastActivity) return 0;
      return now - new Date(lastActivity).getTime();
    });

    const averageSessionDuration =
      durations.length > 0
        ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
        : 0;

    const collaboratorCount = sessions.reduce(
      (count, session) => count + session.collaborators.length,
      0
    );

    return {
      totalSessions,
      activeSessions,
      averageSessionDuration,
      collaboratorCount,
    };
  }

  /**
   * Check if user is considered online based on last activity
   * User is online if activity was within last 5 minutes
   */
  private isUserOnline(lastActivity: string): boolean {
    if (!lastActivity) return false;

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const activityTime = new Date(lastActivity).getTime();

    return activityTime > fiveMinutesAgo;
  }

  /**
   * Validate session update request
   * Checks for valid values and constraints
   */
  validateSessionUpdate(updates: UpdateSessionRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate auto-save interval
    if (updates.autoSaveInterval !== undefined) {
      if (updates.autoSaveInterval < 10000) {
        errors.push('Auto-save interval must be at least 10 seconds (10000ms)');
      }
    }

    // Validate editor mode
    if (updates.editorMode !== undefined) {
      const validModes = ['wysiwyg', 'markdown', 'preview'];
      if (!validModes.includes(updates.editorMode)) {
        errors.push(`Invalid editor mode: ${updates.editorMode}`);
      }
    }

    // Validate scroll position
    if (updates.scrollPosition !== undefined) {
      if (updates.scrollPosition < 0) {
        errors.push('Scroll position cannot be negative');
      }
    }

    // Validate expanded sections array
    if (updates.expandedSections !== undefined) {
      if (!Array.isArray(updates.expandedSections)) {
        errors.push('Expanded sections must be an array');
      } else {
        const invalidIds = updates.expandedSections.filter(
          id => typeof id !== 'string' || id.trim().length === 0
        );
        if (invalidIds.length > 0) {
          errors.push('All expanded section IDs must be non-empty strings');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update session with validation
   * Validates update request before making API call
   */
  async updateSessionValidated(
    docId: string,
    updates: UpdateSessionRequest
  ): Promise<EditorSession> {
    const validation = this.validateSessionUpdate(updates);

    if (!validation.valid) {
      throw new Error(`Invalid session update: ${validation.errors.join(', ')}`);
    }

    return this.updateSession(docId, updates);
  }

  /**
   * Batch update session with multiple operations
   * Combines multiple updates into a single API call
   */
  async batchUpdateSession(
    docId: string,
    operations: Array<{
      type:
        | 'setActiveSection'
        | 'setEditorMode'
        | 'updateScroll'
        | 'configureAutoSave'
        | 'toggleDiff';
      params: Record<string, unknown>;
    }>
  ): Promise<EditorSession> {
    const updates: UpdateSessionRequest = {};

    // Process each operation and merge into single update
    operations.forEach(({ type, params }) => {
      switch (type) {
        case 'setActiveSection':
          updates.activeSectionId = params.sectionId as string | null;
          break;
        case 'setEditorMode':
          updates.editorMode = params.mode as 'wysiwyg' | 'markdown' | 'preview';
          break;
        case 'updateScroll':
          updates.scrollPosition = params.position as number;
          break;
        case 'configureAutoSave':
          updates.autoSaveEnabled = params.enabled as boolean;
          if (params.interval !== undefined) {
            updates.autoSaveInterval = params.interval as number;
          }
          break;
        case 'toggleDiff':
          // Need current state for toggle - this operation requires a separate call
          break;
      }
    });

    return this.updateSessionValidated(docId, updates);
  }
}

/**
 * Factory function to create a SessionService instance
 */
export function createSessionService(): SessionService {
  return new SessionService();
}

// Export types for external use
export type { EditorSession, EditorSessionUpdate };
