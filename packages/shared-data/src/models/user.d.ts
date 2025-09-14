import { z } from 'zod';
import Database from 'better-sqlite3';
import { BaseRepository } from '../repositories/base-repository';
import { Logger } from 'pino';
/**
 * User entity schema for Clerk authentication integration.
 * Includes SOC 2 audit fields for compliance.
 */
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    clerk_id: z.ZodString;
    email: z.ZodString;
    first_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    last_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    profile_image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    deletedAt: z.ZodOptional<z.ZodDate>;
    createdBy: z.ZodString;
    updatedBy: z.ZodString;
    deletedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    clerk_id: string;
    createdBy: string;
    updatedBy: string;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
    deletedAt?: Date | undefined;
    deletedBy?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    clerk_id: string;
    createdBy: string;
    updatedBy: string;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
    deletedAt?: Date | undefined;
    deletedBy?: string | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
/**
 * Input schema for creating a user reference (from Clerk webhook)
 */
export declare const CreateUserSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    clerk_id: z.ZodString;
    email: z.ZodString;
    first_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    last_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    profile_image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    deletedAt: z.ZodOptional<z.ZodDate>;
    createdBy: z.ZodString;
    updatedBy: z.ZodString;
    deletedBy: z.ZodOptional<z.ZodString>;
}, "id" | "createdAt" | "updatedAt" | "deletedAt" | "deletedBy">, "strip", z.ZodTypeAny, {
    email: string;
    clerk_id: string;
    createdBy: string;
    updatedBy: string;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
}, {
    email: string;
    clerk_id: string;
    createdBy: string;
    updatedBy: string;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
}>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
/**
 * Input schema for updating user information
 */
export declare const UpdateUserSchema: z.ZodObject<Omit<{
    email: z.ZodOptional<z.ZodString>;
    clerk_id: z.ZodOptional<z.ZodString>;
    first_name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    last_name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    profile_image_url: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    createdBy: z.ZodOptional<z.ZodString>;
    updatedBy: z.ZodOptional<z.ZodString>;
}, "createdBy">, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    clerk_id?: string | undefined;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
    updatedBy?: string | undefined;
}, {
    email?: string | undefined;
    clerk_id?: string | undefined;
    first_name?: string | null | undefined;
    last_name?: string | null | undefined;
    profile_image_url?: string | null | undefined;
    updatedBy?: string | undefined;
}>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
/**
 * Validation functions
 */
export declare const validateUser: (data: unknown) => User;
export declare const validateCreateUser: (data: unknown) => CreateUserInput;
export declare const validateUpdateUser: (data: unknown) => UpdateUserInput;
/**
 * User filters for repository queries
 */
export interface UserFilters {
    clerk_id?: string;
    email?: string;
    name?: string;
}
/**
 * User Repository implementation with SOC 2 compliance
 */
export declare class UserRepository extends BaseRepository<User> {
    protected logger: Logger;
    constructor(db: Database.Database, logger: Logger);
    protected getCreateSchema(): z.ZodObject<Omit<{
        id: z.ZodString;
        clerk_id: z.ZodString;
        email: z.ZodString;
        first_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        last_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        profile_image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
        deletedAt: z.ZodOptional<z.ZodDate>;
        createdBy: z.ZodString;
        updatedBy: z.ZodString;
        deletedBy: z.ZodOptional<z.ZodString>;
    }, "id" | "createdAt" | "updatedAt" | "deletedAt" | "deletedBy">, "strip", z.ZodTypeAny, {
        email: string;
        clerk_id: string;
        createdBy: string;
        updatedBy: string;
        first_name?: string | null | undefined;
        last_name?: string | null | undefined;
        profile_image_url?: string | null | undefined;
    }, {
        email: string;
        clerk_id: string;
        createdBy: string;
        updatedBy: string;
        first_name?: string | null | undefined;
        last_name?: string | null | undefined;
        profile_image_url?: string | null | undefined;
    }>;
    protected getUpdateSchema(): z.ZodObject<Omit<{
        email: z.ZodOptional<z.ZodString>;
        clerk_id: z.ZodOptional<z.ZodString>;
        first_name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
        last_name: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
        profile_image_url: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
        createdBy: z.ZodOptional<z.ZodString>;
        updatedBy: z.ZodOptional<z.ZodString>;
    }, "createdBy">, "strip", z.ZodTypeAny, {
        email?: string | undefined;
        clerk_id?: string | undefined;
        first_name?: string | null | undefined;
        last_name?: string | null | undefined;
        profile_image_url?: string | null | undefined;
        updatedBy?: string | undefined;
    }, {
        email?: string | undefined;
        clerk_id?: string | undefined;
        first_name?: string | null | undefined;
        last_name?: string | null | undefined;
        profile_image_url?: string | null | undefined;
        updatedBy?: string | undefined;
    }>;
    findByClerkId(clerkId: string): Promise<User | undefined>;
    findByEmail(email: string): Promise<User | undefined>;
    findMany(filters?: UserFilters, options?: {
        limit?: number;
        offset?: number;
    }): Promise<User[]>;
    protected getTableSchema(): string;
    protected getIndexes(): string[];
}
/**
 * User utility functions
 */
export declare const UserUtils: {
    /**
     * Check if a string is a valid Clerk user ID format
     */
    isValidClerkUserId(id: string): boolean;
    /**
     * Get display name (first_name + last_name || email username)
     */
    getDisplayName(user: User): string;
    /**
     * Get user initials for avatar fallback
     */
    getInitials(user: User): string;
};
/**
 * User constants
 */
export declare const USER_CONSTANTS: {
    readonly MAX_NAME_LENGTH: 100;
    readonly MIN_ID_LENGTH: 5;
    readonly DEFAULT_IMAGE_SIZE: 80;
};
//# sourceMappingURL=user.d.ts.map