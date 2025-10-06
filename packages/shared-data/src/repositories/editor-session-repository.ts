import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from './base-repository.js';
import type { QueryOptions } from '../types/index.js';

/**
 * Collaborator schema for editor sessions
 */
export const CollaboratorSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
  activeSectionId: z.string().uuid().nullable(),
  lastActivity: z.date(),
});

export type Collaborator = z.infer<typeof CollaboratorSchema>;

/**
 * EditorSession entity schema
 * Manages the active editing session state
 */
export const EditorSessionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid('Invalid document ID format'),
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),

  // Navigation state
  activeSectionId: z.string().uuid().nullable(),
  expandedSections: z.array(z.string().uuid()),
  scrollPosition: z.number().min(0),

  // Editor configuration
  editorMode: z.enum(['wysiwyg', 'markdown', 'preview']),
  showDiffView: z.boolean(),
  autoSaveEnabled: z.boolean(),
  autoSaveInterval: z.number().int().min(10000), // Minimum 10 seconds

  // Collaboration
  collaborators: z.array(CollaboratorSchema).max(10, 'Maximum 10 collaborators allowed'),

  // Performance metrics
  lastSaveTime: z.number().min(0),
  pendingChangeCount: z.number().int().min(0),

  // Base entity fields
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EditorSession = z.infer<typeof EditorSessionSchema>;

/**
 * Input schema for creating an editor session
 */
export const CreateEditorSessionSchema = EditorSessionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEditorSessionInput = z.infer<typeof CreateEditorSessionSchema>;

/**
 * Update schema for editor session (partial updates)
 */
export const UpdateEditorSessionSchema = z.object({
  activeSectionId: z.string().uuid().nullable().optional(),
  expandedSections: z.array(z.string().uuid()).optional(),
  scrollPosition: z.number().min(0).optional(),
  editorMode: z.enum(['wysiwyg', 'markdown', 'preview']).optional(),
  showDiffView: z.boolean().optional(),
  autoSaveEnabled: z.boolean().optional(),
  autoSaveInterval: z.number().int().min(10000).optional(),
});

export type UpdateEditorSessionInput = z.infer<typeof UpdateEditorSessionSchema>;

/**
 * Query options for editor session-specific queries
 */
export interface EditorSessionQueryOptions extends QueryOptions {
  documentId?: string;
  userId?: string;
  activeOnly?: boolean;
  lastActivityAfter?: Date;
  lastActivityBefore?: Date;
}

/**
 * Editor session repository interface
 */
export interface EditorSessionRepository {
  findById(id: string): Promise<EditorSession | null>;
  findAll(options?: EditorSessionQueryOptions): Promise<EditorSession[]>;
  create(session: CreateEditorSessionInput): Promise<EditorSession>;
  update(id: string, updates: Partial<EditorSession>): Promise<EditorSession>;
  delete(id: string, deletedBy: string): Promise<boolean>;

  // Document-specific queries
  findByDocumentId(documentId: string): Promise<EditorSession[]>;
  findByUserId(userId: string, options?: QueryOptions): Promise<EditorSession[]>;
  findByDocumentAndUser(documentId: string, userId: string): Promise<EditorSession | null>;

  // Session management
  createOrUpdateSession(session: CreateEditorSessionInput): Promise<EditorSession>;
  updateNavigation(
    sessionId: string,
    activeSectionId: string | null,
    scrollPosition?: number
  ): Promise<EditorSession>;
  updateExpandedSections(sessionId: string, expandedSections: string[]): Promise<EditorSession>;
  updateEditorConfig(sessionId: string, config: UpdateEditorSessionInput): Promise<EditorSession>;

  // Collaboration
  addCollaborator(sessionId: string, collaborator: Collaborator): Promise<EditorSession>;
  removeCollaborator(sessionId: string, userId: string): Promise<EditorSession>;
  updateCollaboratorActivity(
    sessionId: string,
    userId: string,
    activeSectionId: string | null
  ): Promise<EditorSession>;

  // Performance tracking
  updateSaveMetrics(
    sessionId: string,
    saveTime: number,
    pendingChangeCount: number
  ): Promise<EditorSession>;

  // Cleanup operations
  cleanupInactiveSessions(inactiveThresholdHours: number): Promise<number>;
  clearUserSessions(userId: string): Promise<number>;
}

/**
 * Editor session repository implementation
 */
