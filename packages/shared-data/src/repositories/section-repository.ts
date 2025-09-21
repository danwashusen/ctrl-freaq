import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from './base-repository';
import type { QueryOptions } from '../types/index';

/**
 * SectionView entity schema
 * Represents the view state of a document section in the editor.
 */
export const SectionViewSchema = z.object({
  id: z.string().uuid('Invalid section ID format'),
  docId: z.string().uuid('Invalid document ID format'),
  parentSectionId: z.string().uuid('Invalid parent section ID format').nullable(),
  key: z.string().min(1, 'Section key is required').max(100, 'Section key too long'),
  title: z.string().min(1, 'Section title is required').max(255, 'Section title too long'),
  depth: z.number().int().min(0).max(5, 'Section depth must be between 0 and 5'),
  orderIndex: z.number().int().min(0, 'Order index must be non-negative'),

  // Content states
  contentMarkdown: z.string().max(100000, 'Content exceeds maximum length'),
  placeholderText: z.string().max(1000, 'Placeholder text too long'),
  hasContent: z.boolean(),

  // Editor states
  viewState: z.enum(['idle', 'read_mode', 'edit_mode', 'saving']),
  editingUser: z.string().nullable(),
  lastModified: z.date(),

  // Section lifecycle
  status: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),
  assumptionsResolved: z.boolean(),
  qualityGateStatus: z.enum(['pending', 'passed', 'failed']).nullable(),

  // Base entity fields
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SectionView = z.infer<typeof SectionViewSchema>;

/**
 * Input schema for creating a section
 */
export const CreateSectionViewSchema = SectionViewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateSectionViewInput = z.infer<typeof CreateSectionViewSchema>;

/**
 * Table of Contents node interface (forward declaration for recursive schema)
 */
export interface TocNode {
  sectionId: string;
  title: string;
  depth: number;
  orderIndex: number;
  hasContent: boolean;
  status: 'idle' | 'assumptions' | 'drafting' | 'review' | 'ready';

  // UI state
  isExpanded: boolean;
  isActive: boolean;
  isVisible: boolean;
  hasUnsavedChanges: boolean;

  // Navigation
  children: TocNode[];
  parentId: string | null;
}

/**
 * Table of Contents node schema
 */
export const TocNodeSchema: z.ZodType<TocNode> = z.object({
  sectionId: z.string().uuid(),
  title: z.string(),
  depth: z.number().int().min(0).max(5),
  orderIndex: z.number().int().min(0),
  hasContent: z.boolean(),
  status: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),

  // UI state
  isExpanded: z.boolean(),
  isActive: z.boolean(),
  isVisible: z.boolean(),
  hasUnsavedChanges: z.boolean(),

  // Navigation
  children: z.array(z.lazy(() => TocNodeSchema)),
  parentId: z.string().uuid().nullable(),
});

/**
 * Table of Contents schema
 */
export const TableOfContentsSchema = z.object({
  documentId: z.string().uuid(),
  sections: z.array(TocNodeSchema),
  lastUpdated: z.date(),
});

export type TableOfContents = z.infer<typeof TableOfContentsSchema>;

/**
 * Query options for section-specific queries
 */
export interface SectionQueryOptions extends QueryOptions {
  docId?: string;
  parentSectionId?: string;
  status?: SectionView['status'];
  viewState?: SectionView['viewState'];
  hasContent?: boolean;
  depth?: number;
}

/**
 * Section repository interface
 */
export interface SectionRepository {
  findById(id: string): Promise<SectionView | null>;
  findAll(options?: SectionQueryOptions): Promise<SectionView[]>;
  create(section: CreateSectionViewInput): Promise<SectionView>;
  update(id: string, updates: Partial<SectionView>): Promise<SectionView>;
  delete(id: string, deletedBy: string): Promise<boolean>;

  // Document-specific queries
  findByDocumentId(docId: string, options?: QueryOptions): Promise<SectionView[]>;
  findChildren(parentSectionId: string, options?: QueryOptions): Promise<SectionView[]>;
  findRootSections(docId: string, options?: QueryOptions): Promise<SectionView[]>;

  // Hierarchy and navigation
  generateTableOfContents(docId: string): Promise<TableOfContents>;
  updateViewState(sectionId: string, viewState: SectionView['viewState']): Promise<SectionView>;
  updateStatus(sectionId: string, status: SectionView['status']): Promise<SectionView>;

  // Content management
  updateContent(sectionId: string, contentMarkdown: string): Promise<SectionView>;
  bulkUpdateOrderIndex(updates: Array<{ id: string; orderIndex: number }>): Promise<void>;
}

/**
 * Section repository implementation
 */
