import Database from 'better-sqlite3';
import { z } from 'zod';
import { QueryOptions } from '../types/index.js';
/**
 * Base repository class providing common CRUD operations.
 * Implements the Repository pattern for SQLite with future DynamoDB migration path.
 */
export declare abstract class BaseRepository<
  T extends {
    id: string;
    createdAt: Date;
    updatedAt: Date;
  },
> {
  protected db: Database.Database;
  protected tableName: string;
  protected schema: z.ZodSchema<T>;
  private statementCache;
  constructor(db: Database.Database, tableName: string, schema: z.ZodSchema<T>);
  /**
   * Get or create cached prepared statement
   */
  protected getStatement(query: string): Database.Statement;
  /**
   * Find entity by ID.
   */
  findById(id: string): Promise<T | null>;
  /**
   * Find all entities with optional filtering.
   */
  findAll(options?: QueryOptions): Promise<T[]>;
  /**
   * Create new entity.
   */
  create(entityData: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  /**
   * Update existing entity.
   */
  update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>;
  /**
   * Delete entity by ID.
   */
  delete(id: string): Promise<boolean>;
  /**
   * Map database row to entity object.
   * Override in subclasses for custom mapping (e.g., JSON parsing, date conversion).
   */
  protected mapRowToEntity(row: Record<string, unknown>): T;
  /**
   * Map entity object to database row.
   * Override in subclasses for custom mapping (e.g., JSON stringification).
   */
  protected mapEntityToRow(entity: T): Record<string, unknown>;
  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase;
  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase;
  /**
   * Execute query within a transaction.
   * Useful for complex operations that need atomicity.
   */
  protected transaction<R>(fn: (db: Database.Database) => R): R;
}
//# sourceMappingURL=base-repository.d.ts.map