export class EditorSessionRepositoryImpl
  extends BaseRepository<EditorSession>
  implements EditorSessionRepository
{
  constructor(db: Database.Database) {
    super(db, 'editor_sessions', EditorSessionSchema);
  }

  /**
   * Find sessions by document ID
   */
  async findByDocumentId(documentId: string): Promise<EditorSession[]> {
    return this.findAll({
      where: { document_id: documentId },
      orderBy: 'updated_at',
      orderDirection: 'DESC',
    });
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId: string, options: QueryOptions = {}): Promise<EditorSession[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, user_id: userId },
      orderBy: 'updated_at',
      orderDirection: 'DESC',
    });
  }

  /**
   * Find session by document and user (should be unique)
   */
  async findByDocumentAndUser(documentId: string, userId: string): Promise<EditorSession | null> {
    const sessions = await this.findAll({
      where: { document_id: documentId, user_id: userId },
      limit: 1,
    });

    return sessions[0] || null;
  }

  /**
   * Create new session or update existing one for document+user combination
   */
  async createOrUpdateSession(session: CreateEditorSessionInput): Promise<EditorSession> {
    const existing = await this.findByDocumentAndUser(session.documentId, session.userId);

    if (existing) {
      // Update existing session
      return this.update(existing.id, {
        sessionId: session.sessionId,
        activeSectionId: session.activeSectionId,
        expandedSections: session.expandedSections,
        scrollPosition: session.scrollPosition,
        editorMode: session.editorMode,
        showDiffView: session.showDiffView,
        autoSaveEnabled: session.autoSaveEnabled,
        autoSaveInterval: session.autoSaveInterval,
      });
    } else {
      // Create new session
      return this.create(session);
    }
  }

  /**
   * Update navigation state
   */
  async updateNavigation(
    sessionId: string,
    activeSectionId: string | null,
    scrollPosition?: number
  ): Promise<EditorSession> {
    const updates: Partial<EditorSession> = { activeSectionId };

    if (scrollPosition !== undefined) {
      updates.scrollPosition = scrollPosition;
    }

    return this.update(sessionId, updates);
  }

  /**
   * Update expanded sections
   */
  async updateExpandedSections(
    sessionId: string,
    expandedSections: string[]
  ): Promise<EditorSession> {
    return this.update(sessionId, { expandedSections });
  }

  /**
   * Update editor configuration
   */
  async updateEditorConfig(
    sessionId: string,
    config: UpdateEditorSessionInput
  ): Promise<EditorSession> {
    return this.update(sessionId, config);
  }

  /**
   * Add collaborator to session
   */
  async addCollaborator(sessionId: string, collaborator: Collaborator): Promise<EditorSession> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Editor session not found: ${sessionId}`);
    }

    // Remove existing collaborator with same userId if present
    const collaborators = session.collaborators.filter(c => c.userId !== collaborator.userId);

    // Add new collaborator
    collaborators.push(collaborator);

    return this.update(sessionId, { collaborators });
  }

  /**
   * Remove collaborator from session
   */
  async removeCollaborator(sessionId: string, userId: string): Promise<EditorSession> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Editor session not found: ${sessionId}`);
    }

    const collaborators = session.collaborators.filter(c => c.userId !== userId);

    return this.update(sessionId, { collaborators });
  }

  /**
   * Update collaborator activity
   */
  async updateCollaboratorActivity(
    sessionId: string,
    userId: string,
    activeSectionId: string | null
  ): Promise<EditorSession> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Editor session not found: ${sessionId}`);
    }

    const collaborators = session.collaborators.map(c => {
      if (c.userId === userId) {
        return {
          ...c,
          activeSectionId,
          lastActivity: new Date(),
        };
      }
      return c;
    });

    return this.update(sessionId, { collaborators });
  }

  /**
   * Update save performance metrics
   */
  async updateSaveMetrics(
    sessionId: string,
    saveTime: number,
    pendingChangeCount: number
  ): Promise<EditorSession> {
    return this.update(sessionId, {
      lastSaveTime: saveTime,
      pendingChangeCount,
    });
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(inactiveThresholdHours: number): Promise<number> {
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - inactiveThresholdHours);

    const query = `DELETE FROM ${this.tableName} WHERE updated_at < ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(thresholdDate.toISOString());

    return result.changes;
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(userId: string): Promise<number> {
    const query = `DELETE FROM ${this.tableName} WHERE user_id = ?`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(userId);

    return result.changes;
  }

  /**
   * Override to handle JSON serialization of arrays
   */
  protected override mapEntityToRow(entity: EditorSession): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);

    // Serialize arrays as JSON
    if (entity.expandedSections) {
      row.expanded_sections = JSON.stringify(entity.expandedSections);
    }

    if (entity.collaborators) {
      // Convert collaborator dates to ISO strings before serialization
      const collaboratorsForStorage = entity.collaborators.map(c => ({
        ...c,
        lastActivity: c.lastActivity.toISOString(),
      }));
      row.collaborators = JSON.stringify(collaboratorsForStorage);
    }

    return row;
  }

  /**
   * Override to handle JSON parsing of arrays
   */
  protected override mapRowToEntity(row: Record<string, unknown>): EditorSession {
    // Parse expanded sections JSON
    if (row.expanded_sections && typeof row.expanded_sections === 'string') {
      try {
        row.expanded_sections = JSON.parse(row.expanded_sections);
      } catch {
        row.expanded_sections = [];
      }
    } else if (!row.expanded_sections) {
      row.expanded_sections = [];
    }

    // Parse collaborators JSON
    if (row.collaborators && typeof row.collaborators === 'string') {
      try {
        const parsed = JSON.parse(row.collaborators) as Array<
          Collaborator & { lastActivity: string }
        >;
        // Convert lastActivity strings back to dates
        row.collaborators = parsed.map(c => ({
          ...c,
          lastActivity: new Date(c.lastActivity),
        }));
      } catch {
        row.collaborators = [];
      }
    } else if (!row.collaborators) {
      row.collaborators = [];
    }

    // Handle boolean conversion from SQLite
    if (typeof row.show_diff_view === 'number') {
      row.show_diff_view = Boolean(row.show_diff_view);
    }
    if (typeof row.auto_save_enabled === 'number') {
      row.auto_save_enabled = Boolean(row.auto_save_enabled);
    }

    return super.mapRowToEntity(row);
  }
}

