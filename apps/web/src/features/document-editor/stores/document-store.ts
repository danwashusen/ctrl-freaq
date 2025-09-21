/**
 * Document Store - Document and sections state management
 *
 * Manages document-level state including sections hierarchy, table of contents,
 * and document metadata. Uses Zustand with Immer for immutable updates.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { SectionView } from '../types/section-view';
import type { TableOfContents, TocNode } from '../types/table-of-contents';

interface DocumentInfo {
  id: string;
  title: string;
  lastModified: string;
  status: 'draft' | 'review' | 'published';
}

interface DocumentStoreState {
  // Document metadata
  document: DocumentInfo | null;
  isLoading: boolean;
  error: string | null;

  // Table of contents
  toc: TableOfContents | null;
  expandedSections: Set<string>;

  // Section organization
  rootSections: SectionView[];
  sectionHierarchy: Record<string, string[]>; // parentId -> childIds

  // Performance optimization
  visibleSections: Set<string>;
  lastTocUpdate: number | null;

  // Actions
  setDocument: (document: DocumentInfo) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // ToC management
  setTableOfContents: (toc: TableOfContents) => void;
  updateTocNode: (sectionId: string, updates: Partial<TocNode>) => void;
  expandSection: (sectionId: string) => void;
  collapseSection: (sectionId: string) => void;
  toggleSectionExpansion: (sectionId: string) => void;
  setActiveTocNode: (sectionId: string | null) => void;
  markTocNodeVisible: (sectionId: string, visible: boolean) => void;
  markTocNodeUnsaved: (sectionId: string, hasUnsavedChanges: boolean) => void;

  // Section hierarchy management
  loadSectionHierarchy: (sections: SectionView[]) => void;
  addSection: (section: SectionView) => void;
  removeSection: (sectionId: string) => void;
  moveSection: (sectionId: string, newParentId: string | null, newOrderIndex: number) => void;

  // Visibility tracking
  setSectionVisible: (sectionId: string, visible: boolean) => void;
  clearVisibleSections: () => void;

  // Utility
  getSectionsByParent: (parentId: string | null) => SectionView[];
  getTocNodeById: (sectionId: string) => TocNode | null;
  getExpandedSectionIds: () => string[];
  reset: () => void;
}

const initialState = {
  document: null,
  isLoading: false,
  error: null,
  toc: null,
  expandedSections: new Set<string>(),
  rootSections: [],
  sectionHierarchy: {},
  visibleSections: new Set<string>(),
  lastTocUpdate: null,
};

export const useDocumentStore = create<DocumentStoreState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      setDocument: (document: DocumentInfo) => {
        set(state => {
          state.document = document;
          state.error = null;
        });
      },

      setLoading: (loading: boolean) => {
        set(state => {
          state.isLoading = loading;
          if (loading) {
            state.error = null;
          }
        });
      },

      setError: (error: string | null) => {
        set(state => {
          state.error = error;
          state.isLoading = false;
        });
      },

      setTableOfContents: (toc: TableOfContents) => {
        set(state => {
          state.toc = toc;
          state.lastTocUpdate = Date.now();

          // Initialize expanded state for root sections
          toc.sections.forEach(section => {
            if (section.children.length > 0) {
              state.expandedSections.add(section.sectionId);
            }
          });
        });
      },

      updateTocNode: (sectionId: string, updates: Partial<TocNode>) => {
        set(state => {
          if (!state.toc) return;

          const updateNodeRecursively = (nodes: TocNode[]): boolean => {
            for (const node of nodes) {
              if (node.sectionId === sectionId) {
                Object.assign(node, updates);
                return true;
              }
              if (node.children.length > 0 && updateNodeRecursively(node.children)) {
                return true;
              }
            }
            return false;
          };

          updateNodeRecursively(state.toc.sections);
          state.lastTocUpdate = Date.now();
        });
      },

      expandSection: (sectionId: string) => {
        set(state => {
          state.expandedSections.add(sectionId);
        });
      },

      collapseSection: (sectionId: string) => {
        set(state => {
          state.expandedSections.delete(sectionId);
        });
      },

      toggleSectionExpansion: (sectionId: string) => {
        set(state => {
          if (state.expandedSections.has(sectionId)) {
            state.expandedSections.delete(sectionId);
          } else {
            state.expandedSections.add(sectionId);
          }
        });
      },

      setActiveTocNode: (sectionId: string | null) => {
        set(state => {
          if (!state.toc) return;

          const updateActiveState = (nodes: TocNode[]) => {
            nodes.forEach(node => {
              node.isActive = node.sectionId === sectionId;
              if (node.children.length > 0) {
                updateActiveState(node.children);
              }
            });
          };

          updateActiveState(state.toc.sections);
          state.lastTocUpdate = Date.now();
        });
      },

      markTocNodeVisible: (sectionId: string, visible: boolean) => {
        get().updateTocNode(sectionId, { isVisible: visible });
        get().setSectionVisible(sectionId, visible);
      },

      markTocNodeUnsaved: (sectionId: string, hasUnsavedChanges: boolean) => {
        get().updateTocNode(sectionId, { hasUnsavedChanges });
      },

      loadSectionHierarchy: (sections: SectionView[]) => {
        set(state => {
          // Reset hierarchy
          state.sectionHierarchy = {};
          state.rootSections = [];

          // Build hierarchy map
          sections.forEach(section => {
            const parentId = section.parentSectionId;

            const hierarchyKey = parentId ?? 'root';
            if (!state.sectionHierarchy[hierarchyKey]) {
              state.sectionHierarchy[hierarchyKey] = [];
            }
            state.sectionHierarchy[hierarchyKey].push(section.id);

            // Track root sections
            if (!parentId) {
              state.rootSections.push(section);
            }
          });

          // Sort sections by orderIndex
          Object.keys(state.sectionHierarchy).forEach(key => {
            const hierarchyArray = state.sectionHierarchy[key];
            if (hierarchyArray) {
              hierarchyArray.sort((a, b) => {
                const sectionA = sections.find(s => s.id === a);
                const sectionB = sections.find(s => s.id === b);
                return (sectionA?.orderIndex ?? 0) - (sectionB?.orderIndex ?? 0);
              });
            }
          });

          state.rootSections.sort((a, b) => a.orderIndex - b.orderIndex);
        });
      },

      addSection: (section: SectionView) => {
        set(state => {
          const parentId = section.parentSectionId ?? 'root';

          if (!state.sectionHierarchy[parentId]) {
            state.sectionHierarchy[parentId] = [];
          }

          // Insert at correct position based on orderIndex
          const hierarchyArray = state.sectionHierarchy[parentId];
          if (hierarchyArray) {
            const insertIndex = hierarchyArray.findIndex(id => {
              const existingSection = state.rootSections.find(s => s.id === id);
              return (existingSection?.orderIndex ?? 0) > section.orderIndex;
            });

            if (insertIndex === -1) {
              hierarchyArray.push(section.id);
            } else {
              hierarchyArray.splice(insertIndex, 0, section.id);
            }
          }

          // Add to root sections if it's a root section
          if (!section.parentSectionId) {
            const rootInsertIndex = state.rootSections.findIndex(
              s => s.orderIndex > section.orderIndex
            );

            if (rootInsertIndex === -1) {
              state.rootSections.push(section);
            } else {
              state.rootSections.splice(rootInsertIndex, 0, section);
            }
          }
        });
      },

      removeSection: (sectionId: string) => {
        set(state => {
          // Remove from all hierarchy arrays
          Object.keys(state.sectionHierarchy).forEach(parentId => {
            const hierarchyArray = state.sectionHierarchy[parentId];
            if (hierarchyArray) {
              const index = hierarchyArray.indexOf(sectionId);
              if (index !== -1) {
                hierarchyArray.splice(index, 1);
              }
            }
          });

          // Remove from root sections
          const rootIndex = state.rootSections.findIndex(s => s.id === sectionId);
          if (rootIndex !== -1) {
            state.rootSections.splice(rootIndex, 1);
          }

          // Clean up expanded state
          state.expandedSections.delete(sectionId);
          state.visibleSections.delete(sectionId);
        });
      },

      moveSection: (sectionId: string, newParentId: string | null, newOrderIndex: number) => {
        set(state => {
          // Remove from current parent
          Object.keys(state.sectionHierarchy).forEach(parentId => {
            const hierarchyArray = state.sectionHierarchy[parentId];
            if (hierarchyArray) {
              const index = hierarchyArray.indexOf(sectionId);
              if (index !== -1) {
                hierarchyArray.splice(index, 1);
              }
            }
          });

          // Add to new parent at correct position
          const targetParent = newParentId ?? 'root';
          if (!state.sectionHierarchy[targetParent]) {
            state.sectionHierarchy[targetParent] = [];
          }

          // Insert at new position
          const targetHierarchy = state.sectionHierarchy[targetParent];
          if (targetHierarchy) {
            if (newOrderIndex >= targetHierarchy.length) {
              targetHierarchy.push(sectionId);
            } else {
              targetHierarchy.splice(newOrderIndex, 0, sectionId);
            }
          }
        });
      },

      setSectionVisible: (sectionId: string, visible: boolean) => {
        set(state => {
          if (visible) {
            state.visibleSections.add(sectionId);
          } else {
            state.visibleSections.delete(sectionId);
          }
        });
      },

      clearVisibleSections: () => {
        set(state => {
          state.visibleSections.clear();
        });
      },

      getSectionsByParent: (parentId: string | null) => {
        const state = get();
        const key = parentId ?? 'root';
        const sectionIds = state.sectionHierarchy[key] ?? [];
        return sectionIds
          .map(id => state.rootSections.find(s => s.id === id))
          .filter(Boolean) as SectionView[];
      },

      getTocNodeById: (sectionId: string) => {
        const state = get();
        if (!state.toc) return null;

        const findNodeRecursively = (nodes: TocNode[]): TocNode | null => {
          for (const node of nodes) {
            if (node.sectionId === sectionId) {
              return node;
            }
            if (node.children.length > 0) {
              const found = findNodeRecursively(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        return findNodeRecursively(state.toc.sections);
      },

      getExpandedSectionIds: () => {
        const state = get();
        return Array.from(state.expandedSections);
      },

      reset: () => {
        set({
          ...initialState,
          expandedSections: new Set(),
          visibleSections: new Set(),
        });
      },
    })),
    {
      name: 'document-store',
    }
  )
);

// Selectors for common queries
export const selectDocument = (state: DocumentStoreState) => state.document;

export const selectToc = (state: DocumentStoreState) => state.toc;

export const selectRootSections = (state: DocumentStoreState) => state.rootSections;

export const selectIsLoading = (state: DocumentStoreState) => state.isLoading;

export const selectError = (state: DocumentStoreState) => state.error;

export const selectExpandedSections = (state: DocumentStoreState) =>
  Array.from(state.expandedSections);

export const selectVisibleSections = (state: DocumentStoreState) =>
  Array.from(state.visibleSections);
