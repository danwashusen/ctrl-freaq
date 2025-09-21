/**
 * TanStack Query Hooks for Document Editor Sections API
 *
 * Provides React hooks for querying and mutating document sections,
 * table of contents, pending changes, and editor sessions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { SectionView } from '../types/section-view';
import type { PendingChange } from '../types/pending-change';
import type { TableOfContents } from '../types/table-of-contents';
import type { EditorSession, EditorSessionUpdate } from '../types/editor-session';
import type ApiClient from '../../../lib/api';

// Query keys for consistent cache management
export const QUERY_KEYS = {
  documentSections: (docId: string) => ['document-sections', docId] as const,
  section: (sectionId: string) => ['section', sectionId] as const,
  pendingChanges: (sectionId: string) => ['pending-changes', sectionId] as const,
  tableOfContents: (docId: string) => ['table-of-contents', docId] as const,
  editorSession: (docId: string) => ['editor-session', docId] as const,
} as const;

// API Response types (based on OpenAPI contracts)
interface DocumentSectionsResponse {
  sections: SectionView[];
  toc: TableOfContents;
}

interface PendingChangesResponse {
  changes: PendingChange[];
}

interface SaveSectionRequest {
  changeIds: string[];
}

interface SaveSectionResponse {
  section: SectionView;
  appliedChanges: string[];
}

interface CreatePendingChangeRequest {
  patches: Array<{
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: string;
    oldValue?: string;
  }>;
  originalContent: string;
  previewContent: string;
}

// Hook factory function to ensure API client is available
function createSectionsHooks(_apiClient: ApiClient) {
  /**
   * Query hook for fetching all sections in a document
   */
  function useDocumentSections(docId: string, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: QUERY_KEYS.documentSections(docId),
      queryFn: async (): Promise<DocumentSectionsResponse> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        // For now, throw an error to indicate this needs proper implementation
        throw new Error(`Document sections API not yet implemented for document ${docId}`);
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    });
  }

  /**
   * Query hook for fetching a specific section
   */
  function useSection(sectionId: string, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: QUERY_KEYS.section(sectionId),
      queryFn: async (): Promise<SectionView> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        throw new Error(`Section API not yet implemented for section ${sectionId}`);
      },
      enabled: options?.enabled ?? true,
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  }

  /**
   * Query hook for fetching pending changes for a section
   */
  function usePendingChanges(sectionId: string, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: QUERY_KEYS.pendingChanges(sectionId),
      queryFn: async (): Promise<PendingChangesResponse> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        throw new Error(`Pending changes API not yet implemented for section ${sectionId}`);
      },
      enabled: options?.enabled ?? true,
      staleTime: 30 * 1000, // 30 seconds
    });
  }

  /**
   * Query hook for fetching table of contents
   */
  function useTableOfContents(docId: string, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: QUERY_KEYS.tableOfContents(docId),
      queryFn: async (): Promise<TableOfContents> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        throw new Error(`Table of contents API not yet implemented for document ${docId}`);
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Query hook for fetching editor session
   */
  function useEditorSession(docId: string, options?: { enabled?: boolean }) {
    return useQuery({
      queryKey: QUERY_KEYS.editorSession(docId),
      queryFn: async (): Promise<EditorSession> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        throw new Error(`Editor session API not yet implemented for document ${docId}`);
      },
      enabled: options?.enabled ?? true,
      staleTime: 1 * 60 * 1000, // 1 minute
    });
  }

  /**
   * Mutation hook for updating section view state
   */
  function useUpdateSectionState() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        sectionId,
        viewState,
      }: {
        sectionId: string;
        viewState: 'idle' | 'read_mode' | 'edit_mode' | 'saving';
      }): Promise<SectionView> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        throw new Error(
          `Update section state API not yet implemented for section ${sectionId} with state ${viewState}`
        );
      },
      onSuccess: updatedSection => {
        // Update the specific section cache
        queryClient.setQueryData(QUERY_KEYS.section(updatedSection.id), updatedSection);

        // Invalidate document sections to refresh the list
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.documentSections(updatedSection.docId),
        });
      },
    });
  }

  /**
   * Mutation hook for creating pending changes
   */
  function useCreatePendingChange() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        sectionId,
        patches,
        originalContent,
        previewContent,
      }: {
        sectionId: string;
      } & CreatePendingChangeRequest): Promise<PendingChange> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        // Prevent unused variable warnings
        void patches;
        void originalContent;
        void previewContent;
        throw new Error(`Create pending change API not yet implemented for section ${sectionId}`);
      },
      onSuccess: newChange => {
        // Invalidate pending changes query to refetch
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.pendingChanges(newChange.sectionId),
        });
      },
    });
  }

  /**
   * Mutation hook for saving section changes
   */
  function useSaveSection() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        sectionId,
        changeIds,
      }: {
        sectionId: string;
      } & SaveSectionRequest): Promise<SaveSectionResponse> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        // Prevent unused variable warnings
        void changeIds;
        throw new Error(`Save section API not yet implemented for section ${sectionId}`);
      },
      onSuccess: result => {
        // Update section cache with saved data
        queryClient.setQueryData(QUERY_KEYS.section(result.section.id), result.section);

        // Clear pending changes since they're now applied
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.pendingChanges(result.section.id),
        });

        // Update document sections list
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.documentSections(result.section.docId),
        });

        // Update table of contents
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.tableOfContents(result.section.docId),
        });
      },
    });
  }

  /**
   * Mutation hook for updating editor session
   */
  function useUpdateEditorSession() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        docId,
        ...updates
      }: {
        docId: string;
      } & EditorSessionUpdate): Promise<EditorSession> => {
        // TODO: This will be replaced with actual API client call in Phase 3.7
        // Prevent unused variable warnings
        void updates;
        throw new Error(`Update editor session API not yet implemented for document ${docId}`);
      },
      onSuccess: (updatedSession, variables) => {
        // Update editor session cache
        queryClient.setQueryData(QUERY_KEYS.editorSession(variables.docId), updatedSession);
      },
    });
  }

  return {
    // Query hooks
    useDocumentSections,
    useSection,
    usePendingChanges,
    useTableOfContents,
    useEditorSession,

    // Mutation hooks
    useUpdateSectionState,
    useCreatePendingChange,
    useSaveSection,
    useUpdateEditorSession,

    // Query keys for external invalidation
    QUERY_KEYS,
  };
}

// Export a default instance (will need to be configured with actual API client)
export const sectionsHooks = createSectionsHooks({} as ApiClient);

// Export the factory for custom API client instances
export { createSectionsHooks };

// Re-export query keys for external use
export { QUERY_KEYS as SECTIONS_QUERY_KEYS };

// Utility hooks for common patterns
export function useInvalidateSectionQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateDocumentSections: (docId: string) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documentSections(docId),
      });
    },
    invalidateSection: (sectionId: string) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.section(sectionId),
      });
    },
    invalidateAllSections: () => {
      queryClient.invalidateQueries({
        queryKey: ['document-sections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['section'],
      });
    },
  };
}

// Optimistic update helpers
export function useOptimisticSectionUpdate() {
  const queryClient = useQueryClient();

  return {
    updateSectionOptimistically: (sectionId: string, update: Partial<SectionView>) => {
      queryClient.setQueryData(QUERY_KEYS.section(sectionId), (old: SectionView | undefined) => {
        if (!old) return old;
        return { ...old, ...update };
      });
    },
    rollbackSectionUpdate: (sectionId: string) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.section(sectionId),
      });
    },
  };
}
