import Database from 'better-sqlite3';
import { z } from 'zod';
import { BaseRepository, Repository } from '../repositories/index.js';
/**
 * AppVersion entity schema
 */
export declare const AppVersionSchema: z.ZodObject<
  {
    id: z.ZodString;
    version: z.ZodString;
    schemaVersion: z.ZodString;
    migratedAt: z.ZodDate;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  'strip',
  z.ZodTypeAny,
  {
    version: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    schemaVersion: string;
    migratedAt: Date;
    notes?: string | null | undefined;
  },
  {
    version: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    schemaVersion: string;
    migratedAt: Date;
    notes?: string | null | undefined;
  }
>;
export type AppVersion = z.infer<typeof AppVersionSchema>;
/**
 * Input schema for creating an app version
 */
export declare const CreateAppVersionSchema: z.ZodObject<
  Omit<
    {
      id: z.ZodString;
      version: z.ZodString;
      schemaVersion: z.ZodString;
      migratedAt: z.ZodDate;
      notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
      createdAt: z.ZodDate;
      updatedAt: z.ZodDate;
    },
    'id' | 'createdAt' | 'updatedAt' | 'migratedAt'
  >,
  'strip',
  z.ZodTypeAny,
  {
    version: string;
    schemaVersion: string;
    notes?: string | null | undefined;
  },
  {
    version: string;
    schemaVersion: string;
    notes?: string | null | undefined;
  }
>;
export type CreateAppVersionInput = z.infer<typeof CreateAppVersionSchema>;
/**
 * Input schema for updating an app version
 */
export declare const UpdateAppVersionSchema: z.ZodObject<
  Omit<
    {
      id: z.ZodOptional<z.ZodString>;
      version: z.ZodOptional<z.ZodString>;
      schemaVersion: z.ZodOptional<z.ZodString>;
      migratedAt: z.ZodOptional<z.ZodDate>;
      notes: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
      createdAt: z.ZodOptional<z.ZodDate>;
      updatedAt: z.ZodOptional<z.ZodDate>;
    },
    'version' | 'id' | 'createdAt' | 'updatedAt' | 'migratedAt'
  >,
  'strip',
  z.ZodTypeAny,
  {
    schemaVersion?: string | undefined;
    notes?: string | null | undefined;
  },
  {
    schemaVersion?: string | undefined;
    notes?: string | null | undefined;
  }
>;
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
export declare class AppVersionRepositoryImpl
  extends BaseRepository<AppVersion>
  implements AppVersionRepository
{
  constructor(db: Database.Database);
  /**
   * Find app version by version string
   */
  findByVersion(version: string): Promise<AppVersion | null>;
  /**
   * Find the latest app version (by migration date)
   */
  findLatest(): Promise<AppVersion | null>;
  /**
   * Find all app versions with a specific schema version
   */
  findBySchemaVersion(schemaVersion: string): Promise<AppVersion[]>;
  /**
   * Override create to enforce version uniqueness and set migration date
   */
  create(versionData: CreateAppVersionInput): Promise<AppVersion>;
  /**
   * Override mapEntityToRow to handle migratedAt field
   */
  protected mapEntityToRow(entity: AppVersion): Record<string, unknown>;
  /**
   * Override mapRowToEntity to handle migrated_at field
   */
  protected mapRowToEntity(row: Record<string, unknown>): AppVersion;
}
/**
 * Validation functions
 */
export declare const validateAppVersion: (data: unknown) => AppVersion;
export declare const validateCreateAppVersion: (data: unknown) => CreateAppVersionInput;
export declare const validateUpdateAppVersion: (data: unknown) => UpdateAppVersionInput;
/**
 * App version utility functions
 */
export declare const AppVersionUtils: {
  /**
   * Parse semantic version into components
   */
  parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
  };
  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersions(v1: string, v2: string): number;
  /**
   * Check if version is valid semantic version
   */
  isValidVersion(version: string): boolean;
  /**
   * Get next patch version
   */
  getNextPatchVersion(currentVersion: string): string;
  /**
   * Get next minor version
   */
  getNextMinorVersion(currentVersion: string): string;
  /**
   * Get next major version
   */
  getNextMajorVersion(currentVersion: string): string;
  /**
   * Format migration notes template
   */
  formatMigrationNotes(version: string, changes: string[]): string;
};
/**
 * App version constants
 */
export declare const APP_VERSION_CONSTANTS: {
  readonly MAX_VERSION_LENGTH: 50;
  readonly MAX_SCHEMA_VERSION_LENGTH: 20;
  readonly MAX_NOTES_LENGTH: 1000;
  readonly SEMVER_PATTERN: RegExp;
};
//# sourceMappingURL=app-version.d.ts.map