export class SectionRepositoryImpl
  extends BaseRepository<SectionView>
  implements SectionRepository
{
  constructor(db: Database.Database) {
    super(db, 'sections', SectionViewSchema);
  }

  /**
   * Find sections by document ID
   */
  async findByDocumentId(docId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, doc_id: docId },
    });
  }

  /**
   * Find child sections of a parent section
   */
  async findChildren(parentSectionId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    return this.findAll({
      ...options,
      where: { ...options.where, parent_section_id: parentSectionId },
      orderBy: 'order_index',
      orderDirection: 'ASC',
    });
  }

  /**
   * Find root sections (no parent) for a document
   */
  async findRootSections(docId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE doc_id = ? AND parent_section_id IS NULL`;
    const params: unknown[] = [docId];

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    } else {
      query += ` ORDER BY order_index ASC`;
    }

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const stmt = this.getStatement(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Generate table of contents for a document
   */
  async generateTableOfContents(docId: string): Promise<TableOfContents> {
    const sections = await this.findByDocumentId(docId, {
      orderBy: 'order_index',
      orderDirection: 'ASC',
    });

    // Build hierarchical structure
    const tocNodes = this.buildTocHierarchy(sections);

    return {
      documentId: docId,
      sections: tocNodes,
      lastUpdated: new Date(),
    };
  }

  /**
   * Update section view state
   */
  async updateViewState(
    sectionId: string,
    viewState: SectionView['viewState']
  ): Promise<SectionView> {
    return this.update(sectionId, { viewState });
  }

  /**
   * Update section status
   */
  async updateStatus(sectionId: string, status: SectionView['status']): Promise<SectionView> {
    return this.update(sectionId, { status });
  }

  /**
   * Update section content
   */
  async updateContent(sectionId: string, contentMarkdown: string): Promise<SectionView> {
    const hasContent = contentMarkdown.trim().length > 0;
    return this.update(sectionId, {
      contentMarkdown,
      hasContent,
      lastModified: new Date(),
    });
  }

  /**
   * Bulk update order indices for sections
   */
  async bulkUpdateOrderIndex(updates: Array<{ id: string; orderIndex: number }>): Promise<void> {
    this.transaction(db => {
      const stmt = db.prepare(
        `UPDATE ${this.tableName} SET order_index = ?, updated_at = ? WHERE id = ?`
      );
      const now = new Date().toISOString();

      for (const update of updates) {
        stmt.run(update.orderIndex, now, update.id);
      }
    });
  }

  /**
   * Build hierarchical ToC structure from flat sections array
   */
  private buildTocHierarchy(sections: SectionView[]): TocNode[] {
    const sectionMap = new Map<string, SectionView>();
    const rootNodes: TocNode[] = [];
    const nodeMap = new Map<string, TocNode>();

    // Create section lookup
    for (const section of sections) {
      sectionMap.set(section.id, section);
    }

    // Create ToC nodes
    for (const section of sections) {
      const node: TocNode = {
        sectionId: section.id,
        title: section.title,
        depth: section.depth,
        orderIndex: section.orderIndex,
        hasContent: section.hasContent,
        status: section.status,
        isExpanded: false, // Default UI state
        isActive: false,
        isVisible: true,
        hasUnsavedChanges: false, // Will be updated by pending changes
        children: [],
        parentId: section.parentSectionId,
      };

      nodeMap.set(section.id, node);

      if (!section.parentSectionId) {
        rootNodes.push(node);
      }
    }

    // Build parent-child relationships
    for (const section of sections) {
      if (section.parentSectionId) {
        const parentNode = nodeMap.get(section.parentSectionId);
        const childNode = nodeMap.get(section.id);

        if (parentNode && childNode) {
          parentNode.children.push(childNode);
        }
      }
    }

    // Sort children by order index
    const sortChildren = (nodes: TocNode[]) => {
      nodes.sort((a, b) => a.orderIndex - b.orderIndex);
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };

    sortChildren(rootNodes);
    return rootNodes;
  }

  /**
   * Override to handle database column mapping
   */
  protected override mapRowToEntity(row: Record<string, unknown>): SectionView {
    // Handle boolean conversion from SQLite
    if (typeof row.has_content === 'number') {
      row.has_content = Boolean(row.has_content);
    }
    if (typeof row.assumptions_resolved === 'number') {
      row.assumptions_resolved = Boolean(row.assumptions_resolved);
    }

    return super.mapRowToEntity(row);
  }
}

/**
 * Validation functions
 */
export const validateSectionView = (data: unknown): SectionView => {
  return SectionViewSchema.parse(data);
};

export const validateCreateSectionView = (data: unknown): CreateSectionViewInput => {
  return CreateSectionViewSchema.parse(data);
};

export const validateTableOfContents = (data: unknown): TableOfContents => {
  return TableOfContentsSchema.parse(data);
};

/**
 * Section utility functions
 */
export const SectionUtils = {
  /**
   * Check if section is in editing state
   */
  isEditing(section: SectionView): boolean {
    return section.viewState === 'edit_mode';
  },

  /**
   * Check if section is currently being saved
   */
  isSaving(section: SectionView): boolean {
    return section.viewState === 'saving';
  },

  /**
   * Check if section is ready for content
   */
  isReady(section: SectionView): boolean {
    return section.status === 'ready';
  },

  /**
   * Get section display title with status indicator
   */
  getDisplayTitle(section: SectionView): string {
    const statusIndicator = section.hasContent ? '●' : '○';
    return `${statusIndicator} ${section.title}`;
  },

  /**
   * Calculate section hierarchy path
   */
  getHierarchyPath(section: SectionView, allSections: SectionView[]): string[] {
    const path: string[] = [];
    let current = section;

    while (current) {
      path.unshift(current.title);

      if (!current.parentSectionId) break;

      const parent = allSections.find(s => s.id === current.parentSectionId);
      if (!parent) break;

      current = parent;
    }

    return path;
  },

  /**
   * Check if section can be edited
   */
  canEdit(section: SectionView): boolean {
    return section.viewState === 'read_mode' || section.viewState === 'idle';
  },

  /**
   * Check if section has unsaved changes
   */
  hasUnsavedChanges(section: SectionView): boolean {
    return section.viewState === 'edit_mode';
  },
};
