/**
 * Sections API Service
 *
 * Provides methods for interacting with the sections API endpoints.
 * Handles document sections, table of contents, and section state management.
 * Follows the OpenAPI contract defined in contracts/sections-api.yaml.
 */

import ApiClient from '../../../lib/api';
import type { SectionView, SectionViewState } from '../types/section-view';
import type { TableOfContents } from '../types/table-of-contents';

// API Request types
export interface UpdateSectionStateRequest {
  viewState: SectionViewState;
}

// API Response types
export interface DocumentSectionsResponse {
  sections: SectionView[];
  toc: TableOfContents;
}

export interface SectionResponse {
  section: SectionView;
}

export interface TableOfContentsResponse {
  toc: TableOfContents;
}

/**
 * Service class for managing document sections via API
 *
 * Since ApiClient.makeRequest is private, we extend the class to access it
 */
export class SectionsApiService extends ApiClient {
  constructor(apiClient?: ApiClient) {
    // If an existing client is provided, copy its configuration
    if (apiClient) {
      super();
    } else {
      super();
    }
  }

  /**
   * Get all sections for a document
   * GET /api/v1/documents/{docId}/sections
   */
  async getDocumentSections(docId: string): Promise<DocumentSectionsResponse> {
    const response = await this['makeRequest']<{
      sections: SectionView[];
      toc: TableOfContents;
    }>(`/documents/${docId}/sections`);

    return {
      sections: response.sections,
      toc: response.toc,
    };
  }

  /**
   * Get a specific section with content
   * GET /api/v1/sections/{sectionId}
   */
  async getSection(sectionId: string): Promise<SectionView> {
    return this['makeRequest']<SectionView>(`/sections/${sectionId}`);
  }

  /**
   * Update section view state
   * PATCH /api/v1/sections/{sectionId}
   */
  async updateSectionState(
    sectionId: string,
    request: UpdateSectionStateRequest
  ): Promise<SectionView> {
    return this['makeRequest']<SectionView>(`/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get table of contents for document
   * GET /api/v1/documents/{docId}/toc
   */
  async getTableOfContents(docId: string): Promise<TableOfContents> {
    return this['makeRequest']<TableOfContents>(`/documents/${docId}/toc`);
  }

  /**
   * Save section content with pending changes
   * POST /api/v1/sections/{sectionId}/save
   */
  async saveSectionChanges(
    sectionId: string,
    changeIds: string[]
  ): Promise<{
    section: SectionView;
    appliedChanges: string[];
  }> {
    return this['makeRequest']<{
      section: SectionView;
      appliedChanges: string[];
    }>(`/sections/${sectionId}/save`, {
      method: 'POST',
      body: JSON.stringify({ changeIds }),
    });
  }

  /**
   * Batch update multiple section states
   * Convenience method for updating multiple sections in sequence
   */
  async batchUpdateSectionStates(
    updates: Array<{
      sectionId: string;
      viewState: SectionViewState;
    }>
  ): Promise<SectionView[]> {
    const results: SectionView[] = [];

    for (const update of updates) {
      const result = await this.updateSectionState(update.sectionId, {
        viewState: update.viewState,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Get sections filtered by status
   * Convenience method for filtering sections client-side
   */
  async getSectionsByStatus(
    docId: string,
    status: 'idle' | 'assumptions' | 'drafting' | 'review' | 'ready'
  ): Promise<SectionView[]> {
    const response = await this.getDocumentSections(docId);
    return response.sections.filter(section => section.status === status);
  }

  /**
   * Get sections that have unsaved changes
   * Uses the ToC to identify sections with pending changes
   */
  async getSectionsWithUnsavedChanges(docId: string): Promise<SectionView[]> {
    const response = await this.getDocumentSections(docId);
    const sectionsWithChanges = response.toc.sections
      .filter(tocNode => tocNode.hasUnsavedChanges)
      .map(tocNode => tocNode.sectionId);

    return response.sections.filter(section => sectionsWithChanges.includes(section.id));
  }

  /**
   * Get section hierarchy as a flat list ordered by depth and orderIndex
   * Useful for rendering sections in document order
   */
  async getSectionHierarchy(docId: string): Promise<SectionView[]> {
    const response = await this.getDocumentSections(docId);

    // Sort sections by depth then orderIndex for document order
    return response.sections.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      return a.orderIndex - b.orderIndex;
    });
  }

  /**
   * Validate section state transition
   * Checks if a state transition is valid before making API call
   */
  isValidStateTransition(currentState: SectionViewState, newState: SectionViewState): boolean {
    const validTransitions: Record<SectionViewState, SectionViewState[]> = {
      idle: ['read_mode'],
      read_mode: ['edit_mode', 'idle'],
      edit_mode: ['saving', 'read_mode'],
      saving: ['read_mode', 'edit_mode'],
    };

    return validTransitions[currentState]?.includes(newState) ?? false;
  }

  /**
   * Safely update section state with validation
   * Checks transition validity before making API call
   */
  async safeUpdateSectionState(
    sectionId: string,
    currentState: SectionViewState,
    newState: SectionViewState
  ): Promise<SectionView> {
    if (!this.isValidStateTransition(currentState, newState)) {
      throw new Error(
        `Invalid state transition from ${currentState} to ${newState} for section ${sectionId}`
      );
    }

    return this.updateSectionState(sectionId, { viewState: newState });
  }
}

/**
 * Factory function to create a SectionsApiService instance
 */
export function createSectionsApiService(apiClient: ApiClient): SectionsApiService {
  return new SectionsApiService(apiClient);
}

// Export types for external use
export type { SectionView, SectionViewState, TableOfContents };
