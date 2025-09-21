/**
 * TableOfContents Type Definitions
 *
 * Navigation structure for document sections with hierarchical organization,
 * UI state management, and section status tracking.
 */

import type { SectionStatus } from './section-view';

/**
 * Represents a node in the table of contents tree
 */
export interface TocNode {
  /** Reference to section */
  sectionId: string;

  /** Display title */
  title: string;

  /** Nesting level (0 = root) */
  depth: number;

  /** Sort order within parent */
  orderIndex: number;

  /** Whether section has saved content */
  hasContent: boolean;

  /** Current status in document workflow */
  status: SectionStatus;

  // UI state
  /** For nested sections - whether children are visible */
  isExpanded: boolean;

  /** Currently selected in navigation */
  isActive: boolean;

  /** Currently visible in viewport */
  isVisible: boolean;

  /** Has pending changes that aren't saved */
  hasUnsavedChanges: boolean;

  // Navigation relationships
  /** Child sections */
  children: TocNode[];

  /** Parent section ID */
  parentId: string | null;
}

/**
 * Core table of contents interface based on data-model.md specification
 */
export interface TableOfContents {
  /** Document identifier */
  documentId: string;

  /** Root sections and their hierarchies */
  sections: TocNode[];

  /** ISO timestamp of last update */
  lastUpdated: string;
}

/**
 * Interface for creating a new ToC node
 */
export interface CreateTocNode {
  sectionId: string;
  title: string;
  depth: number;
  orderIndex: number;
  hasContent: boolean;
  status: SectionStatus;
  parentId: string | null;
}

/**
 * Interface for updating ToC node state
 */
export interface TocNodeUpdate {
  sectionId: string;
  title?: string;
  hasContent?: boolean;
  status?: SectionStatus;
  isExpanded?: boolean;
  isActive?: boolean;
  isVisible?: boolean;
  hasUnsavedChanges?: boolean;
}

/**
 * Flat representation of ToC for efficient operations
 */
export interface FlatTocNode {
  sectionId: string;
  title: string;
  depth: number;
  orderIndex: number;
  hasContent: boolean;
  status: SectionStatus;
  isExpanded: boolean;
  isActive: boolean;
  isVisible: boolean;
  hasUnsavedChanges: boolean;
  parentId: string | null;
  hasChildren: boolean;
  path: string; // e.g., "1.2.3" for hierarchical numbering
}

/**
 * Navigation context for ToC operations
 */
export interface TocNavigationContext {
  /** Currently active section */
  activeSectionId: string | null;

  /** Sections currently visible in viewport */
  visibleSectionIds: string[];

  /** Sections with unsaved changes */
  sectionsWithChanges: string[];

  /** Expanded sections in ToC tree */
  expandedSectionIds: string[];
}

/**
 * ToC filtering and search options
 */
export interface TocFilterOptions {
  /** Filter by section status */
  status?: SectionStatus[];

  /** Show only sections with content */
  hasContentOnly?: boolean;

  /** Show only sections with unsaved changes */
  hasChangesOnly?: boolean;

  /** Search term for title matching */
  searchTerm?: string;

  /** Maximum depth to display */
  maxDepth?: number;
}

/**
 * ToC statistics for display and analysis
 */
export interface TocStatistics {
  /** Total number of sections */
  totalSections: number;

  /** Sections by status */
  sectionsByStatus: Record<SectionStatus, number>;

  /** Sections with content */
  sectionsWithContent: number;

  /** Sections with unsaved changes */
  sectionsWithChanges: number;

  /** Maximum depth in hierarchy */
  maxDepth: number;

  /** Completion percentage */
  completionPercentage: number;
}

/**
 * Type guard to check if an object is a valid TocNode
 */
export function isTocNode(obj: unknown): obj is TocNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as TocNode).sectionId === 'string' &&
    typeof (obj as TocNode).title === 'string' &&
    typeof (obj as TocNode).depth === 'number' &&
    typeof (obj as TocNode).orderIndex === 'number' &&
    typeof (obj as TocNode).hasContent === 'boolean' &&
    typeof (obj as TocNode).status === 'string' &&
    typeof (obj as TocNode).isExpanded === 'boolean' &&
    typeof (obj as TocNode).isActive === 'boolean' &&
    typeof (obj as TocNode).isVisible === 'boolean' &&
    typeof (obj as TocNode).hasUnsavedChanges === 'boolean' &&
    Array.isArray((obj as TocNode).children) &&
    ((obj as TocNode).parentId === null || typeof (obj as TocNode).parentId === 'string')
  );
}

/**
 * Type guard to check if an object is a valid TableOfContents
 */
export function isTableOfContents(obj: unknown): obj is TableOfContents {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as TableOfContents).documentId === 'string' &&
    Array.isArray((obj as TableOfContents).sections) &&
    typeof (obj as TableOfContents).lastUpdated === 'string'
  );
}

