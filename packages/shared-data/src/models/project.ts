import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from '../repositories/index.js';
import type { QueryOptions, Repository } from '../repositories/index.js';

export const PROJECT_VISIBILITY_VALUES = ['private', 'workspace'] as const;
export type ProjectVisibility = (typeof PROJECT_VISIBILITY_VALUES)[number];

export const PROJECT_STATUS_VALUES = ['draft', 'active', 'paused', 'completed', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

const VisibilitySchema = z.enum(PROJECT_VISIBILITY_VALUES);
const StatusSchema = z.enum(PROJECT_STATUS_VALUES);
const NullableStringSchema = z.string().max(500, 'Value too long').nullable();
const GoalSummarySchema = z.string().max(280, 'Goal summary too long').nullable();
const GoalTargetDateSchema = z.union([z.date(), z.null()]);
const ArchivedStatusSnapshotSchema = z
  .enum(['draft', 'active', 'paused', 'completed'] as const)
  .nullable();

export const PROJECT_CONSTANTS = {
  MAX_NAME_LENGTH: 120,
  MAX_SLUG_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_GOAL_SUMMARY_LENGTH: 280,
  DEFAULT_STATUS: 'draft' as ProjectStatus,
  DEFAULT_VISIBILITY: 'workspace' as ProjectVisibility,
  ARCHIVED_STATUS: 'archived' as ProjectStatus,
  RESTORED_STATUS: 'paused' as ProjectStatus,
} as const;

/**
 * Project entity schema
 */
export const ProjectSchema = z
  .object({
    id: z.string().uuid('Invalid project ID format'),
    ownerUserId: z.string().min(1, 'Owner user ID is required'),
    name: z
      .string()
      .min(1, 'Project name is required')
      .max(PROJECT_CONSTANTS.MAX_NAME_LENGTH, 'Project name too long'),
    slug: z
      .string()
      .min(1, 'Project slug is required')
      .max(50, 'Project slug too long')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: NullableStringSchema.default(null),
    visibility: VisibilitySchema,
    status: StatusSchema,
    archivedStatusBefore: ArchivedStatusSnapshotSchema.default(null),
    goalTargetDate: GoalTargetDateSchema.default(null),
    goalSummary: GoalSummarySchema.default(null),
    createdAt: z.date(),
    createdBy: z.string().min(1, 'Created by is required'),
    updatedAt: z.date(),
    updatedBy: z.string().min(1, 'Updated by is required'),
    deletedAt: z.union([z.date(), z.null()]).optional(),
    deletedBy: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === PROJECT_CONSTANTS.ARCHIVED_STATUS) {
      if (!value.deletedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deletedAt'],
          message: 'Archived projects must record deletedAt',
        });
      }
      if (!value.deletedBy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deletedBy'],
          message: 'Archived projects must record deletedBy',
        });
      }
      if (!value.archivedStatusBefore) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['archivedStatusBefore'],
          message: 'Archived projects must record the pre-archive status',
        });
      }
    } else {
      if (value.deletedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deletedAt'],
          message: 'Only archived projects may include deletedAt',
        });
      }
      if (value.deletedBy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deletedBy'],
          message: 'Only archived projects may include deletedBy',
        });
      }
      if (value.archivedStatusBefore) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['archivedStatusBefore'],
          message: 'Pre-archive status applies only to archived projects',
        });
      }
    }
  });

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Input schema for creating a project
 */
