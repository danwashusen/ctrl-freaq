import { randomUUID } from 'crypto';
/**
 * Base repository class providing common CRUD operations.
 * Implements the Repository pattern for SQLite with future DynamoDB migration path.
 */
export class BaseRepository {
    db;
    tableName;
    schema;
    statementCache = new Map();
    constructor(db, tableName, schema) {
        this.db = db;
        this.tableName = tableName;
        this.schema = schema;
    }
    /**
     * Get or create cached prepared statement
     */
    getStatement(query) {
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
    async findById(id) {
        const stmt = this.getStatement(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return null;
        return this.mapRowToEntity(row);
    }
    /**
     * Find all entities with optional filtering.
     */
    async findAll(options = {}) {
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
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
        const rows = stmt.all(...params);
        return rows.map(row => this.mapRowToEntity(row));
    }
    /**
     * Create new entity.
     */
    async create(entityData) {
        const id = randomUUID();
        const now = new Date();
        const entity = {
            ...entityData,
            id,
            createdAt: now,
            updatedAt: now
        };
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
    async update(id, updates) {
        const existing = await this.findById(id);
        if (!existing) {
            throw new Error(`Entity not found with id: ${id}`);
        }
        const updatedEntity = {
            ...existing,
            ...updates,
            updatedAt: new Date()
        };
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
    async delete(id) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Map database row to entity object.
     * Override in subclasses for custom mapping (e.g., JSON parsing, date conversion).
     */
    mapRowToEntity(row) {
        // Convert snake_case database columns to camelCase
        const mapped = Object.entries(row).reduce((acc, [key, value]) => {
            const camelKey = this.toCamelCase(key);
            // Parse dates
            if (camelKey.endsWith('At') && typeof value === 'string') {
                acc[camelKey] = new Date(value);
            }
            else {
                acc[camelKey] = value;
            }
            return acc;
        }, {});
        return this.schema.parse(mapped);
    }
    /**
     * Map entity object to database row.
     * Override in subclasses for custom mapping (e.g., JSON stringification).
     */
    mapEntityToRow(entity) {
        // Convert camelCase properties to snake_case database columns
        return Object.entries(entity).reduce((acc, [key, value]) => {
            const snakeKey = this.toSnakeCase(key);
            // Convert dates to ISO strings
            if (value instanceof Date) {
                acc[snakeKey] = value.toISOString();
            }
            else {
                acc[snakeKey] = value;
            }
            return acc;
        }, {});
    }
    /**
     * Convert snake_case to camelCase
     */
    toCamelCase(str) {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    /**
     * Convert camelCase to snake_case
     */
    toSnakeCase(str) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    /**
     * Execute query within a transaction.
     * Useful for complex operations that need atomicity.
     */
    transaction(fn) {
        const txnFn = this.db.transaction(fn);
        return txnFn(this.db);
    }
}
// Note: QueryOptions and Repository interfaces are now defined in types/index.ts
//# sourceMappingURL=base-repository.js.map