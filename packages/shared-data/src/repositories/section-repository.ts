import Database from 'better-sqlite3';
import { z, type ZodErrorMap } from 'zod';

import { BaseRepository } from './base-repository.js';
import type { QueryOptions } from '../types/index.js';
import {
  SECTION_RECORD_QUALITY_GATES,
  type SectionRecordQualityGate,
} from '../models/section-record.js';

const qualityGateErrorMap: ZodErrorMap = issue => {
  if (issue.code === 'invalid_type') {
    return { message: 'qualityGate is required' };
  }
  if (issue.code === 'invalid_value') {
    return { message: 'Invalid quality gate value' };
  }
  return issue.message ?? undefined;
};

/**
 * SectionView entity schema
 * Represents the view state of a document section in the editor.
 */
export const SectionViewSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  docId: z.string().min(1, 'Document ID is required'),
  parentSectionId: z.string().min(1, 'Parent section ID is required').nullable(),
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

  // Approval metadata sourced from section_records
  approvedVersion: z.number().int().min(0, 'approvedVersion must be non-negative'),
  approvedContent: z.string().max(100000, 'approvedContent exceeds maximum length'),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().min(1).nullable(),
  lastSummary: z.string().max(1000, 'lastSummary too long').nullable(),
  qualityGate: z.enum(SECTION_RECORD_QUALITY_GATES, {
    error: qualityGateErrorMap,
  }),
  accessibilityScore: z.number().min(0).max(100).nullable(),

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
  approvedVersion: true,
  approvedContent: true,
  approvedAt: true,
  approvedBy: true,
  lastSummary: true,
  qualityGate: true,
  accessibilityScore: true,
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
  sectionId: z.string(),
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
  parentId: z.string().nullable(),
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
  parentSectionId?: string | null;
  status?: SectionView['status'];
  viewState?: SectionView['viewState'];
  hasContent?: boolean;
  depth?: number;
}

export interface FinalizeApprovalContext {
  approvedContent: string;
  approvedVersion: number;
  approvedAt: Date;
  approvedBy: string;
  lastSummary?: string | null;
  status?: SectionView['status'];
  qualityGate?: SectionRecordQualityGate;
}

const SECTION_RECORD_COLUMN_KEYS = new Set([
  'approved_version',
  'approved_content',
  'approved_at',
  'approved_by',
  'last_summary',
  'quality_gate',
  'accessibility_score',
]);

const SECTION_SELECT_COLUMNS = `
  s.id,
  s.doc_id,
  s.parent_section_id,
  s.key,
  s.title,
  s.depth,
  s.order_index,
  s.content_markdown,
  s.placeholder_text,
  s.has_content,
  s.view_state,
  s.editing_user,
  s.last_modified,
  s.status,
  s.assumptions_resolved,
  s.quality_gate_status,
  s.created_at,
  s.updated_at,
  sr.approved_version,
  sr.approved_content,
  sr.approved_at,
  sr.approved_by,
  sr.last_summary,
  sr.quality_gate,
  sr.accessibility_score
`;

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
  finalizeApproval(section: SectionView, context: FinalizeApprovalContext): Promise<SectionView>;
}

/**
 * Section repository implementation
 */
