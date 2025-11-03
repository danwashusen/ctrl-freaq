/**
 * Editor Store - Core editing state management
 *
 * Manages editor-specific state including active section, mode transitions,
 * and editing operations. Uses Zustand with Immer for immutable updates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { SectionView, SectionViewUpdate } from '../types/section-view';

interface EditorStoreState {
  // Current editing state
  activeSectionId: string | null;
  isEditing: boolean;

  // Section states - normalized by ID
  sections: Record<string, SectionView>;

  // UI state
  showDiffView: boolean;
  pendingChangesCount: number;
  lastSaveTime: number | null;

  // Actions
  loadSection: (section: SectionView) => void;
  loadSections: (sections: SectionView[]) => void;
  setActiveSection: (sectionId: string | null) => void;
  enterEditMode: (sectionId: string) => void;
  exitEditMode: (sectionId: string) => void;
  cancelEditing: (sectionId: string) => void;
  updateSection: (update: SectionViewUpdate) => void;
  markAsSaving: (sectionId: string) => void;
  markAsSaved: (sectionId: string, timestamp?: number) => void;
  toggleDiffView: (forceValue?: boolean) => void;
  setDiffView: (value: boolean) => void;
  incrementPendingChanges: () => void;
  decrementPendingChanges: () => void;
  resetPendingChanges: () => void;
  setDraftMetadata: (
    sectionId: string,
    payload: {
      draftId?: string | null;
      draftVersion?: number | null;
      draftBaseVersion?: number | null;
      latestApprovedVersion?: number | null;
    }
  ) => void;
  setConflictState: (
    sectionId: string,
    payload: {
      conflictState: SectionView['conflictState'];
      conflictReason?: string | null;
      latestApprovedVersion?: number | null;
    }
  ) => void;
  recordManualSave: (
    sectionId: string,
    payload: {
      lastSavedAt?: string | null;
      lastSavedBy?: string | null;
      lastManualSaveAt?: number | null;
      summaryNote?: string | null;
    }
  ) => void;
  setApprovalMetadata: (
    sectionId: string,
    payload: {
      approvedVersion: number;
      approvedAt: string;
      approvedBy: string;
      lastSummary?: string | null;
      contentMarkdown?: string;
    }
  ) => void;
  applyConflictEvent: (
    payload: {
      sectionId: string;
      conflictState: SectionView['conflictState'];
      conflictReason?: string | null;
      latestApprovedVersion?: number | null;
    }
  ) => void;
  applyDiffEvent: (
    payload: {
      sectionId: string;
      draftVersion?: number | null;
      draftBaseVersion?: number | null;
      approvedVersion?: number | null;
    }
  ) => void;
  reset: () => void;
}

const initialState = {
  activeSectionId: null,
  isEditing: false,
  sections: {},
  showDiffView: false,
  pendingChangesCount: 0,
  lastSaveTime: null,
};

export const useEditorStore = create<EditorStoreState>()(
  devtools(
    immer(set => ({
      ...initialState,

      loadSection: (section: SectionView) => {
        set(state => {
          state.sections[section.id] = section;
        });
      },

      loadSections: (sections: SectionView[]) => {
        set(state => {
          // Clear existing sections
          state.sections = {};
          // Load new sections
          sections.forEach(section => {
            state.sections[section.id] = section;
          });
        });
      },

      setActiveSection: (sectionId: string | null) => {
        set(state => {
          state.activeSectionId = sectionId;
          // Auto-determine if we're editing based on section state
          if (sectionId && state.sections[sectionId]) {
            const section = state.sections[sectionId];
            state.isEditing = section.viewState === 'edit_mode';
          } else {
            state.isEditing = false;
          }
        });
      },

      enterEditMode: (sectionId: string) => {
        set(state => {
          // Exit edit mode for any other sections first
          Object.values(state.sections).forEach(section => {
            if (section.id !== sectionId && section.viewState === 'edit_mode') {
              section.viewState = 'read_mode';
            }
          });

          // Enter edit mode for target section
          if (state.sections[sectionId]) {
            state.sections[sectionId].viewState = 'edit_mode';
            state.sections[sectionId].editingUser = 'current_user'; // TODO: Get from auth context
            state.activeSectionId = sectionId;
            state.isEditing = true;
          }
        });
      },

      exitEditMode: (sectionId: string) => {
        set(state => {
          if (state.sections[sectionId]) {
            state.sections[sectionId].viewState = 'read_mode';
            state.sections[sectionId].editingUser = null;

            // If this was the active section, clear editing state
            if (state.activeSectionId === sectionId) {
              state.isEditing = false;
            }
          }
        });
      },

      cancelEditing: (sectionId: string) => {
        set(state => {
          if (state.sections[sectionId]) {
            // Revert to read mode without saving
            state.sections[sectionId].viewState = 'read_mode';
            state.sections[sectionId].editingUser = null;

            // If this was the active section, clear editing state
            if (state.activeSectionId === sectionId) {
              state.isEditing = false;
            }
          }
        });
      },

      updateSection: (update: SectionViewUpdate) => {
        set(state => {
          const section = state.sections[update.id];
          if (section) {
            // Update only provided fields
            Object.assign(section, update);

            // Update timestamp when content changes
            if (update.contentMarkdown !== undefined) {
              section.lastModified = new Date().toISOString();
            }
          }
        });
      },

      markAsSaving: (sectionId: string) => {
        set(state => {
          if (state.sections[sectionId]) {
            state.sections[sectionId].viewState = 'saving';
          }
        });
      },

      markAsSaved: (sectionId: string, timestamp?: number) => {
        set(state => {
          if (state.sections[sectionId]) {
            state.sections[sectionId].viewState = 'read_mode';
            state.sections[sectionId].editingUser = null;
            state.sections[sectionId].lastModified = new Date().toISOString();
            state.lastSaveTime = timestamp ?? Date.now();

            // If this was the active section, clear editing state
            if (state.activeSectionId === sectionId) {
              state.isEditing = false;
            }
          }
        });
      },

      toggleDiffView: forceValue => {
        set(state => {
          state.showDiffView = typeof forceValue === 'boolean' ? forceValue : !state.showDiffView;
        });
      },

      setDiffView: value => {
        set(state => {
          state.showDiffView = value;
        });
      },

      incrementPendingChanges: () => {
        set(state => {
          state.pendingChangesCount += 1;
        });
      },

      decrementPendingChanges: () => {
        set(state => {
          state.pendingChangesCount = Math.max(0, state.pendingChangesCount - 1);
        });
      },

      resetPendingChanges: () => {
        set(state => {
          state.pendingChangesCount = 0;
        });
      },

      setDraftMetadata: (sectionId, payload) => {
        set(state => {
          const section = state.sections[sectionId];
          if (!section) return;

          if (payload.draftId !== undefined) {
            section.draftId = payload.draftId;
          }
          if (payload.draftVersion !== undefined) {
            section.draftVersion = payload.draftVersion;
          }
          if (payload.draftBaseVersion !== undefined) {
            section.draftBaseVersion = payload.draftBaseVersion;
          }
          if (payload.latestApprovedVersion !== undefined) {
            section.latestApprovedVersion = payload.latestApprovedVersion;
          }
        });
      },

      setConflictState: (sectionId, payload) => {
        set(state => {
          const section = state.sections[sectionId];
          if (!section) return;

          section.conflictState = payload.conflictState;
          section.conflictReason = payload.conflictReason ?? null;
          if (payload.latestApprovedVersion !== undefined) {
            section.latestApprovedVersion = payload.latestApprovedVersion;
          }
        });
      },

      recordManualSave: (sectionId, payload) => {
        set(state => {
          const section = state.sections[sectionId];
          if (!section) return;

          if (payload.lastSavedAt !== undefined) {
            section.lastSavedAt = payload.lastSavedAt;
          }
          if (payload.lastSavedBy !== undefined) {
            section.lastSavedBy = payload.lastSavedBy;
          }
          if (payload.lastManualSaveAt !== undefined) {
            section.lastManualSaveAt = payload.lastManualSaveAt;
          }
          if (payload.summaryNote !== undefined) {
            section.summaryNote = payload.summaryNote;
          }
        });
      },

      setApprovalMetadata: (sectionId, payload) => {
        set(state => {
          const section = state.sections[sectionId];
          if (!section) return;

          section.approvedVersion = payload.approvedVersion;
          section.approvedAt = payload.approvedAt;
          section.approvedBy = payload.approvedBy;
          section.status = 'ready';
          section.lastSummary = payload.lastSummary ?? section.lastSummary;
          if (payload.contentMarkdown) {
            section.contentMarkdown = payload.contentMarkdown;
            section.hasContent = payload.contentMarkdown.trim().length > 0;
          }
          section.conflictState = 'clean';
          section.conflictReason = null;
        });
      },

      applyConflictEvent: payload => {
        set(state => {
          const section = state.sections[payload.sectionId];
          if (!section) return;

          section.conflictState = payload.conflictState;
          section.conflictReason = payload.conflictReason ?? null;
          if (payload.latestApprovedVersion !== undefined) {
            section.latestApprovedVersion = payload.latestApprovedVersion;
          }
          if (payload.conflictState === 'clean' || payload.conflictState === 'rebased') {
            section.conflictReason = null;
          }
        });
      },

      applyDiffEvent: payload => {
        set(state => {
          const section = state.sections[payload.sectionId];
          if (!section) return;

          if (payload.draftVersion !== undefined) {
            section.draftVersion = payload.draftVersion;
          }
          if (payload.draftBaseVersion !== undefined) {
            section.draftBaseVersion = payload.draftBaseVersion;
          }
          if (payload.approvedVersion !== undefined) {
            section.approvedVersion = payload.approvedVersion;
          }
        });
      },

      reset: () => {
        set({ ...initialState });
      },
    })),
    {
      name: 'editor-store',
    }
  )
);

// Selectors for common queries
export const selectActiveSection = (state: EditorStoreState) =>
  state.activeSectionId ? state.sections[state.activeSectionId] : null;

export const selectSectionsByStatus =
  (status: SectionView['status']) => (state: EditorStoreState) =>
    Object.values(state.sections).filter(section => section.status === status);

export const selectEditingSections = (state: EditorStoreState) =>
  Object.values(state.sections).filter(section => section.viewState === 'edit_mode');

export const selectHasPendingChanges = (state: EditorStoreState) => state.pendingChangesCount > 0;
