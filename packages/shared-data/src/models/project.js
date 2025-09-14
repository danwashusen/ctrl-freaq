import { z } from 'zod';
import { BaseRepository } from '../repositories/index.js';
/**
 * Project entity schema
 */
export const ProjectSchema = z.object({
    id: z.string().uuid('Invalid project ID format'),
    ownerUserId: z.string().min(1, 'Owner user ID is required'),
    name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
    slug: z.string()
        .min(1, 'Project slug is required')
        .max(50, 'Project slug too long')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: z.string().max(500, 'Description too long').optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
});
/**
 * Input schema for creating a project
 */
export const CreateProjectSchema = ProjectSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});
/**
 * Input schema for updating a project
 */
export const UpdateProjectSchema = ProjectSchema.partial().omit({
    id: true,
    ownerUserId: true,
    createdAt: true,
    updatedAt: true
});
/**
 * Project repository implementation
 */
export class ProjectRepositoryImpl extends BaseRepository {
    constructor(db) {
        super(db, 'projects', ProjectSchema);
    }
    /**
     * Find project by slug
     */
    async findBySlug(slug) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE slug = ?');
        const row = stmt.get(slug);
        if (!row)
            return null;
        return this.mapRowToEntity(row);
    }
    /**
     * Find project by user ID (MVP: one project per user)
     */
    async findByUserId(userId) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE owner_user_id = ?');
        const row = stmt.get(userId);
        if (!row)
            return null;
        return this.mapRowToEntity(row);
    }
    /**
     * Override create to ensure slug uniqueness
     */
    async create(projectData) {
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
        return super.create(projectData);
    }
    /**
     * Override update to check slug uniqueness
     */
    async update(id, updates) {
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
export const validateProject = (data) => {
    return ProjectSchema.parse(data);
};
export const validateCreateProject = (data) => {
    return CreateProjectSchema.parse(data);
};
export const validateUpdateProject = (data) => {
    return UpdateProjectSchema.parse(data);
};
/**
 * Project utility functions
 */
export const ProjectUtils = {
    /**
     * Generate URL-friendly slug from project name
     */
    generateSlug(name) {
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
    isValidSlug(slug) {
        return /^[a-z0-9-]+$/.test(slug) && slug.length >= 1 && slug.length <= 50;
    },
    /**
     * Check if user can create project (MVP: one per user)
     */
    canUserCreateProject(existingProject) {
        return existingProject === null;
    }
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
    SLUG_PATTERN: /^[a-z0-9-]+$/
};
//# sourceMappingURL=project.js.map