import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from '../repositories/index.js';
import type { Repository } from '../repositories/index.js';

/**
 * Project entity schema
 */
export const ProjectSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
  ownerUserId: z.string().min(1, 'Owner user ID is required'),
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  slug: z
    .string()
    .min(1, 'Project slug is required')
    .max(50, 'Project slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description too long').optional().nullable(),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'Created by is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'Updated by is required'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Input schema for creating a project
 */
export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
}).extend({
  createdBy: z.string().min(1, 'Created by is required'),
  updatedBy: z.string().min(1, 'Updated by is required'),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Input schema for updating a project
 */
export const UpdateProjectSchema = ProjectSchema.partial().omit({
  id: true,
  ownerUserId: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/**
 * Project repository interface
 */
export interface ProjectRepository extends Repository<Project> {
  findBySlug(slug: string): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project | null>;
  findByUserIdWithMembers(userId: string): Promise<Project | null>;
  countByUserId(userId: string): Promise<number>;
}

/**
 * Project repository implementation
 */
export class ProjectRepositoryImpl extends BaseRepository<Project> implements ProjectRepository {
  constructor(db: Database.Database) {
    super(db, 'projects', ProjectSchema);
  }

  /**
   * Find project by slug
   */
  async findBySlug(slug: string): Promise<Project | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM projects
        WHERE slug = ? AND (deleted_at IS NULL OR deleted_at = '')`
    );
    const row = stmt.get(slug) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find project by user ID (MVP: one project per user)
   */
  async findByUserId(userId: string): Promise<Project | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM projects
        WHERE owner_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')`
    );
    const row = stmt.get(userId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find project by user ID including members (MVP: same as findByUserId)
   */
  async findByUserIdWithMembers(userId: string): Promise<Project | null> {
    // In a future iteration, this will join project members and aggregate
    // For MVP, delegate to base lookup
    return this.findByUserId(userId);
  }

  /**
   * Count projects for a given user (MVP: 0 or 1)
   */
  async countByUserId(userId: string): Promise<number> {
    const stmt = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM projects
        WHERE owner_user_id = ? AND (deleted_at IS NULL OR deleted_at = '')`
    );
    const row = stmt.get(userId) as { cnt?: unknown } | undefined;
    const count = typeof row?.cnt === 'number' ? row?.cnt : Number(row?.cnt ?? 0);
    return Number.isFinite(count) ? count : 0;
  }

  /**
   * Override create to ensure slug uniqueness
   */
  override async create(projectData: CreateProjectInput): Promise<Project> {
    // Check if slug already exists
    const existingProject = await this.findBySlug(projectData.slug);
    if (existingProject) {
      throw new Error(`Project with slug '${projectData.slug}' already exists`);
    }

    // Check if user already has a project (MVP constraint)
    const userProject = await this.findByUserId(projectData.ownerUserId);
    if (userProject) {
      throw new Error(`User already has a project. Only one project per user allowed in MVP.`);
    }

    const createdBy = projectData.createdBy || projectData.ownerUserId;
    const updatedBy = projectData.updatedBy || projectData.ownerUserId;

    return super.create({ ...projectData, createdBy, updatedBy });
  }

  /**
   * Override update to check slug uniqueness
   */
  override async update(id: string, updates: UpdateProjectInput): Promise<Project> {
    if (updates.slug) {
      const existingProject = await this.findBySlug(updates.slug);
      if (existingProject && existingProject.id !== id) {
        throw new Error(`Project with slug '${updates.slug}' already exists`);
      }
    }

    return super.update(id, updates);
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
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  },

  /**
   * Validate slug format
   */
  isValidSlug(slug: string): boolean {
    return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 50;
  },

  /**
   * Check if user can create project (MVP: one per user)
   */
  canUserCreateProject(existingProject: Project | null): boolean {
    return existingProject === null;
  },
};

/**
 * Project constants
 */
export const PROJECT_CONSTANTS = {
  MAX_NAME_LENGTH: 100,
  MAX_SLUG_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_NAME_LENGTH: 1,
  MIN_SLUG_LENGTH: 1,
  SLUG_PATTERN: /^[a-z0-9-]+$/,
} as const;