export const CreateProjectSchema = z.object({
  ownerUserId: ProjectSchema.shape.ownerUserId,
  name: ProjectSchema.shape.name,
  slug: ProjectSchema.shape.slug,
  description: NullableStringSchema.optional(),
  visibility: VisibilitySchema.optional().default(PROJECT_CONSTANTS.DEFAULT_VISIBILITY),
  status: StatusSchema.optional().default(PROJECT_CONSTANTS.DEFAULT_STATUS),
  goalTargetDate: GoalTargetDateSchema.optional().default(null),
  goalSummary: GoalSummarySchema.optional().default(null),
  createdBy: z.string().min(1, 'Created by is required'),
  updatedBy: z.string().min(1, 'Updated by is required'),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Input schema for updating a project
 */
const MUTABLE_STATUS_VALUES = ['draft', 'active', 'paused', 'completed'] as const;
const EditableStatusSchema = z.enum(MUTABLE_STATUS_VALUES);

export const UpdateProjectSchema = z
  .object({
    name: ProjectSchema.shape.name.optional(),
    slug: ProjectSchema.shape.slug.optional(),
    description: NullableStringSchema.optional(),
    visibility: VisibilitySchema.optional(),
    status: EditableStatusSchema.optional(),
    goalTargetDate: GoalTargetDateSchema.optional(),
    goalSummary: GoalSummarySchema.optional(),
    updatedBy: z.string().min(1, 'Updated by is required').optional(),
  })
  .refine(
    data =>
      data.name !== undefined ||
      data.slug !== undefined ||
      data.description !== undefined ||
      data.visibility !== undefined ||
      data.status !== undefined ||
      data.goalTargetDate !== undefined ||
      data.goalSummary !== undefined ||
      data.updatedBy !== undefined,
    {
      message: 'At least one project field must be provided for update',
    }
  );

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export interface ProjectListOptions extends QueryOptions {
  searchTerm?: string;
  includeArchived?: boolean;
}

/**
 * Project repository interface
 */
export interface ProjectRepository extends Repository<Project> {
  findBySlug(
    slug: string,
    options?: {
      includeArchived?: boolean;
    }
  ): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project | null>;
  findManyByUserId(userId: string, options?: ProjectListOptions): Promise<Project[]>;
  findByUserIdWithMembers(userId: string): Promise<Project | null>;
  findByIdIncludingArchived(id: string): Promise<Project | null>;
  countByUserId(
    userId: string,
    options?: { includeArchived?: boolean; searchTerm?: string }
  ): Promise<number>;
  archiveProject(id: string, archivedBy: string, archivedAt?: Date): Promise<Project>;
  restoreProject(id: string, restoredBy: string, restoredAt?: Date): Promise<Project>;
}

/**
 * Project repository implementation
 */
export class ProjectRepositoryImpl extends BaseRepository<Project> implements ProjectRepository {
  constructor(db: Database.Database) {
    super(db, 'projects', ProjectSchema);
  }

  protected override mapRowToEntity(row: Record<string, unknown>): Project {
    const normalizedRow = { ...row };
    const rawGoalTargetDate = normalizedRow['goal_target_date'];
    if (typeof rawGoalTargetDate === 'string' && rawGoalTargetDate.trim().length > 0) {
      normalizedRow['goal_target_date'] = new Date(rawGoalTargetDate);
    }
    if (rawGoalTargetDate === null || rawGoalTargetDate === '') {
      normalizedRow['goal_target_date'] = null;
    }
    if ('archived_status_before' in normalizedRow) {
      const snapshot = normalizedRow['archived_status_before'];
      normalizedRow['archivedStatusBefore'] =
        typeof snapshot === 'string' && snapshot.length > 0 ? snapshot : null;
      delete normalizedRow['archived_status_before'];
    } else if (!('archivedStatusBefore' in normalizedRow)) {
      normalizedRow['archivedStatusBefore'] = null;
    }

    const status = typeof normalizedRow['status'] === 'string' ? normalizedRow['status'] : null;
    const needsSnapshotBackfill =
      status === PROJECT_CONSTANTS.ARCHIVED_STATUS &&
      (normalizedRow['archivedStatusBefore'] === null ||
        normalizedRow['archivedStatusBefore'] === undefined ||
        normalizedRow['archivedStatusBefore'] === '');

    if (needsSnapshotBackfill) {
      normalizedRow['archivedStatusBefore'] = PROJECT_CONSTANTS.RESTORED_STATUS;

      if (!this.db.readonly && typeof normalizedRow['id'] === 'string') {
        this.db
          .prepare(`UPDATE ${this.tableName} SET archived_status_before = ? WHERE id = ?`)
          .run(PROJECT_CONSTANTS.RESTORED_STATUS, normalizedRow['id']);
      }
    }

    return super.mapRowToEntity(normalizedRow);
  }

  /**
   * Find project by slug
   */
  async findBySlug(
    slug: string,
    options: {
      includeArchived?: boolean;
    } = {}
  ): Promise<Project | null> {
    const { includeArchived = false } = options;
    const query = includeArchived
      ? `SELECT * FROM projects WHERE slug = ?`
      : `SELECT * FROM projects WHERE slug = ? AND (deleted_at IS NULL OR deleted_at = '')`;
    const stmt = this.db.prepare(query);
    const row = stmt.get(slug) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find latest project for a user (if any)
   */
  async findByUserId(userId: string): Promise<Project | null> {
    const projects = await this.findManyByUserId(userId, {
      limit: 1,
      includeArchived: false,
      orderBy: 'updated_at',
      orderDirection: 'DESC',
    });
    return projects[0] ?? null;
  }

  /**
   * For future joins; currently same as findByUserId
   */
  async findByUserIdWithMembers(userId: string): Promise<Project | null> {
    return this.findByUserId(userId);
  }

  async findByIdIncludingArchived(id: string): Promise<Project | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async findManyByUserId(userId: string, options: ProjectListOptions = {}): Promise<Project[]> {
    const {
      searchTerm,
      includeArchived = false,
      limit,
      offset,
      orderBy,
      orderDirection,
    } = options;

    const { column, direction } = resolveOrdering(orderBy, orderDirection);
    const params: unknown[] = [userId];

    let query = `SELECT * FROM projects WHERE owner_user_id = ?`;

    if (!includeArchived) {
      query += ` AND (deleted_at IS NULL OR deleted_at = '')`;
    }

    if (typeof searchTerm === 'string' && searchTerm.trim().length > 0) {
      const like = `%${searchTerm.trim().toLowerCase()}%`;
      query +=
        ` AND (LOWER(name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(IFNULL(description, '')) LIKE ? OR LOWER(IFNULL(goal_summary, '')) LIKE ?)`;
      params.push(like, like, like, like);
    }

    query += ` ORDER BY ${column} ${direction}`;

    if (typeof limit === 'number') {
      query += ` LIMIT ?`;
      params.push(limit);
    }
    if (typeof offset === 'number') {
      query += ` OFFSET ?`;
      params.push(offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async countByUserId(
    userId: string,
    options: { includeArchived?: boolean; searchTerm?: string } = {}
  ): Promise<number> {
    const { includeArchived = false, searchTerm } = options;
    const params: unknown[] = [userId];

    let query = `SELECT COUNT(*) as cnt FROM projects WHERE owner_user_id = ?`;

    if (!includeArchived) {
      query += ` AND (deleted_at IS NULL OR deleted_at = '')`;
    }

    if (typeof searchTerm === 'string' && searchTerm.trim().length > 0) {
      const like = `%${searchTerm.trim().toLowerCase()}%`;
      query +=
        ` AND (LOWER(name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(IFNULL(description, '')) LIKE ? OR LOWER(IFNULL(goal_summary, '')) LIKE ?)`;
      params.push(like, like, like, like);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as { cnt?: unknown } | undefined;
    const count = typeof row?.cnt === 'number' ? row.cnt : Number(row?.cnt ?? 0);
    return Number.isFinite(count) ? Number(count) : 0;
  }

  override async create(projectData: CreateProjectInput): Promise<Project> {
    const existingProject = await this.findBySlug(projectData.slug, { includeArchived: true });
    if (existingProject) {
      throw new Error(
        `Project with slug '${projectData.slug}' already exists (archived project detected)`
      );
    }

    return super.create({
      ...projectData,
      description: projectData.description ?? null,
      visibility: projectData.visibility ?? PROJECT_CONSTANTS.DEFAULT_VISIBILITY,
      status: projectData.status ?? PROJECT_CONSTANTS.DEFAULT_STATUS,
      archivedStatusBefore: null,
      goalTargetDate: projectData.goalTargetDate ?? null,
      goalSummary: projectData.goalSummary ?? null,
      createdBy: projectData.createdBy || projectData.ownerUserId,
      updatedBy: projectData.updatedBy || projectData.ownerUserId,
    });
  }

  override async update(id: string, updates: UpdateProjectInput): Promise<Project> {
    if (updates.slug) {
      const existingProject = await this.findBySlug(updates.slug, { includeArchived: true });
      if (existingProject && existingProject.id !== id) {
        throw new Error(
          `Project with slug '${updates.slug}' already exists (archived project detected)`
        );
      }
    }

    const normalized: UpdateProjectInput = { ...updates };
    if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
      normalized.description = updates.description ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'goalSummary')) {
      normalized.goalSummary = updates.goalSummary ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'goalTargetDate')) {
      normalized.goalTargetDate = updates.goalTargetDate ?? null;
    }

    return super.update(id, normalized);
  }

  async archiveProject(id: string, archivedBy: string, archivedAt = new Date()): Promise<Project> {
    const project = await this.findById(id);
    if (!project) {
      throw new Error(`Project not found with id: ${id}`);
    }
    if (project.status === PROJECT_CONSTANTS.ARCHIVED_STATUS) {
      return project;
    }

    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
        SET status = ?, archived_status_before = ?, deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
        WHERE id = ?`
    );
    const timestamp = archivedAt.toISOString();
    stmt.run(
      PROJECT_CONSTANTS.ARCHIVED_STATUS,
      project.status,
      timestamp,
      archivedBy,
      timestamp,
      archivedBy,
      id
    );

    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error(`Failed to load archived project with id: ${id}`);
    }

    return this.mapRowToEntity(row);
  }

  async restoreProject(id: string, restoredBy: string, restoredAt = new Date()): Promise<Project> {
    const project = await this.findByIdIncludingArchived(id);
    if (!project) {
      throw new Error(`Project not found with id: ${id}`);
    }
    if (project.status !== PROJECT_CONSTANTS.ARCHIVED_STATUS) {
      return project;
    }

    const restoredStatus =
      project.archivedStatusBefore ?? PROJECT_CONSTANTS.RESTORED_STATUS;
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
        SET status = ?, archived_status_before = NULL, deleted_at = NULL, deleted_by = NULL, updated_at = ?, updated_by = ?
        WHERE id = ?`
    );
    const timestamp = restoredAt.toISOString();
    stmt.run(restoredStatus, timestamp, restoredBy, id);

    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      throw new Error(`Failed to load restored project with id: ${id}`);
    }

    return this.mapRowToEntity(row);
  }
}

/**
 * Validation functions
 */
export const validateProject = (data: unknown): Project => {
  return ProjectSchema.parse(data);
};

export const validateCreateProject = (data: unknown): CreateProjectInput => {
  return CreateProjectSchema.parse(data);
};

export const validateUpdateProject = (data: unknown): UpdateProjectInput => {
  return UpdateProjectSchema.parse(data);
};

/**
 * Project utility functions
 */
export const ProjectUtils = {
  /**
   * Generate URL-friendly slug from project name
   */
  generateSlug(name: string): string {
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    if (slug.length > PROJECT_CONSTANTS.MAX_SLUG_LENGTH) {
      slug = slug.slice(0, PROJECT_CONSTANTS.MAX_SLUG_LENGTH).replace(/-+$/g, '');
    }

    return slug;
  },
};
function resolveOrdering(
  orderBy?: string,
  orderDirection?: 'ASC' | 'DESC'
): { column: string; direction: 'ASC' | 'DESC' } {
  const allowedColumns = new Map<string, string>([
    ['name', 'name'],
    ['created_at', 'created_at'],
    ['createdAt', 'created_at'],
    ['updated_at', 'updated_at'],
    ['updatedAt', 'updated_at'],
  ]);

  const column = allowedColumns.get(orderBy ?? '') ?? 'updated_at';
  const direction = orderDirection === 'ASC' ? 'ASC' : 'DESC';

  return { column, direction };
}