/**
 * Validation functions
 */
export const validateEditorSession = (data: unknown): EditorSession => {
  return EditorSessionSchema.parse(data);
};

export const validateCreateEditorSession = (data: unknown): CreateEditorSessionInput => {
  return CreateEditorSessionSchema.parse(data);
};

export const validateUpdateEditorSession = (data: unknown): UpdateEditorSessionInput => {
  return UpdateEditorSessionSchema.parse(data);
};

export const validateCollaborator = (data: unknown): Collaborator => {
  return CollaboratorSchema.parse(data);
};

/**
 * Editor session utility functions
 */
export const EditorSessionUtils = {
  /**
   * Check if session is active (updated recently)
   */
  isActive(session: EditorSession, thresholdMinutes: number = 30): boolean {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - thresholdMinutes);
    return session.updatedAt > threshold;
  },

  /**
   * Get active collaborators (recently active)
   */
  getActiveCollaborators(session: EditorSession, thresholdMinutes: number = 5): Collaborator[] {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - thresholdMinutes);

    return session.collaborators.filter(c => c.lastActivity > threshold);
  },

  /**
   * Check if user is currently collaborating on session
   */
  isCollaborating(session: EditorSession, userId: string): boolean {
    return session.collaborators.some(c => c.userId === userId);
  },

  /**
   * Get collaborator working on specific section
   */
  getCollaboratorOnSection(session: EditorSession, sectionId: string): Collaborator | null {
    return session.collaborators.find(c => c.activeSectionId === sectionId) || null;
  },

  /**
   * Check if section is being edited by another user
   */
  isSectionLocked(session: EditorSession, sectionId: string, currentUserId: string): boolean {
    const collaborator = EditorSessionUtils.getCollaboratorOnSection(session, sectionId);
    return collaborator !== null && collaborator.userId !== currentUserId;
  },

  /**
   * Create default editor session
   */
  createDefault(documentId: string, userId: string, sessionId: string): CreateEditorSessionInput {
    return {
      documentId,
      userId,
      sessionId,
      activeSectionId: null,
      expandedSections: [],
      scrollPosition: 0,
      editorMode: 'wysiwyg' as const,
      showDiffView: false,
      autoSaveEnabled: true,
      autoSaveInterval: 30000,
      collaborators: [],
      lastSaveTime: 0,
      pendingChangeCount: 0,
    };
  },

  /**
   * Calculate session duration in minutes
   */
  getSessionDuration(session: EditorSession): number {
    const durationMs = session.updatedAt.getTime() - session.createdAt.getTime();
    return Math.floor(durationMs / (1000 * 60));
  },

  /**
   * Check if auto-save is due
   */
  isAutoSaveDue(session: EditorSession): boolean {
    if (!session.autoSaveEnabled) return false;

    const now = Date.now();
    const timeSinceUpdate = now - session.updatedAt.getTime();

    return timeSinceUpdate >= session.autoSaveInterval;
  },

  /**
   * Generate session summary for display
   */
  generateSummary(session: EditorSession): string {
    const activeCollaborators = EditorSessionUtils.getActiveCollaborators(session);
    const duration = EditorSessionUtils.getSessionDuration(session);

    let summary = `Session ${session.sessionId} (${duration}min)`;

    if (activeCollaborators.length > 0) {
      const names = activeCollaborators.map(c => c.userName).join(', ');
      summary += ` - Active: ${names}`;
    }

    if (session.pendingChangeCount > 0) {
      summary += ` - ${session.pendingChangeCount} unsaved changes`;
    }

    return summary;
  },
};