/**
 * Default ToC node values
 */
export const DEFAULT_TOC_NODE: Partial<TocNode> = {
  hasContent: false,
  status: 'idle',
  isExpanded: false,
  isActive: false,
  isVisible: true,
  hasUnsavedChanges: false,
  children: [],
};

/**
 * ToC configuration limits and constraints
 */
export const TOC_LIMITS = {
  /** Maximum nesting depth */
  MAX_DEPTH: 5,

  /** Maximum number of sections per document */
  MAX_SECTIONS: 500,

  /** Maximum number of children per parent */
  MAX_CHILDREN_PER_PARENT: 50,

  /** Maximum title length */
  MAX_TITLE_LENGTH: 200,
} as const;

/**
 * Helper function to flatten ToC tree for efficient operations
 */
export function flattenToc(sections: TocNode[]): FlatTocNode[] {
  const flattened: FlatTocNode[] = [];

  function traverse(nodes: TocNode[], parentPath = ''): void {
    nodes.forEach((node, index) => {
      const path = parentPath ? `${parentPath}.${index + 1}` : `${index + 1}`;

      flattened.push({
        sectionId: node.sectionId,
        title: node.title,
        depth: node.depth,
        orderIndex: node.orderIndex,
        hasContent: node.hasContent,
        status: node.status,
        isExpanded: node.isExpanded,
        isActive: node.isActive,
        isVisible: node.isVisible,
        hasUnsavedChanges: node.hasUnsavedChanges,
        parentId: node.parentId,
        hasChildren: node.children.length > 0,
        path,
      });

      if (node.children.length > 0) {
        traverse(node.children, path);
      }
    });
  }

  traverse(sections);
  return flattened;
}

/**
 * Helper function to find a node by section ID
 */
export function findTocNode(sections: TocNode[], sectionId: string): TocNode | null {
  for (const section of sections) {
    if (section.sectionId === sectionId) {
      return section;
    }
    const found = findTocNode(section.children, sectionId);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Helper function to get all parent IDs for a section
 */
export function getParentPath(sections: TocNode[], sectionId: string): string[] {
  const path: string[] = [];

  function findPath(nodes: TocNode[], targetId: string, currentPath: string[]): boolean {
    for (const node of nodes) {
      const newPath = [...currentPath, node.sectionId];

      if (node.sectionId === targetId) {
        path.push(...newPath.slice(0, -1)); // Exclude the target node itself
        return true;
      }

      if (findPath(node.children, targetId, newPath)) {
        return true;
      }
    }
    return false;
  }

  findPath(sections, sectionId, []);
  return path;
}

/**
 * Helper function to calculate ToC statistics
 */
export function calculateTocStatistics(sections: TocNode[]): TocStatistics {
  const flattened = flattenToc(sections);

  const sectionsByStatus: Record<SectionStatus, number> = {
    idle: 0,
    assumptions: 0,
    drafting: 0,
    review: 0,
    ready: 0,
  };

  let sectionsWithContent = 0;
  let sectionsWithChanges = 0;
  let maxDepth = 0;

  flattened.forEach(node => {
    sectionsByStatus[node.status]++;
    if (node.hasContent) sectionsWithContent++;
    if (node.hasUnsavedChanges) sectionsWithChanges++;
    maxDepth = Math.max(maxDepth, node.depth);
  });

  const completionPercentage =
    flattened.length > 0 ? Math.round((sectionsWithContent / flattened.length) * 100) : 0;

  return {
    totalSections: flattened.length,
    sectionsByStatus,
    sectionsWithContent,
    sectionsWithChanges,
    maxDepth,
    completionPercentage,
  };
}

/**
 * Helper function to filter ToC based on criteria
 */
export function filterToc(sections: TocNode[], options: TocFilterOptions): TocNode[] {
  function filterNode(node: TocNode): TocNode | null {
    // Apply filters
    if (options.status && !options.status.includes(node.status)) {
      return null;
    }

    if (options.hasContentOnly && !node.hasContent) {
      return null;
    }

    if (options.hasChangesOnly && !node.hasUnsavedChanges) {
      return null;
    }

    if (
      options.searchTerm &&
      !node.title.toLowerCase().includes(options.searchTerm.toLowerCase())
    ) {
      return null;
    }

    if (options.maxDepth !== undefined && node.depth > options.maxDepth) {
      return null;
    }

    // Recursively filter children
    const filteredChildren = node.children
      .map(filterNode)
      .filter((child): child is TocNode => child !== null);

    return {
      ...node,
      children: filteredChildren,
    };
  }

  return sections.map(filterNode).filter((section): section is TocNode => section !== null);
}
