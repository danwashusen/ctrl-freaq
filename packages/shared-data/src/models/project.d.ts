import { z } from 'zod';
import Database from 'better-sqlite3';
import { BaseRepository, Repository } from '../repositories/index.js';
/**
 * Project entity schema
 */
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    ownerUserId: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    ownerUserId: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string | null | undefined;
}, {
    name: string;
    id: string;
    ownerUserId: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string | null | undefined;
}>;
export type Project = z.infer<typeof ProjectSchema>;
/**
 * Input schema for creating a project
 */
export declare const CreateProjectSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    ownerUserId: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "id" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    name: string;
    ownerUserId: string;
    slug: string;
    description?: string | null | undefined;
}, {
    name: string;
    ownerUserId: string;
    slug: string;
    description?: string | null | undefined;
}>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
/**
 * Input schema for updating a project
 */
export declare const UpdateProjectSchema: z.ZodObject<Omit<{
    id: z.ZodOptional<z.ZodString>;
    ownerUserId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    createdAt: z.ZodOptional<z.ZodDate>;
    updatedAt: z.ZodOptional<z.ZodDate>;
}, "id" | "ownerUserId" | "createdAt" | "updatedAt">, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    slug?: string | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    slug?: string | undefined;
}>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
/**
 * Project repository interface
 */
export interface ProjectRepository extends Repository<Project> {
    findBySlug(slug: string): Promise<Project | null>;
    findByUserId(userId: string): Promise<Project | null>;
}
/**
 * Project repository implementation
 */
export declare class ProjectRepositoryImpl extends BaseRepository<Project> implements ProjectRepository {
    constructor(db: Database.Database);
    /**
     * Find project by slug
     */
    findBySlug(slug: string): Promise<Project | null>;
    /**
     * Find project by user ID (MVP: one project per user)
     */
    findByUserId(userId: string): Promise<Project | null>;
    /**
     * Override create to ensure slug uniqueness
     */
    create(projectData: CreateProjectInput): Promise<Project>;
    /**
     * Override update to check slug uniqueness
     */
    update(id: string, updates: UpdateProjectInput): Promise<Project>;
}
/**
 * Validation functions
 */
export declare const validateProject: (data: unknown) => Project;
export declare const validateCreateProject: (data: unknown) => CreateProjectInput;
export declare const validateUpdateProject: (data: unknown) => UpdateProjectInput;
/**
 * Project utility functions
 */
export declare const ProjectUtils: {
    /**
     * Generate URL-friendly slug from project name
     */
    generateSlug(name: string): string;
    /**
     * Validate slug format
     */
    isValidSlug(slug: string): boolean;
    /**
     * Check if user can create project (MVP: one per user)
     */
    canUserCreateProject(existingProject: Project | null): boolean;
};
/**
 * Project constants
 */
export declare const PROJECT_CONSTANTS: {
    readonly MAX_NAME_LENGTH: 100;
    readonly MAX_SLUG_LENGTH: 50;
    readonly MAX_DESCRIPTION_LENGTH: 500;
    readonly MIN_NAME_LENGTH: 1;
    readonly MIN_SLUG_LENGTH: 1;
    readonly SLUG_PATTERN: RegExp;
};
//# sourceMappingURL=project.d.ts.map