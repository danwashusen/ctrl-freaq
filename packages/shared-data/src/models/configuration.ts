import Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from '../repositories/index.js';
import type { Repository } from '../repositories/index.js';

/**
 * Configuration entity schema
 */
export const ConfigurationSchema = z.object({
  id: z.string().uuid('Invalid configuration ID format'),
  userId: z.string().min(1, 'User ID is required'),
  key: z.string().min(1, 'Configuration key is required').max(100, 'Configuration key too long'),
  value: z.string().max(10240, 'Configuration value too large (max 10KB)'), // JSON-stringified value
  createdAt: z.date(),
  createdBy: z.string().min(1, 'Created by is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'Updated by is required'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

/**
 * Input schema for creating a configuration
 */
export const CreateConfigurationSchema = ConfigurationSchema.omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
}).extend({
  createdBy: z.string().min(1, 'Created by is required'),
  updatedBy: z.string().min(1, 'Updated by is required'),
});

export type CreateConfigurationInput = z.infer<typeof CreateConfigurationSchema>;

/**
 * Input schema for updating a configuration
 */
export const UpdateConfigurationSchema = ConfigurationSchema.partial().omit({
  id: true,
  userId: true,
  key: true, // Key cannot be changed
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  deletedAt: true,
  deletedBy: true,
});

export type UpdateConfigurationInput = z.infer<typeof UpdateConfigurationSchema>;

/**
 * Configuration repository interface
 */
export interface ConfigurationRepository extends Repository<Configuration> {
  findByUserAndKey(userId: string, key: string): Promise<Configuration | null>;
  upsert(userId: string, key: string, value: string): Promise<Configuration>;
  findByUserId(userId: string): Promise<Configuration[]>;
}

/**
 * Configuration repository implementation
 */
export class ConfigurationRepositoryImpl
  extends BaseRepository<Configuration>
  implements ConfigurationRepository
{
  constructor(db: Database.Database) {
    super(db, 'configurations', ConfigurationSchema);
  }

  /**
   * Find configuration by user ID and key
   */
  async findByUserAndKey(userId: string, key: string): Promise<Configuration | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM configurations
        WHERE user_id = ? AND key = ?
          AND (deleted_at IS NULL OR deleted_at = '')`
    );
    const row = stmt.get(userId, key) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToEntity(row);
  }

  /**
   * Find all configurations for a user
   */
  async findByUserId(userId: string): Promise<Configuration[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM configurations
        WHERE user_id = ? AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY key ASC`
    );
    const rows = stmt.all(userId) as Record<string, unknown>[];

    return rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Insert or update configuration (upsert)
   */
  async upsert(userId: string, key: string, value: string): Promise<Configuration> {
    this.ensureValidKeyValue(key, value);
    const existing = await this.findByUserAndKey(userId, key);

    if (existing) {
      return this.update(existing.id, { value, updatedBy: userId });
    } else {
      return this.create({ userId, key, value, createdBy: userId, updatedBy: userId });
    }
  }

  /**
   * Override create to enforce user+key uniqueness
   */
  override async create(configData: CreateConfigurationInput): Promise<Configuration> {
    // Check if user+key combination already exists
    const existing = await this.findByUserAndKey(configData.userId, configData.key);
    if (existing) {
      throw new Error(`Configuration with key '${configData.key}' already exists for user`);
    }
    this.ensureValidKeyValue(configData.key, configData.value);
    return super.create(configData);
  }

  private ensureValidKeyValue(key: string, rawValue: string): void {
    if (!ConfigurationUtils.isValidKey(key)) {
      throw new Error(`Invalid configuration key: ${key}`);
    }
    const parsed = ConfigurationUtils.deserializeRawValue(rawValue);
    if (!ConfigurationUtils.validateValue(key as ConfigKey, parsed)) {
      throw new Error(`Invalid value for configuration key: ${key}`);
    }
  }
}

/**
 * Valid configuration keys
 */
export const VALID_CONFIG_KEYS = [
  'theme',
  'logLevel',
  'editorPreferences',
  'apiKeys',
  'notifications',
  'language',
] as const;

export type ConfigKey = (typeof VALID_CONFIG_KEYS)[number];

/**
 * Configuration value schemas for validation
 */
export const ConfigValueSchemas = {
  theme: z.enum(['light', 'dark', 'system']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  editorPreferences: z.object({
    fontSize: z.number().min(8).max(72).optional(),
    lineNumbers: z.boolean().optional(),
    wordWrap: z.boolean().optional(),
    tabSize: z.number().min(1).max(8).optional(),
    theme: z.string().optional(),
  }),
  apiKeys: z.record(z.string()), // Encrypted API keys
  notifications: z.object({
    email: z.boolean().optional(),
    desktop: z.boolean().optional(),
    frequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).optional(),
  }),
  language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh']),
} satisfies Record<ConfigKey, z.ZodSchema>;

// Safe accessor map to avoid dynamic object injection patterns
const ConfigValueSchemaMap: Map<ConfigKey, z.ZodSchema> = new Map(
  Object.entries(ConfigValueSchemas) as [ConfigKey, z.ZodSchema][]
);

/**
 * Validation functions
 */
export const validateConfiguration = (data: unknown): Configuration => {
  return ConfigurationSchema.parse(data);
};

export const validateCreateConfiguration = (data: unknown): CreateConfigurationInput => {
  return CreateConfigurationSchema.parse(data);
};

export const validateUpdateConfiguration = (data: unknown): UpdateConfigurationInput => {
  return UpdateConfigurationSchema.parse(data);
};

/**
 * Configuration utility functions
 */
export const ConfigurationUtils = {
  /**
   * Parse JSON configuration value safely
   */
  parseValue<T = unknown>(config: Configuration): T | null {
    try {
      return JSON.parse(config.value) as T;
    } catch {
      return config.value as unknown as T;
    }
  },

  /**
   * Stringify configuration value
   */
  stringifyValue(value: unknown): string {
    return JSON.stringify(value);
  },

  deserializeRawValue(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },

  /**
   * Validate configuration value against schema
   */
  validateValue(key: ConfigKey, value: unknown): boolean {
    const schema = ConfigValueSchemaMap.get(key);
    if (!schema) return false;
    const result = schema.safeParse(value);
    return result.success;
  },

  /**
   * Get default configuration values
   */
  getDefaults(): Record<ConfigKey, unknown> {
    return {
      theme: 'system',
      logLevel: 'info',
      editorPreferences: {
        fontSize: 14,
        lineNumbers: true,
        wordWrap: true,
        tabSize: 2,
        theme: 'default',
      },
      apiKeys: {},
      notifications: {
        email: true,
        desktop: true,
        frequency: 'daily',
      },
      language: 'en',
    };
  },

  /**
   * Check if configuration key is valid
   */
  isValidKey(key: string): key is ConfigKey {
    return VALID_CONFIG_KEYS.includes(key as ConfigKey);
  },
};

/**
 * Configuration constants
 */
export const CONFIG_CONSTANTS = {
  MAX_KEY_LENGTH: 100,
  MAX_VALUE_SIZE: 10240, // 10KB in bytes
  MIN_KEY_LENGTH: 1,
  VALID_KEYS: VALID_CONFIG_KEYS,
} as const;