export class SectionRepositoryImpl
  extends BaseRepository<SectionView>
  implements SectionRepository
{
  constructor(db: Database.Database) {
    super(db, 'sections', SectionViewSchema as unknown as z.ZodSchema<SectionView>);
  }

  override async findById(id: string): Promise<SectionView | null> {
    const stmt = this.db.prepare(`${this.buildBaseSelect()} WHERE s.id = ? LIMIT 1`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return this.mapRowToEntity(row);
  }

  override async findAll(options: SectionQueryOptions = {}): Promise<SectionView[]> {
    const { query, params } = this.buildQuery(options);
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find sections by document ID
   */
  async findByDocumentId(docId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    return this.findAll({
      ...options,
      docId,
    });
  }

  /**
   * Find child sections of a parent section
   */
  async findChildren(parentSectionId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    return this.findAll({
      ...options,
      parentSectionId,
      orderBy: options.orderBy ?? 'order_index',
      orderDirection: options.orderDirection ?? 'ASC',
    });
  }

  /**
   * Find root sections (no parent) for a document
   */
  async findRootSections(docId: string, options: QueryOptions = {}): Promise<SectionView[]> {
    const { orderBy, orderDirection, ...rest } = options;
    return this.findAll({
      ...rest,
      docId,
      parentSectionId: null,
      orderBy: orderBy ?? 'order_index',
      orderDirection: orderDirection ?? 'ASC',
    });
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

  async finalizeApproval(
    section: SectionView,
    context: FinalizeApprovalContext
  ): Promise<SectionView> {
    const approvedVersion = Math.max(context.approvedVersion, 1);
    const approvalTimestamp = context.approvedAt.toISOString();
    const hasContent = context.approvedContent.trim().length > 0;
    const status = context.status ?? 'ready';
    const qualityGate: SectionRecordQualityGate =
      context.qualityGate ?? section.qualityGate ?? 'pending';
    const lastSummary = context.lastSummary ?? null;

    this.transaction(db => {
      const ensureRecordStmt = db.prepare(
        `INSERT INTO section_records (
            id,
            document_id,
            template_key,
            title,
            depth,
            order_index,
            approved_version,
            approved_content,
            approved_at,
            approved_by,
            last_summary,
            status,
            quality_gate,
            accessibility_score,
            created_at,
            created_by,
            updated_at,
            updated_by,
            deleted_at,
            deleted_by
         )
         SELECT
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL
         WHERE NOT EXISTS (
            SELECT 1 FROM section_records WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
         )`
      );
      ensureRecordStmt.run(
        section.id,
        section.docId,
        section.key,
        section.title,
        section.depth,
        section.orderIndex,
        section.approvedVersion ?? 0,
        section.approvedContent,
        section.approvedAt ? section.approvedAt.toISOString() : null,
        section.approvedBy ?? null,
        section.lastSummary ?? null,
        section.status,
        section.qualityGate ?? 'pending',
        section.accessibilityScore ?? null,
        approvalTimestamp,
        context.approvedBy,
        approvalTimestamp,
        context.approvedBy,
        section.id
      );

      const updateRecordStmt = db.prepare(
        `UPDATE section_records
            SET approved_content = ?,
                approved_version = ?,
                approved_at = ?,
                approved_by = ?,
                last_summary = ?,
                status = ?,
                quality_gate = ?,
                updated_at = ?,
                updated_by = ?
          WHERE id = ?`
      );
      updateRecordStmt.run(
        context.approvedContent,
        approvedVersion,
        approvalTimestamp,
        context.approvedBy,
        lastSummary,
        status,
        qualityGate,
        approvalTimestamp,
        context.approvedBy,
        section.id
      );

      const updateSectionStmt = db.prepare(
        `UPDATE ${this.tableName}
            SET content_markdown = ?,
                has_content = ?,
                status = ?,
                view_state = ?,
                last_modified = ?,
                updated_at = ?,
                quality_gate_status = ?
          WHERE id = ?`
      );
      updateSectionStmt.run(
        context.approvedContent,
        hasContent ? 1 : 0,
        status,
        'read_mode',
        approvalTimestamp,
        approvalTimestamp,
        qualityGate,
        section.id
      );
    });

    const refreshed = await this.findById(section.id);
    if (!refreshed) {
      throw new Error(`Section ${section.id} not found after approval update`);
    }
    return refreshed;
  }

  private buildBaseSelect(): string {
    return `SELECT ${SECTION_SELECT_COLUMNS}
      FROM ${this.tableName} s
      LEFT JOIN section_records sr ON sr.id = s.id AND (sr.deleted_at IS NULL OR sr.deleted_at = '')`;
  }

  private buildQuery(options: SectionQueryOptions = {}): { query: string; params: unknown[] } {
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (options.docId) {
      whereClauses.push('s.doc_id = ?');
      params.push(options.docId);
    }

    if (Object.prototype.hasOwnProperty.call(options, 'parentSectionId')) {
      if (options.parentSectionId === null) {
        whereClauses.push('s.parent_section_id IS NULL');
      } else if (typeof options.parentSectionId === 'string') {
        whereClauses.push('s.parent_section_id = ?');
        params.push(options.parentSectionId);
      }
    }

    if (options.status) {
      whereClauses.push('s.status = ?');
      params.push(options.status);
    }

    if (options.viewState) {
      whereClauses.push('s.view_state = ?');
      params.push(options.viewState);
    }

    if (typeof options.hasContent === 'boolean') {
      whereClauses.push('s.has_content = ?');
      params.push(options.hasContent ? 1 : 0);
    }

    if (typeof options.depth === 'number') {
      whereClauses.push('s.depth = ?');
      params.push(options.depth);
    }

    if (options.where) {
      for (const [rawColumn, value] of Object.entries(options.where)) {
        const column = this.qualifyColumn(rawColumn);

        if (value === null) {
          whereClauses.push(`${column} IS NULL`);
          continue;
        }

        const normalizedValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        whereClauses.push(`${column} = ?`);
        params.push(normalizedValue);
      }
    }

    let query = this.buildBaseSelect();

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (options.orderBy) {
      query += ` ORDER BY ${this.qualifyColumn(options.orderBy, true)} ${options.orderDirection || 'ASC'}`;
    }

    if (typeof options.limit === 'number') {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (typeof options.offset === 'number') {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    return { query, params };
  }

  private qualifyColumn(column: string, allowQualified = false): string {
    if (allowQualified && column.includes('.')) {
      return column;
    }

    if (SECTION_RECORD_COLUMN_KEYS.has(column)) {
      return `sr.${column}`;
    }

    return column.includes('.') ? column : `s.${column}`;
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
    const normalized: Record<string, unknown> = { ...row };

    if (typeof normalized.has_content === 'number') {
      normalized.has_content = Boolean(normalized.has_content);
    }
    if (typeof normalized.assumptions_resolved === 'number') {
      normalized.assumptions_resolved = Boolean(normalized.assumptions_resolved);
    }

    if (typeof normalized.last_modified === 'string') {
      normalized.last_modified = new Date(normalized.last_modified);
    } else if (normalized.last_modified && !(normalized.last_modified instanceof Date)) {
      normalized.last_modified = new Date(String(normalized.last_modified));
    }

    if (normalized.approved_version == null) {
      normalized.approved_version = 0;
    }
    if (normalized.approved_content == null) {
      normalized.approved_content =
        typeof normalized.content_markdown === 'string' ? normalized.content_markdown : '';
    }
    if (normalized.approved_at === undefined) {
      normalized.approved_at = null;
    }
    if (normalized.approved_by === undefined) {
      normalized.approved_by = null;
    }
    if (normalized.last_summary === undefined) {
      normalized.last_summary = null;
    }
    if (!normalized.quality_gate) {
      normalized.quality_gate = normalized.quality_gate_status ?? 'pending';
    }
    if (normalized.accessibility_score === undefined) {
      normalized.accessibility_score = null;
    }

    return super.mapRowToEntity(normalized);
  }

  protected override mapEntityToRow(entity: SectionView): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    delete row.approved_version;
    delete row.approved_content;
    delete row.approved_at;
    delete row.approved_by;
    delete row.last_summary;
    delete row.quality_gate;
    delete row.accessibility_score;
    return row;
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
