import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { z } from 'zod';

import { BaseRepository } from '../repositories/base-repository';

/**
 * User entity schema for Clerk authentication integration.
 * Includes SOC 2 audit fields for compliance.
 */
export const UserSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
  clerk_id: z.string().min(1, 'Clerk ID is required'), // Clerk user ID (e.g., "user_2abc...")
  email: z.string().email('Invalid email address'),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  profile_image_url: z.string().url().optional().nullable(),
  // SOC 2 audit fields - using camelCase for TypeScript compatibility
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  deletedBy: z.string().uuid().optional(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Input schema for creating a user reference (from Clerk webhook)
 */
export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * Input schema for updating user information
 */
export const UpdateUserSchema = CreateUserSchema.partial().omit({
  createdBy: true,
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/**
 * Validation functions
 */
export const validateUser = (data: unknown): User => {
  return UserSchema.parse(data);
};

export const validateCreateUser = (data: unknown): CreateUserInput => {
  return CreateUserSchema.parse(data);
};

export const validateUpdateUser = (data: unknown): UpdateUserInput => {
  return UpdateUserSchema.parse(data);
};

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
export class UserRepository extends BaseRepository<User> {
  protected logger: Logger;

  constructor(db: Database.Database, logger: Logger) {
    super(db, 'users', UserSchema);
    this.logger = logger;
  }

  protected getCreateSchema() {
    return CreateUserSchema;
  }

  protected getUpdateSchema() {
    return UpdateUserSchema;
  }

  async findByClerkId(clerkId: string): Promise<User | undefined> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE clerk_id = ? AND deleted_at IS NULL
      `);
      const row = stmt.get(clerkId);

      if (!row) {
        return undefined;
      }

      return this.mapRowToEntity(row as Record<string, unknown>);
    } catch (error) {
      this.logger.error(
        {
          clerkId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to find user by Clerk ID'
      );
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE email = ? AND deleted_at IS NULL
      `);
      const row = stmt.get(email);

      if (!row) {
        return undefined;
      }

      return this.mapRowToEntity(row as Record<string, unknown>);
    } catch (error) {
      this.logger.error(
        {
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to find user by email'
      );
      throw error;
    }
  }

  async findMany(
    filters: UserFilters = {},
    options: { limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    try {
      const conditions = ['deleted_at IS NULL'];
      const params: unknown[] = [];

      if (filters.clerk_id) {
        conditions.push('clerk_id = ?');
        params.push(filters.clerk_id);
      }

      if (filters.email) {
        conditions.push('email LIKE ?');
        params.push(`%${filters.email}%`);
      }

      if (filters.name) {
        conditions.push('(first_name LIKE ? OR last_name LIKE ?)');
        params.push(`%${filters.name}%`, `%${filters.name}%`);
      }

      let query = `
        SELECT * FROM ${this.tableName}
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
      `;

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      return rows.map(row => this.mapRowToEntity(row as Record<string, unknown>));
    } catch (error) {
      this.logger.error(
        {
          filters,
          options,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to find users with filters'
      );
      throw error;
    }
  }

  protected getTableSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY NOT NULL,
        clerk_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        profile_image_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        deleted_by TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id),
        FOREIGN KEY (deleted_by) REFERENCES users(id)
      )
    `;
  }

  protected getIndexes(): string[] {
    return [
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_clerk_id ON ${this.tableName}(clerk_id)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_email ON ${this.tableName}(email)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_created_at ON ${this.tableName}(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_deleted_at ON ${this.tableName}(deleted_at)`,
    ];
  }
}

/**
 * User utility functions
 */
export const UserUtils = {
  /**
   * Check if a string is a valid Clerk user ID format
   */
  isValidClerkUserId(id: string): boolean {
    return /^user_[a-zA-Z0-9]+$/.test(id);
  },

  /**
   * Get display name (first_name + last_name || email username)
   */
  getDisplayName(user: User): string {
    if (user.first_name || user.last_name) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ');
    }
    return user.email.split('@')[0] || 'user';
  },

  /**
   * Get user initials for avatar fallback
   */
  getInitials(user: User): string {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';

    if (firstName && lastName) {
      const firstInitial = firstName.charAt(0);
      const lastInitial = lastName.charAt(0);
      return (firstInitial + lastInitial).toUpperCase();
    }

    if (firstName) {
      return firstName.substring(0, 2).toUpperCase();
    }

    if (lastName) {
      return lastName.substring(0, 2).toUpperCase();
    }

    return user.email.substring(0, 2).toUpperCase();
  },
};

/**
 * User constants
 */
export const USER_CONSTANTS = {
  MAX_NAME_LENGTH: 100,
  MIN_ID_LENGTH: 5,
  DEFAULT_IMAGE_SIZE: 80,
} as const;
