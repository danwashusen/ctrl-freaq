import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';
import { z } from 'zod';

import type { QueryOptions } from '../types/index.js';

/**
 * Base repository class providing common CRUD operations.
 * Implements the Repository pattern for SQLite with future DynamoDB migration path.
 */
export abstract class BaseRepository<T extends { id: string; createdAt: Date; updatedAt: Date }> {
  protected db: Database.Database;
  protected tableName: string;
  protected schema: z.ZodSchema<T>;
  private statementCache = new Map<string, Database.Statement>();

  constructor(db: Database.Database, tableName: string, schema: z.ZodSchema<T>) {
    this.db = db;
    this.tableName = tableName;
    this.schema = schema;
  }

  /**
   * Get or create cached prepared statement
   */
  protected getStatement(query: string): Database.Statement {
    let statement = this.statementCache.get(query);
    if (!statement) {
      statement = this.db.prepare(query);
      this.statementCache.set(query, statement);
    }
    return statement;
  }

  /**
   * Find entity by ID.
   */
  async findById(id: string): Promise<T | null> {
    const stmt = this.getStatement(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find all entities with optional filtering.
   */
  async findAll(options: QueryOptions = {}): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options.where) {
      const whereClause = Object.keys(options.where)
        .map(key => `${key} = ?`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(options.where));
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }

    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const stmt = this.getStatement(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create new entity.
   */
  async create(entityData: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const id = randomUUID();
    const now = new Date();

    const entity = {
      ...entityData,
      id,
      createdAt: now,
      updatedAt: now,
    } as T;

    // Validate entity
    const validated = this.schema.parse(entity);

    // Convert to database row
    const row = this.mapEntityToRow(validated);

    // Build insert query
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    const stmt = this.db.prepare(query);
    stmt.run(...Object.values(row));

    return validated;
  }

  /**
   * Update existing entity.
   */
  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Entity not found with id: ${id}`);
    }

    const updatedEntity = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    } as T;

    // Validate updated entity
    const validated = this.schema.parse(updatedEntity);

    // Convert to database row
    const row = this.mapEntityToRow(validated);

    // Build update query (exclude id from SET clause)
    const setClause = Object.keys(row)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');

    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    const values = Object.entries(row)
      .filter(([key]) => key !== 'id')
      .map(([, value]) => value);
    values.push(id);

    const stmt = this.db.prepare(query);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      throw new Error(`Failed to update entity with id: ${id}`);
    }

    return validated;
  }

  /**
   * Delete entity by ID.
   */
  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Map database row to entity object.
   * Override in subclasses for custom mapping (e.g., JSON parsing, date conversion).
   */
  protected mapRowToEntity(row: Record<string, unknown>): T {
    // Convert snake_case database columns to camelCase using entries transformation
    const mapped = Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const camelKey = this.toCamelCase(key);
        const v = camelKey.endsWith('At') && typeof value === 'string' ? new Date(value) : value;
        return [camelKey, v] as const;
      })
    ) as Record<string, unknown>;

    return this.schema.parse(mapped);
  }

  /**
   * Map entity object to database row.
   * Override in subclasses for custom mapping (e.g., JSON stringification).
   */
  protected mapEntityToRow(entity: T): Record<string, unknown> {
    // Convert camelCase properties to snake_case database columns
    return Object.fromEntries(
      Object.entries(entity as Record<string, unknown>).map(([key, value]) => {
        const snakeKey = this.toSnakeCase(key);
        const v = value instanceof Date ? value.toISOString() : value;
        return [snakeKey, v] as const;
      })
    ) as Record<string, unknown>;
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Execute query within a transaction.
   * Useful for complex operations that need atomicity.
   */
  protected transaction<R>(fn: (db: Database.Database) => R): R {
    const txnFn = this.db.transaction(fn);
    return txnFn(this.db);
  }
}

// Note: QueryOptions and Repository interfaces are now defined in types/index.ts
