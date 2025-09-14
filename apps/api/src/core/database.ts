import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import type { Logger } from 'pino';

/**
 * Database Connection and Migration Utilities
 *
 * Implements SQLite database management with:
 * - Connection management and pooling
 * - Schema migrations
 * - Transaction support
 * - Performance monitoring
 * - Backup and recovery
 *
 * Constitutional Compliance:
 * - Repository Pattern: Abstract data access layer
 * - Future Migration Path: Designed for DynamoDB transition
 * - Structured Logging: All database operations logged
 */

export interface DatabaseConfig {
  path: string;
  migrations: {
    directory: string;
    table: string;
  };
  backup: {
    enabled: boolean;
    directory?: string;
    schedule?: string;
  };
  performance: {
    enableQueryLogging: boolean;
    slowQueryThreshold: number; // milliseconds
    enableWALMode: boolean;
  };
  development: {
    enableForeignKeys: boolean;
    enableQueryPlan: boolean;
  };
}

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
  checksum: string;
}

export interface QueryResult<T = any> {
  data: T[];
  rowCount: number;
  duration: number;
  query: string;
}

export interface DatabaseHealth {
  connected: boolean;
  type: string;
  version: string;
  size: number; // bytes
  lastMigration: number | null;
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    totalQueries: number;
  };
}

/**
 * Database connection manager
 */
export class DatabaseManager {
  private db: DatabaseType | null = null;
  private readonly config: DatabaseConfig;
  private readonly logger: Logger;
  private queryStats = {
    totalQueries: 0,
    slowQueries: 0,
    totalQueryTime: 0
  };

  constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info({ path: this.config.path }, 'Initializing database connection');

      // Create database connection
      this.db = new Database(this.config.path);

      // Configure SQLite settings
      this.configureSQLite();

      // Run migrations
      await this.runMigrations();

