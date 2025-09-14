import { z } from 'zod';
import Database from 'better-sqlite3';
import { BaseRepository } from '../repositories/base-repository.js';

/**
 * ActivityLog entity schema
 */
export const ActivityLogSchema = z.object({
  id: z.string().uuid('Invalid activity log ID format'),
  userId: z.string().min(1, 'User ID is required'),
  action: z.string().min(1, 'Action is required').max(100, 'Action too long'),
  resourceType: z.string().min(1, 'Resource type is required').max(50, 'Resource type too long'),
  resourceId: z.string().min(1, 'Resource ID is required'),
  metadata: z.record(z.any()).optional().nullable(),
  ipAddress: z.string().ip().optional().nullable(),
  userAgent: z.string().max(500, 'User agent too long').optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type ActivityLog = z.infer<typeof ActivityLogSchema>;

/**
 * Input schema for creating an activity log
 */
export const CreateActivityLogSchema = ActivityLogSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type CreateActivityLogInput = z.infer<typeof CreateActivityLogSchema>;

/**
 * Activity log repository interface (read-only except for create)
 */
export interface ActivityLogRepository {
  create(log: CreateActivityLogInput): Promise<ActivityLog>;
  findByUser(userId: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  findByAction(action: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
  findByResource(resourceType: string, resourceId: string, options?: ActivityLogQueryOptions): Promise<ActivityLog[]>;
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
export class ActivityLogRepositoryImpl extends BaseRepository<ActivityLog> implements ActivityLogRepository {
  constructor(db: Database.Database) {
    super(db, 'activity_logs', ActivityLogSchema);
  }

  /**
   * Find activity logs by user ID
   */
  async findByUser(userId: string, options: ActivityLogQueryOptions = {}): Promise<ActivityLog[]> {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      orderBy = 'createdAt',
      orderDirection = 'DESC'
    } = options;

    let query = 'SELECT * FROM activity_logs WHERE user_id = ?';
    const params: any[] = [userId];

    // Add date range filters
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ` ORDER BY ${orderBy === 'createdAt' ? 'created_at' : 'action'} ${orderDirection}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, any>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find activity logs by action type
   */
  async findByAction(action: string, options: ActivityLogQueryOptions = {}): Promise<ActivityLog[]> {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      orderBy = 'createdAt',
      orderDirection = 'DESC'
    } = options;

    let query = 'SELECT * FROM activity_logs WHERE action = ?';
    const params: any[] = [action];

    // Add date range filters
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ` ORDER BY ${orderBy === 'createdAt' ? 'created_at' : 'action'} ${orderDirection}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, any>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find activity logs by resource type and ID
   */
  async findByResource(resourceType: string, resourceId: string, options: ActivityLogQueryOptions = {}): Promise<ActivityLog[]> {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      orderBy = 'createdAt',
      orderDirection = 'DESC'
    } = options;

    let query = 'SELECT * FROM activity_logs WHERE resource_type = ? AND resource_id = ?';
    const params: any[] = [resourceType, resourceId];

    // Add date range filters
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    query += ` ORDER BY ${orderBy === 'createdAt' ? 'created_at' : 'action'} ${orderDirection}`;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, any>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Override mapEntityToRow to handle metadata JSON serialization
   */
  protected mapEntityToRow(entity: ActivityLog): Record<string, any> {
    const row = super.mapEntityToRow(entity);

    // Serialize metadata as JSON
    if (entity.metadata) {
      row.metadata = JSON.stringify(entity.metadata);
    }

    return row;
  }

  /**
   * Override mapRowToEntity to handle metadata JSON parsing
   */
  protected mapRowToEntity(row: Record<string, any>): ActivityLog {
    // Parse metadata JSON
    if (row.metadata && typeof row.metadata === 'string') {
      try {
        row.metadata = JSON.parse(row.metadata);
      } catch {
        row.metadata = null;
      }
    }

    return super.mapRowToEntity(row);
  }
}

/**
 * Standard action types
 */
export const ACTION_TYPES = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_FAILED: 'auth.failed',

  // Projects
  PROJECT_CREATE: 'project.create',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',
  PROJECT_VIEW: 'project.view',

  // Configuration
  CONFIG_UPDATE: 'config.update',
  CONFIG_VIEW: 'config.view',
  CONFIG_RESET: 'config.reset',

  // System
  SYSTEM_START: 'system.start',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_MIGRATION: 'system.migration'
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

/**
 * Standard resource types
 */
export const RESOURCE_TYPES = {
  USER: 'user',
  PROJECT: 'project',
  CONFIGURATION: 'configuration',
  SYSTEM: 'system',
  SESSION: 'session'
} as const;

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

/**
 * Validation functions
 */
export const validateActivityLog = (data: unknown): ActivityLog => {
  return ActivityLogSchema.parse(data);
};

export const validateCreateActivityLog = (data: unknown): CreateActivityLogInput => {
  return CreateActivityLogSchema.parse(data);
};

/**
 * Activity log utility functions
 */
export const ActivityLogUtils = {
  /**
   * Create a standardized activity log entry
   */
  createLogEntry(
    userId: string,
    action: ActionType,
    resourceType: ResourceType,
    resourceId: string,
    metadata?: Record<string, any>,
    request?: { ip?: string; userAgent?: string }
  ): CreateActivityLogInput {
    return {
      userId,
      action,
      resourceType,
      resourceId,
      metadata,
      ipAddress: request?.ip ?? null,
      userAgent: request?.userAgent ?? null
    };
  },

  /**
   * Extract IP address from request headers
   */
  extractIpAddress(headers: Record<string, string | string[]>): string | null {
    // Check for forwarded headers first (reverse proxy/load balancer)
    const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ip?.split(',')[0]?.trim() || null;
    }

    // Check real IP header
    const realIp = headers['x-real-ip'] || headers['X-Real-IP'];
    if (realIp) {
      return Array.isArray(realIp) ? (realIp[0] ?? null) : realIp;
    }

    return null;
  },

  /**
   * Extract user agent from request headers
   */
  extractUserAgent(headers: Record<string, string | string[]>): string | null {
    const userAgent = headers['user-agent'] || headers['User-Agent'];
    if (userAgent) {
      return Array.isArray(userAgent) ? (userAgent[0] ?? null) : userAgent;
    }
    return null;
  },

  /**
   * Check if action type is valid
   */
  isValidActionType(action: string): action is ActionType {
    return Object.values(ACTION_TYPES).includes(action as ActionType);
  },

  /**
   * Check if resource type is valid
   */
  isValidResourceType(resourceType: string): resourceType is ResourceType {
    return Object.values(RESOURCE_TYPES).includes(resourceType as ResourceType);
  },

  /**
   * Format activity log for display
   */
  formatLogEntry(log: ActivityLog): string {
    const timestamp = log.createdAt.toISOString();
    const action = log.action;
    const resource = `${log.resourceType}:${log.resourceId}`;

    return `[${timestamp}] ${action} on ${resource} by ${log.userId}`;
  }
};

/**
 * Activity log constants
 */
export const ACTIVITY_LOG_CONSTANTS = {
  MAX_ACTION_LENGTH: 100,
  MAX_RESOURCE_TYPE_LENGTH: 50,
  MAX_USER_AGENT_LENGTH: 500,
  DEFAULT_QUERY_LIMIT: 100,
  MAX_QUERY_LIMIT: 1000,
  VALID_ACTIONS: Object.values(ACTION_TYPES),
  VALID_RESOURCE_TYPES: Object.values(RESOURCE_TYPES)
} as const;