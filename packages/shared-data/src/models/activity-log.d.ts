import Database from 'better-sqlite3';
import { z } from 'zod';
import { BaseRepository } from '../repositories/base-repository.js';
/**
 * ActivityLog entity schema
 */
export declare const ActivityLogSchema: z.ZodObject<
  {
    id: z.ZodString;
    userId: z.ZodString;
    action: z.ZodString;
    resourceType: z.ZodString;
    resourceId: z.ZodString;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    ipAddress: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    userAgent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  'strip',
  z.ZodTypeAny,
  {
    resourceType: string;
    resourceId: string;
    userId: string;
    action: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    ipAddress?: string | null | undefined;
  },
  {
    resourceType: string;
    resourceId: string;
    userId: string;
    action: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    ipAddress?: string | null | undefined;
  }
>;
export type ActivityLog = z.infer<typeof ActivityLogSchema>;
/**
 * Input schema for creating an activity log
 */
export declare const CreateActivityLogSchema: z.ZodObject<
  Omit<
    {
      id: z.ZodString;
      userId: z.ZodString;
      action: z.ZodString;
      resourceType: z.ZodString;
      resourceId: z.ZodString;
      metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
      ipAddress: z.ZodNullable<z.ZodOptional<z.ZodString>>;
      userAgent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
      createdAt: z.ZodDate;
      updatedAt: z.ZodDate;
    },
    'id' | 'createdAt' | 'updatedAt'
  >,
  'strip',
  z.ZodTypeAny,
  {
    resourceType: string;
    resourceId: string;
    userId: string;
    action: string;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    ipAddress?: string | null | undefined;
  },
  {
    resourceType: string;
    resourceId: string;
    userId: string;
    action: string;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    ipAddress?: string | null | undefined;
  }
>;
export type CreateActivityLogInput = z.infer<typeof CreateActivityLogSchema>;
/**
 * Activity log repository interface (read-only except for create)
 */
export interface ActivityLogRepository {
  create(log: CreateActivityLogInput): Promise<ActivityLog>;
  findByUser(userId: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  findByAction(action: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  findByResource(
    resourceType: string,
    resourceId: string,
    options?: ActivityLogQueryOptions
  ): Promise<ActivityLog[]>;
  findById(id: string): Promise<ActivityLog | null>;
}
/**
 * Query options for activity log queries
 */
export interface ActivityLogQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  orderBy?: 'createdAt' | 'action';
  orderDirection?: 'ASC' | 'DESC';
}
/**
 * Activity log repository implementation
 */
export declare class ActivityLogRepositoryImpl
  extends BaseRepository<ActivityLog>
  implements ActivityLogRepository
{
  constructor(db: Database.Database);
  /**
   * Find activity logs by user ID
   */
  findByUser(userId: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  /**
   * Find activity logs by action type
   */
  findByAction(action: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  /**
   * Find activity logs by resource type and ID
   */
  findByResource(
    resourceType: string,
    resourceId: string,
    options?: ActivityLogQueryOptions
  ): Promise<ActivityLog[]>;
  /**
   * Override mapEntityToRow to handle metadata JSON serialization
   */
  protected mapEntityToRow(entity: ActivityLog): Record<string, unknown>;
  /**
   * Override mapRowToEntity to handle metadata JSON parsing
   */
  protected mapRowToEntity(row: Record<string, unknown>): ActivityLog;
}
/**
 * Standard action types
 */
export declare const ACTION_TYPES: {
  readonly AUTH_LOGIN: 'auth.login';
  readonly AUTH_LOGOUT: 'auth.logout';
  readonly AUTH_REFRESH: 'auth.refresh';
  readonly AUTH_FAILED: 'auth.failed';
  readonly PROJECT_CREATE: 'project.create';
  readonly PROJECT_UPDATE: 'project.update';
  readonly PROJECT_DELETE: 'project.delete';
  readonly PROJECT_VIEW: 'project.view';
  readonly CONFIG_UPDATE: 'config.update';
  readonly CONFIG_VIEW: 'config.view';
  readonly CONFIG_RESET: 'config.reset';
  readonly SYSTEM_START: 'system.start';
  readonly SYSTEM_ERROR: 'system.error';
  readonly SYSTEM_MIGRATION: 'system.migration';
};
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];
/**
 * Standard resource types
 */
export declare const RESOURCE_TYPES: {
  readonly USER: 'user';
  readonly PROJECT: 'project';
  readonly CONFIGURATION: 'configuration';
  readonly SYSTEM: 'system';
  readonly SESSION: 'session';
};
export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];
/**
 * Validation functions
 */
export declare const validateActivityLog: (data: unknown) => ActivityLog;
export declare const validateCreateActivityLog: (data: unknown) => CreateActivityLogInput;
/**
 * Activity log utility functions
 */
export declare const ActivityLogUtils: {
  /**
   * Create a standardized activity log entry
   */
  createLogEntry(
    userId: string,
    action: ActionType,
    resourceType: ResourceType,
    resourceId: string,
    metadata?: Record<string, unknown>,
    request?: {
      ip?: string;
      userAgent?: string;
    }
  ): CreateActivityLogInput;
  /**
   * Extract IP address from request headers
   */
  extractIpAddress(headers: Record<string, string | string[]>): string | null;
  /**
   * Extract user agent from request headers
   */
  extractUserAgent(headers: Record<string, string | string[]>): string | null;
  /**
   * Check if action type is valid
   */
  isValidActionType(action: string): action is ActionType;
  /**
   * Check if resource type is valid
   */
  isValidResourceType(resourceType: string): resourceType is ResourceType;
  /**
   * Format activity log for display
   */
  formatLogEntry(log: ActivityLog): string;
};
/**
 * Activity log constants
 */
export declare const ACTIVITY_LOG_CONSTANTS: {
  readonly MAX_ACTION_LENGTH: 100;
  readonly MAX_RESOURCE_TYPE_LENGTH: 50;
  readonly MAX_USER_AGENT_LENGTH: 500;
  readonly DEFAULT_QUERY_LIMIT: 100;
  readonly MAX_QUERY_LIMIT: 1000;
  readonly VALID_ACTIONS: (
    | 'auth.login'
    | 'auth.logout'
    | 'auth.refresh'
    | 'auth.failed'
    | 'project.create'
    | 'project.update'
    | 'project.delete'
    | 'project.view'
    | 'config.update'
    | 'config.view'
    | 'config.reset'
    | 'system.start'
    | 'system.error'
    | 'system.migration'
  )[];
  readonly VALID_RESOURCE_TYPES: ('user' | 'project' | 'configuration' | 'system' | 'session')[];
};
//# sourceMappingURL=activity-log.d.ts.map
