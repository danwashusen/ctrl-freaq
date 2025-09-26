// Simplified section plugin for MVP - will be properly integrated with Milkdown later

import type { PatchDiff } from '@/features/document-editor/types/pending-change';

// Plugin state interface
export interface SectionPluginState {
  isEditing: boolean;
  hasChanges: boolean;
  lastSavedContent: string;
  patches: PatchDiff[];
  editStartTime: number;
  wordCount: number;
  charCount: number;
  selectedText: string;
  collaborators: Array<{
    id: string;
    name: string;
    color: string;
    cursor?: number;
    selection?: { from: number; to: number };
  }>;
}

// Plugin options
export interface SectionPluginOptions {
  sectionId: string;
  userId: string;
  onStateChange?: (state: SectionPluginState) => void;
  onPatchGenerated?: (patches: PatchDiff[]) => void;
  onSaveRequest?: (content: string) => Promise<void>;
  autoSaveInterval?: number;
  trackChanges?: boolean;
  showCollaborators?: boolean;
  readOnly?: boolean;
}

// Simplified plugin for MVP - replaces complex Milkdown plugin
export function createSectionPlugin(options: SectionPluginOptions) {
  const {
    onStateChange,
    onPatchGenerated,
    onSaveRequest,
    autoSaveInterval = 30000,
    trackChanges = true,
  } = options;

  // Return a simple object that can manage state
  return {
    state: {
      isEditing: false,
      hasChanges: false,
      lastSavedContent: '',
      patches: [],
      editStartTime: Date.now(),
      wordCount: 0,
      charCount: 0,
      selectedText: '',
      collaborators: [],
    } as SectionPluginState,

    init: (textarea: HTMLTextAreaElement) => {
      // Set up event listeners
      const state = {
        isEditing: false,
        hasChanges: false,
        lastSavedContent: textarea.value,
        patches: [],
        editStartTime: Date.now(),
        wordCount: 0,
        charCount: 0,
        selectedText: '',
        collaborators: [],
      } as SectionPluginState;

      const updateStats = () => {
        const content = textarea.value;
        state.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        state.charCount = content.length;
      };

      const handleInput = () => {
        const content = textarea.value;
        const hasChanges = content !== state.lastSavedContent;

        if (hasChanges !== state.hasChanges) {
          state.hasChanges = hasChanges;
          if (hasChanges && !state.isEditing) {
            state.isEditing = true;
            state.editStartTime = Date.now();
          }
        }

        updateStats();

        if (trackChanges && hasChanges) {
          const patches: PatchDiff[] = [
            {
              op: 'replace',
              path: '/content',
              value: content,
            },
          ];
          state.patches = [...state.patches, ...patches];
          onPatchGenerated?.(patches);
        }

        onStateChange?.(state);
      };

      const handleSelectionChange = () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        state.selectedText = textarea.value.substring(start, end);
        onStateChange?.(state);
      };

      textarea.addEventListener('input', handleInput);
      textarea.addEventListener('selectionchange', handleSelectionChange);
      textarea.addEventListener('select', handleSelectionChange);

      // Set up auto-save
      let autoSaveTimer: NodeJS.Timeout | null = null;
      if (onSaveRequest && autoSaveInterval > 0) {
        const startAutoSave = () => {
          if (autoSaveTimer) clearTimeout(autoSaveTimer);

          autoSaveTimer = setTimeout(async () => {
            if (state.hasChanges) {
              await onSaveRequest(textarea.value).catch(() => {
                // Auto-save failed - continue silently
              });
              state.lastSavedContent = textarea.value;
              state.hasChanges = false;
              onStateChange?.(state);
            }
            startAutoSave();
          }, autoSaveInterval);
        };

        startAutoSave();
      }

      // Handle manual save (Ctrl+S)
      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          if (state.hasChanges && onSaveRequest) {
            onSaveRequest(textarea.value).catch(() => {
              // Save request failed - ignore
            });
          }
        }
      };

      textarea.addEventListener('keydown', handleKeyDown);

      // Initial stats
      updateStats();
      onStateChange?.(state);

      // Return cleanup function
      return () => {
        textarea.removeEventListener('input', handleInput);
        textarea.removeEventListener('selectionchange', handleSelectionChange);
        textarea.removeEventListener('select', handleSelectionChange);
        textarea.removeEventListener('keydown', handleKeyDown);
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
      };
    },
  };
}

// Plugin state management helpers
export class SectionPluginManager {
  private textarea: HTMLTextAreaElement;
  private pluginState: SectionPluginState;

  constructor(textarea: HTMLTextAreaElement, initialState: SectionPluginState) {
    this.textarea = textarea;
    this.pluginState = initialState;
  }

  getState(): SectionPluginState {
    return this.pluginState;
  }

  // Save current content
  save(content?: string): void {
    const actualContent = content || this.textarea.value;
    this.pluginState.lastSavedContent = actualContent;
    this.pluginState.hasChanges = false;
  }

  // Mark as saved
  markSaved(): void {
    this.pluginState.lastSavedContent = this.textarea.value;
    this.pluginState.hasChanges = false;
  }

  // Add collaborator
  addCollaborator(collaborator: SectionPluginState['collaborators'][0]): void {
    this.pluginState.collaborators.push(collaborator);
  }

  // Remove collaborator
  removeCollaborator(collaboratorId: string): void {
    this.pluginState.collaborators = this.pluginState.collaborators.filter(
      c => c.id !== collaboratorId
    );
  }

  // Update collaborator cursor/selection
  updateCollaborator(
    collaboratorId: string,
    updates: Partial<SectionPluginState['collaborators'][0]>
  ): void {
    const collaborator = this.pluginState.collaborators.find(c => c.id === collaboratorId);
    if (collaborator) {
      Object.assign(collaborator, updates);
    }
  }

  // Get content statistics
  getStats(): {
    wordCount: number;
    charCount: number;
    editDuration: number;
    hasChanges: boolean;
  } {
    return {
      wordCount: this.pluginState.wordCount,
      charCount: this.pluginState.charCount,
      editDuration: Date.now() - this.pluginState.editStartTime,
      hasChanges: this.pluginState.hasChanges,
    };
  }

  // Clear all patches
  clearPatches(): void {
    this.pluginState.patches = [];
  }
}
