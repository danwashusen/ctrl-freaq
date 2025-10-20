/**
 * Utility functions for shared data operations
 */
/**
 * Generate a new UUID
 */
export declare function generateId(): string;
/**
 * Generate a URL-friendly slug from a string
 */
export declare function generateSlug(text: string): string;
/**
 * Convert camelCase to snake_case
 */
export declare function camelToSnake(str: string): string;
/**
 * Convert snake_case to camelCase
 */
export declare function snakeToCamel(str: string): string;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export declare function isEmpty(value: unknown): boolean;
/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Sanitize string for database insertion
 */
export declare function sanitizeString(str: string): string;
/**
 * Format date for database storage (ISO string)
 */
export declare function formatDateForDB(date: Date): string;
/**
 * Parse date from database (ISO string to Date)
 */
export declare function parseDateFromDB(dateString: string): Date;
export { resolveWorkspaceDatabasePath } from './database-path.js';
export { resolveWorkspaceRoot } from './workspace-path.js';
//# sourceMappingURL=index.d.ts.map