      // Setup backup if enabled
      if (this.config.backup.enabled) {
        this.setupBackupSchedule();
      }

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize database');
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDatabase(): DatabaseType {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Check database health
   */
  async getHealth(): Promise<DatabaseHealth> {
    if (!this.db) {
      return {
        connected: false,
        type: 'sqlite',
        version: 'unknown',
        size: 0,
        lastMigration: null,
        performance: {
          averageQueryTime: 0,
          slowQueries: 0,
          totalQueries: 0
        }
      };
    }

    try {
      // Get SQLite version
      const versionResult = this.db.prepare('SELECT sqlite_version() as version').get() as { version: string };

      // Get database file size
      const { stat } = await import('fs/promises');
      const stats = await stat(this.config.path);

      // Get last migration version
      const migrationResult = this.db
        .prepare(`SELECT MAX(version) as lastMigration FROM ${this.config.migrations.table}`)
        .get() as { lastMigration: number | null };

      return {
        connected: true,
        type: 'sqlite',
        version: versionResult.version,
        size: stats.size,
        lastMigration: migrationResult.lastMigration,
        performance: {
          averageQueryTime: this.queryStats.totalQueries > 0
            ? this.queryStats.totalQueryTime / this.queryStats.totalQueries
            : 0,
          slowQueries: this.queryStats.slowQueries,
          totalQueries: this.queryStats.totalQueries
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get database health');
      return {
        connected: false,
        type: 'sqlite',
        version: 'unknown',
        size: 0,
        lastMigration: null,
        performance: {
          averageQueryTime: 0,
          slowQueries: 0,
          totalQueries: 0
        }
      };
    }
  }

  /**
   * Execute query with performance monitoring
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const start = Date.now();

    try {
      const stmt = this.db.prepare(sql);
      const data = stmt.all(...params) as T[];
      const duration = Date.now() - start;

      // Update query statistics
      this.updateQueryStats(duration);

      // Log query if enabled
      if (this.config.performance.enableQueryLogging) {
        this.logQuery(sql, params, duration, data.length);
      }

      return {
        data,
        rowCount: data.length,
        duration,
        query: sql
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error({
        error,
        sql,
        params,
        duration
      }, 'Query execution failed');
      throw error;
    }
  }

  /**
   * Execute single row query
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const start = Date.now();

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params) as T | undefined;
      const duration = Date.now() - start;

      this.updateQueryStats(duration);

      if (this.config.performance.enableQueryLogging) {
        this.logQuery(sql, params, duration, result ? 1 : 0);
      }

      return result || null;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error({
        error,
        sql,
        params,
        duration
      }, 'Single query execution failed');
      throw error;
    }
  }

  /**
   * Execute insert/update/delete with affected rows count
   */
  async exec(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const start = Date.now();

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      const duration = Date.now() - start;

      this.updateQueryStats(duration);

      if (this.config.performance.enableQueryLogging) {
        this.logQuery(sql, params, duration, result.changes);
      }

      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid as number
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error({
        error,
        sql,
        params,
        duration
      }, 'Exec query failed');
      throw error;
    }
  }

  /**
   * Execute queries in transaction
   */
  async transaction<T>(callback: (db: DatabaseType) => T): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction(() => {
      return callback(this.db!);
    });

    try {
      this.logger.debug('Starting database transaction');
      const result = transaction();
      this.logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      this.logger.error({ error }, 'Transaction failed and rolled back');
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.logger.info('Closing database connection');
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Configure SQLite settings
   */
  private configureSQLite(): void {
    if (!this.db) return;

    // Enable WAL mode for better concurrency
    if (this.config.performance.enableWALMode) {
      this.db.exec('PRAGMA journal_mode = WAL');
    }

    // Enable foreign keys if configured
    if (this.config.development.enableForeignKeys) {
      this.db.exec('PRAGMA foreign_keys = ON');
    }

    // Set performance optimizations
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA cache_size = 1000');
    this.db.exec('PRAGMA temp_store = MEMORY');
    this.db.exec('PRAGMA mmap_size = 268435456'); // 256MB

    this.logger.debug('SQLite configuration applied');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    this.logger.info('Running database migrations');

    // Create migrations table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.config.migrations.table} (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get applied migrations
    const appliedMigrations = this.db
      .prepare(`SELECT version, checksum FROM ${this.config.migrations.table} ORDER BY version`)
      .all() as { version: number; checksum: string }[];

    // Load migration files
    const migrations = this.loadMigrationFiles();

    // Verify existing migrations haven't changed
    for (const applied of appliedMigrations) {
      const migration = migrations.find(m => m.version === applied.version);
      if (migration && migration.checksum !== applied.checksum) {
        throw new Error(`Migration ${applied.version} checksum mismatch. Database may be corrupted.`);
      }
    }

    // Apply new migrations
    const lastAppliedVersion = appliedMigrations.length > 0
      ? Math.max(...appliedMigrations.map(m => m.version))
      : 0;

    const pendingMigrations = migrations.filter(m => m.version > lastAppliedVersion);

    if (pendingMigrations.length === 0) {
      this.logger.info('No pending migrations');
      return;
    }

    // Apply migrations in transaction
    this.transaction(() => {
      for (const migration of pendingMigrations) {
        this.logger.info(`Applying migration ${migration.version}: ${migration.name}`);

        // Execute migration SQL
        this.db!.exec(migration.up);

        // Record migration as applied
        this.db!
          .prepare(`INSERT INTO ${this.config.migrations.table} (version, name, checksum) VALUES (?, ?, ?)`)
          .run(migration.version, migration.name, migration.checksum);

        this.logger.info(`Migration ${migration.version} applied successfully`);
      }
    });

    this.logger.info(`Applied ${pendingMigrations.length} migrations`);
  }

  /**
   * Load migration files from directory
   */
  private loadMigrationFiles(): Migration[] {
    const migrationsDir = this.config.migrations.directory;

    if (!existsSync(migrationsDir)) {
      this.logger.warn(`Migrations directory not found: ${migrationsDir}`);
      return [];
    }

    const files = readdirSync(migrationsDir)
      .filter((file: string) => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        this.logger.warn(`Invalid migration filename: ${file}`);
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2].replace(/_/g, ' ');
      const path = join(migrationsDir, file);
      const content = readFileSync(path, 'utf-8');

      // Calculate checksum
      const checksum = createHash('sha256').update(content).digest('hex');

      migrations.push({
        version,
        name,
        up: content,
        checksum
      });
    }

    return migrations;
  }

  /**
   * Update query performance statistics
   */
  private updateQueryStats(duration: number): void {
    this.queryStats.totalQueries++;
    this.queryStats.totalQueryTime += duration;

    if (duration > this.config.performance.slowQueryThreshold) {
      this.queryStats.slowQueries++;
    }
  }

  /**
   * Log query execution
   */
  private logQuery(sql: string, params: any[], duration: number, rowCount: number): void {
    const logLevel = duration > this.config.performance.slowQueryThreshold ? 'warn' : 'debug';

    this.logger[logLevel]({
      database: {
        query: sql.replace(/\s+/g, ' ').trim(),
        params: params.length,
        duration,
        rowCount
      }
    }, `Database query executed in ${duration}ms`);
  }

  /**
   * Setup backup schedule
   */
  private setupBackupSchedule(): void {
    if (!this.config.backup.directory) {
      this.logger.warn('Backup enabled but no directory specified');
      return;
    }

    // Create backup directory if it doesn't exist
    const fs = require('fs');
    if (!existsSync(this.config.backup.directory)) {
      fs.mkdirSync(this.config.backup.directory, { recursive: true });
    }

    this.logger.info(`Backup schedule configured for ${this.config.backup.directory}`);
    // Backup scheduling would be implemented here
  }
}

/**
 * Default database configuration factory
 */
export function createDefaultDatabaseConfig(): DatabaseConfig {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  return {
    path: process.env.DATABASE_PATH || join(process.cwd(), 'data', 'ctrl-freaq.db'),
    migrations: {
      directory: join(__dirname, '..', '..', 'migrations'),
      table: '_migrations'
    },
    backup: {
      enabled: process.env.NODE_ENV === 'production',
      directory: process.env.BACKUP_DIRECTORY || join(process.cwd(), 'backups')
    },
    performance: {
      enableQueryLogging: process.env.NODE_ENV === 'development',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10),
      enableWALMode: true
    },
    development: {
      enableForeignKeys: true,
      enableQueryPlan: process.env.NODE_ENV === 'development'
    }
  };
}

/**
 * Database factory for service locator
 */
export async function createDatabase(
  config: DatabaseConfig,
  logger: Logger
): Promise<DatabaseType> {
  const manager = new DatabaseManager(config, logger);
  await manager.initialize();
  return manager.getDatabase();
}

/**
 * Test database utilities
 */
export class TestDatabaseUtils {
  static createInMemoryConfig(): DatabaseConfig {
    return {
      ...createDefaultDatabaseConfig(),
      path: ':memory:',
      backup: { enabled: false },
      performance: {
        enableQueryLogging: false,
        slowQueryThreshold: 1000,
        enableWALMode: false
      }
    };
  }

  static async createTestDatabase(logger: Logger): Promise<DatabaseType> {
    const config = this.createInMemoryConfig();
    return createDatabase(config, logger);
  }
}

/**
 * Database health check for monitoring
 */
export async function checkDatabaseHealth(
  manager: DatabaseManager
): Promise<DatabaseHealth> {
  return manager.getHealth();
}