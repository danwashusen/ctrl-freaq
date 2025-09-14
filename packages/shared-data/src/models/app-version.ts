import { z } from 'zod';
import Database from 'better-sqlite3';
import { BaseRepository, Repository } from '../repositories/index.js';

/**
 * AppVersion entity schema
 */
export const AppVersionSchema = z.object({
  id: z.string().uuid('Invalid app version ID format'),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?$/, 'Invalid semantic version format'),
  schemaVersion: z.string().min(1, 'Schema version is required'),
  migratedAt: z.date(),
  notes: z.string().max(1000, 'Notes too long').optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type AppVersion = z.infer<typeof AppVersionSchema>;

/**
 * Input schema for creating an app version
 */
export const CreateAppVersionSchema = AppVersionSchema.omit({
  id: true,
  migratedAt: true,
  createdAt: true,
  updatedAt: true
});

export type CreateAppVersionInput = z.infer<typeof CreateAppVersionSchema>;

/**
 * Input schema for updating an app version
 */
export const UpdateAppVersionSchema = AppVersionSchema.partial().omit({
  id: true,
  version: true, // Version cannot be changed
  migratedAt: true, // Migration date cannot be changed
  createdAt: true,
  updatedAt: true
});

export type UpdateAppVersionInput = z.infer<typeof UpdateAppVersionSchema>;

/**
 * App version repository interface
 */
export interface AppVersionRepository extends Repository<AppVersion> {
  findByVersion(version: string): Promise<AppVersion | null>;
  findLatest(): Promise<AppVersion | null>;
  findBySchemaVersion(schemaVersion: string): Promise<AppVersion[]>;
}

/**
 * App version repository implementation
 */
export class AppVersionRepositoryImpl extends BaseRepository<AppVersion> implements AppVersionRepository {
  constructor(db: Database.Database) {
    super(db, 'app_versions', AppVersionSchema);
  }

  /**
   * Find app version by version string
   */
  async findByVersion(version: string): Promise<AppVersion | null> {
    const stmt = this.db.prepare('SELECT * FROM app_versions WHERE version = ?');
    const row = stmt.get(version) as Record<string, any> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find the latest app version (by migration date)
   */
  async findLatest(): Promise<AppVersion | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM app_versions
      ORDER BY migrated_at DESC
      LIMIT 1
    `);
    const row = stmt.get() as Record<string, any> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find all app versions with a specific schema version
   */
  async findBySchemaVersion(schemaVersion: string): Promise<AppVersion[]> {
    const stmt = this.db.prepare('SELECT * FROM app_versions WHERE schema_version = ? ORDER BY migrated_at ASC');
    const rows = stmt.all(schemaVersion) as Record<string, any>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Override create to enforce version uniqueness and set migration date
   */
  async create(versionData: CreateAppVersionInput): Promise<AppVersion> {
    // Check if version already exists
    const existing = await this.findByVersion(versionData.version);
    if (existing) {
      throw new Error(`App version '${versionData.version}' already exists`);
    }

    // Set migration date to now
    const dataWithMigration = {
      ...versionData,
      migratedAt: new Date()
    };

    return super.create(dataWithMigration as any);
  }

  /**
   * Override mapEntityToRow to handle migratedAt field
   */
  protected mapEntityToRow(entity: AppVersion): Record<string, any> {
    const row = super.mapEntityToRow(entity);
    // Convert migratedAt separately since it's not following the standard naming convention
    if (entity.migratedAt) {
      row.migrated_at = entity.migratedAt.toISOString();
    }
    return row;
  }

  /**
   * Override mapRowToEntity to handle migrated_at field
   */
  protected mapRowToEntity(row: Record<string, any>): AppVersion {
    // Convert migrated_at to migratedAt before standard mapping
    if (row.migrated_at) {
      row.migratedAt = new Date(row.migrated_at);
      delete row.migrated_at;
    }
    return super.mapRowToEntity(row);
  }
}

/**
 * Validation functions
 */
export const validateAppVersion = (data: unknown): AppVersion => {
  return AppVersionSchema.parse(data);
};

export const validateCreateAppVersion = (data: unknown): CreateAppVersionInput => {
  return CreateAppVersionSchema.parse(data);
};

export const validateUpdateAppVersion = (data: unknown): UpdateAppVersionInput => {
  return UpdateAppVersionSchema.parse(data);
};

/**
 * App version utility functions
 */
export const AppVersionUtils = {
  /**
   * Parse semantic version into components
   */
  parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9-]+))?$/);
    if (!match) {
      throw new Error(`Invalid semantic version: ${version}`);
    }

    const result = {
      major: parseInt(match[1]!, 10),
      minor: parseInt(match[2]!, 10),
      patch: parseInt(match[3]!, 10)
    } as { major: number; minor: number; patch: number; prerelease?: string };

    if (match[4]) {
      result.prerelease = match[4];
    }

    return result;
  },

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): number {
    const parsed1 = AppVersionUtils.parseVersion(v1);
    const parsed2 = AppVersionUtils.parseVersion(v2);

    // Compare major version
    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major;
    }

    // Compare minor version
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor;
    }

    // Compare patch version
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch - parsed2.patch;
    }

    // Compare prerelease (no prerelease > prerelease)
    if (parsed1.prerelease && !parsed2.prerelease) return -1;
    if (!parsed1.prerelease && parsed2.prerelease) return 1;
    if (parsed1.prerelease && parsed2.prerelease) {
      return parsed1.prerelease.localeCompare(parsed2.prerelease);
    }

    return 0; // Equal
  },

  /**
   * Check if version is valid semantic version
   */
  isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?$/.test(version);
  },

  /**
   * Get next patch version
   */
  getNextPatchVersion(currentVersion: string): string {
    const parsed = AppVersionUtils.parseVersion(currentVersion);
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  },

  /**
   * Get next minor version
   */
  getNextMinorVersion(currentVersion: string): string {
    const parsed = AppVersionUtils.parseVersion(currentVersion);
    return `${parsed.major}.${parsed.minor + 1}.0`;
  },

  /**
   * Get next major version
   */
  getNextMajorVersion(currentVersion: string): string {
    const parsed = AppVersionUtils.parseVersion(currentVersion);
    return `${parsed.major + 1}.0.0`;
  },

  /**
   * Format migration notes template
   */
  formatMigrationNotes(version: string, changes: string[]): string {
    const header = `Migration to version ${version}`;
    const separator = '='.repeat(header.length);
    const changesList = changes.map(change => `• ${change}`).join('\n');

    return `${header}\n${separator}\n\nChanges:\n${changesList}\n\nMigrated: ${new Date().toISOString()}`;
  }
};

/**
 * App version constants
 */
export const APP_VERSION_CONSTANTS = {
  MAX_VERSION_LENGTH: 50,
  MAX_SCHEMA_VERSION_LENGTH: 20,
  MAX_NOTES_LENGTH: 1000,
  SEMVER_PATTERN: /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?$/
} as const;