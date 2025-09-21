/**
 * Session Store - Editor session state management
 *
 * Manages user session state including preferences, navigation,
 * collaboration, and auto-save settings. Uses Zustand with Immer.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type {
  EditorSession,
  EditorMode,
  Collaborator,
  CreateEditorSession,
  EditorSessionUpdate,
  NavigationState,
  EditorPreferences,
} from '../types/editor-session';

interface SessionStoreState {
  // Current session
  session: EditorSession | null;
  isSessionActive: boolean;

  // Auto-save management
  autoSaveTimer: number | null;
  lastAutoSave: number | null;
  autoSaveInProgress: boolean;

  // Collaboration state
  collaboratorActivity: Record<string, number>; // userId -> lastActivity timestamp

  // Performance tracking
  navigationMetrics: {
    averageNavigationTime: number;
    totalNavigations: number;
    lastNavigationTime: number | null;
  };

  // Actions
  createSession: (config: CreateEditorSession) => EditorSession;
  updateSession: (updates: EditorSessionUpdate) => void;
  endSession: () => void;
  restoreSession: (session: EditorSession) => void;

  // Navigation management
  setActiveSection: (sectionId: string | null) => void;
  updateScrollPosition: (position: number) => void;
  setExpandedSections: (sections: string[]) => void;
  addExpandedSection: (sectionId: string) => void;
  removeExpandedSection: (sectionId: string) => void;

  // Editor preferences
  setEditorMode: (mode: EditorMode) => void;
  toggleDiffView: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;

  // Collaboration
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (userId: string) => void;
  updateCollaboratorActivity: (userId: string, sectionId: string | null) => void;
  getActiveCollaborators: () => Collaborator[];

  // Performance tracking
  recordNavigationTime: (duration: number) => void;
  updateLastSaveTime: (duration: number) => void;
  incrementPendingChanges: () => void;
  decrementPendingChanges: () => void;
  resetPendingChanges: () => void;

  // Auto-save management
  startAutoSave: () => void;
  stopAutoSave: () => void;
  triggerAutoSave: () => Promise<void>;

  // Utility
  getNavigationState: () => NavigationState;
  getEditorPreferences: () => EditorPreferences;
  generateSessionId: () => string;
  isSessionExpired: () => boolean;
  reset: () => void;
}

const initialState = {
  session: null,
  isSessionActive: false,
  autoSaveTimer: null,
  lastAutoSave: null,
  autoSaveInProgress: false,
  collaboratorActivity: {},
  navigationMetrics: {
    averageNavigationTime: 0,
    totalNavigations: 0,
    lastNavigationTime: null,
  },
};

export const useSessionStore = create<SessionStoreState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        createSession: (config: CreateEditorSession) => {
          const sessionId = config.sessionId ?? get().generateSessionId();
          const session: EditorSession = {
            documentId: config.documentId,
            userId: config.userId,
            sessionId,
            activeSectionId: null,
            expandedSections: [],
            scrollPosition: 0,
            editorMode: config.editorMode ?? 'wysiwyg',
            showDiffView: false,
            autoSaveEnabled: config.autoSaveEnabled ?? true,
            autoSaveInterval: config.autoSaveInterval ?? 30000, // 30 seconds default
            collaborators: [],
            lastSaveTime: 0,
            pendingChangeCount: 0,
          };

          set(state => {
            state.session = session;
            state.isSessionActive = true;
            state.lastAutoSave = Date.now();
          });

          // Start auto-save if enabled
          if (session.autoSaveEnabled) {
            get().startAutoSave();
          }

          return session;
        },

        updateSession: (updates: EditorSessionUpdate) => {
          set(state => {
            if (!state.session || state.session.sessionId !== updates.sessionId) {
              return;
            }

            // Update session properties
            Object.assign(state.session, updates);

            // Handle auto-save changes
            if (updates.autoSaveEnabled !== undefined || updates.autoSaveInterval !== undefined) {
              if (state.session.autoSaveEnabled) {
                get().startAutoSave();
              } else {
                get().stopAutoSave();
              }
            }
          });
        },

        endSession: () => {
          set(state => {
            state.isSessionActive = false;
          });

          get().stopAutoSave();
        },

        restoreSession: (session: EditorSession) => {
          set(state => {
            state.session = session;
            state.isSessionActive = true;
            state.lastAutoSave = Date.now();
          });

          if (session.autoSaveEnabled) {
            get().startAutoSave();
          }
        },

        setActiveSection: (sectionId: string | null) => {
          set(state => {
            if (state.session) {
              state.session.activeSectionId = sectionId;
            }
          });
        },

        updateScrollPosition: (position: number) => {
          set(state => {
            if (state.session) {
              state.session.scrollPosition = position;
            }
          });
        },

        setExpandedSections: (sections: string[]) => {
          set(state => {
            if (state.session) {
              state.session.expandedSections = sections;
            }
          });
        },

        addExpandedSection: (sectionId: string) => {
          set(state => {
            if (state.session && !state.session.expandedSections.includes(sectionId)) {
              state.session.expandedSections.push(sectionId);
            }
          });
        },

        removeExpandedSection: (sectionId: string) => {
          set(state => {
            if (state.session) {
              const index = state.session.expandedSections.indexOf(sectionId);
              if (index !== -1) {
                state.session.expandedSections.splice(index, 1);
              }
            }
          });
        },

        setEditorMode: (mode: EditorMode) => {
          set(state => {
            if (state.session) {
              state.session.editorMode = mode;
            }
          });
        },

        toggleDiffView: () => {
          set(state => {
            if (state.session) {
              state.session.showDiffView = !state.session.showDiffView;
            }
          });
        },

        setAutoSaveEnabled: (enabled: boolean) => {
          set(state => {
            if (state.session) {
              state.session.autoSaveEnabled = enabled;
            }
          });

          if (enabled) {
            get().startAutoSave();
          } else {
            get().stopAutoSave();
          }
        },

        setAutoSaveInterval: (interval: number) => {
          // Validate minimum interval (10 seconds)
          const validInterval = Math.max(interval, 10000);

          set(state => {
            if (state.session) {
              state.session.autoSaveInterval = validInterval;
            }
          });

          // Restart auto-save with new interval
          if (get().session?.autoSaveEnabled) {
            get().stopAutoSave();
            get().startAutoSave();
          }
        },

        addCollaborator: (collaborator: Collaborator) => {
          set(state => {
            if (state.session) {
              const existingIndex = state.session.collaborators.findIndex(
                c => c.userId === collaborator.userId
              );

              if (existingIndex !== -1) {
                // Update existing collaborator
                state.session.collaborators[existingIndex] = collaborator;
              } else {
                // Add new collaborator (max 10 per MVP limit)
                if (state.session.collaborators.length < 10) {
                  state.session.collaborators.push(collaborator);
                }
              }
            }

            // Track activity
            state.collaboratorActivity[collaborator.userId] = Date.now();
          });
        },

        removeCollaborator: (userId: string) => {
          set(state => {
            if (state.session) {
              const index = state.session.collaborators.findIndex(c => c.userId === userId);
              if (index !== -1) {
                state.session.collaborators.splice(index, 1);
              }
            }

            delete state.collaboratorActivity[userId];
          });
        },

        updateCollaboratorActivity: (userId: string, sectionId: string | null) => {
          set(state => {
            if (state.session) {
              const collaborator = state.session.collaborators.find(c => c.userId === userId);
              if (collaborator) {
                collaborator.activeSectionId = sectionId;
                collaborator.lastActivity = new Date().toISOString();
              }
            }

            state.collaboratorActivity[userId] = Date.now();
          });
        },

        getActiveCollaborators: () => {
          const state = get();
          if (!state.session) return [];

          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          return state.session.collaborators.filter(collaborator => {
            const lastActivity = state.collaboratorActivity[collaborator.userId] ?? 0;
            return lastActivity > fiveMinutesAgo;
          });
        },

        recordNavigationTime: (duration: number) => {
          set(state => {
            const metrics = state.navigationMetrics;
            metrics.totalNavigations += 1;
            metrics.averageNavigationTime =
              (metrics.averageNavigationTime * (metrics.totalNavigations - 1) + duration) /
              metrics.totalNavigations;
            metrics.lastNavigationTime = Date.now();
          });
        },

        updateLastSaveTime: (duration: number) => {
          set(state => {
            if (state.session) {
              state.session.lastSaveTime = duration;
            }
            state.lastAutoSave = Date.now();
            state.autoSaveInProgress = false;
          });
        },

        incrementPendingChanges: () => {
          set(state => {
            if (state.session) {
              state.session.pendingChangeCount += 1;
            }
          });
        },

        decrementPendingChanges: () => {
          set(state => {
            if (state.session) {
              state.session.pendingChangeCount = Math.max(0, state.session.pendingChangeCount - 1);
            }
          });
        },

        resetPendingChanges: () => {
          set(state => {
            if (state.session) {
              state.session.pendingChangeCount = 0;
            }
          });
        },

        startAutoSave: () => {
          const state = get();
          if (!state.session?.autoSaveEnabled || state.autoSaveTimer) {
            return;
          }

          const timer = window.setInterval(() => {
            get().triggerAutoSave();
          }, state.session.autoSaveInterval);

          set(state => {
            state.autoSaveTimer = timer;
          });
        },

        stopAutoSave: () => {
          set(state => {
            if (state.autoSaveTimer) {
              clearInterval(state.autoSaveTimer);
              state.autoSaveTimer = null;
            }
          });
        },

        triggerAutoSave: async () => {
          const state = get();
          if (
            !state.session ||
            state.autoSaveInProgress ||
            state.session.pendingChangeCount === 0
          ) {
            return;
          }

          set(state => {
            state.autoSaveInProgress = true;
          });

          try {
            // This would integrate with the API service
            // For now, just simulate a save operation
            await new Promise(resolve => setTimeout(resolve, 100));

            get().updateLastSaveTime(100);
            get().resetPendingChanges();
          } catch {
            // TODO: Replace with proper logger in Phase 3.7
            // console.error('Auto-save failed:', error);
            set(state => {
              state.autoSaveInProgress = false;
            });
          }
        },

        getNavigationState: () => {
          const state = get();
          return {
            activeSectionId: state.session?.activeSectionId ?? null,
            expandedSections: state.session?.expandedSections ?? [],
            scrollPosition: state.session?.scrollPosition ?? 0,
          };
        },

        getEditorPreferences: () => {
          const state = get();
          return {
            editorMode: state.session?.editorMode ?? 'wysiwyg',
            showDiffView: state.session?.showDiffView ?? false,
            autoSaveEnabled: state.session?.autoSaveEnabled ?? true,
            autoSaveInterval: state.session?.autoSaveInterval ?? 30000,
          };
        },

        generateSessionId: () => {
          return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        },

        isSessionExpired: () => {
          const state = get();
          if (!state.session || !state.lastAutoSave) return false;

          // Consider session expired if no activity for 30 minutes
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
          return state.lastAutoSave < thirtyMinutesAgo;
        },

        reset: () => {
          get().stopAutoSave();
          set({ ...initialState });
        },
      })),
      {
        name: 'session-store',
        // Only persist certain preferences, not the entire session
        partialize: state => ({
          session: state.session
            ? {
                editorMode: state.session.editorMode,
                showDiffView: state.session.showDiffView,
                autoSaveEnabled: state.session.autoSaveEnabled,
                autoSaveInterval: state.session.autoSaveInterval,
              }
            : null,
          navigationMetrics: state.navigationMetrics,
        }),
      }
    ),
    {
      name: 'session-store',
    }
  )
);

// Selectors for common queries
export const selectSession = (state: SessionStoreState) => state.session;

export const selectIsSessionActive = (state: SessionStoreState) => state.isSessionActive;

export const selectNavigationState = (state: SessionStoreState) => state.getNavigationState();

export const selectEditorPreferences = (state: SessionStoreState) => state.getEditorPreferences();

export const selectActiveCollaborators = (state: SessionStoreState) =>
  state.getActiveCollaborators();

export const selectNavigationMetrics = (state: SessionStoreState) => state.navigationMetrics;
