import Database from 'better-sqlite3';
import { z } from 'zod';
import { BaseRepository, Repository } from '../repositories/index.js';
/**
 * Configuration entity schema
 */
export const ConfigurationSchema = z.object({
  id: z.string().uuid('Invalid configuration ID format'),
  userId: z.string().min(1, 'User ID is required'),
  key: z.string().min(1, 'Configuration key is required').max(100, 'Configuration key too long'),
  value: z.string().max(10240, 'Configuration value too large (max 10KB)'), // JSON-stringified value
  createdAt: z.date(),
  updatedAt: z.date(),
});
/**
 * Input schema for creating a configuration
 */
export const CreateConfigurationSchema = ConfigurationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
/**
 * Input schema for updating a configuration
 */
export const UpdateConfigurationSchema = ConfigurationSchema.partial().omit({
  id: true,
  userId: true,
  key: true, // Key cannot be changed
  createdAt: true,
  updatedAt: true,
});
/**
 * Configuration repository implementation
 */
export class ConfigurationRepositoryImpl extends BaseRepository {
  constructor(db) {
    super(db, 'configurations', ConfigurationSchema);
  }
  /**
   * Find configuration by user ID and key
   */
  async findByUserAndKey(userId, key) {
    const stmt = this.db.prepare('SELECT * FROM configurations WHERE user_id = ? AND key = ?');
    const row = stmt.get(userId, key);
    if (!row) return null;
    return this.mapRowToEntity(row);
  }
  /**
   * Find all configurations for a user
   */
  async findByUserId(userId) {
    const stmt = this.db.prepare('SELECT * FROM configurations WHERE user_id = ? ORDER BY key ASC');
    const rows = stmt.all(userId);
    return rows.map(row => this.mapRowToEntity(row));
  }
  /**
   * Insert or update configuration (upsert)
   */
  async upsert(userId, key, value) {
    const existing = await this.findByUserAndKey(userId, key);
    if (existing) {
      return this.update(existing.id, { value });
    } else {
      return this.create({ userId, key, value });
    }
  }
  /**
   * Override create to enforce user+key uniqueness
   */
  async create(configData) {
    // Check if user+key combination already exists
    const existing = await this.findByUserAndKey(configData.userId, configData.key);
    if (existing) {
      throw new Error(`Configuration with key '${configData.key}' already exists for user`);
    }
    // Validate key is allowed
    if (!VALID_CONFIG_KEYS.includes(configData.key)) {
      throw new Error(
        `Invalid configuration key: ${configData.key}. Allowed keys: ${VALID_CONFIG_KEYS.join(', ')}`
      );
    }
    return super.create(configData);
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
];
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
};
/**
 * Validation functions
 */
export const validateConfiguration = data => {
  return ConfigurationSchema.parse(data);
};
export const validateCreateConfiguration = data => {
  return CreateConfigurationSchema.parse(data);
};
export const validateUpdateConfiguration = data => {
  return UpdateConfigurationSchema.parse(data);
};
/**
 * Configuration utility functions
 */
export const ConfigurationUtils = {
  /**
   * Parse JSON configuration value safely
   */
  parseValue(config) {
    try {
      return JSON.parse(config.value);
    } catch {
      return null;
    }
  },
  /**
   * Stringify configuration value
   */
  stringifyValue(value) {
    return JSON.stringify(value);
  },
  /**
   * Validate configuration value against schema
   */
  validateValue(key, value) {
    const schema = ConfigValueSchemas[key];
    const result = schema.safeParse(value);
    return result.success;
  },
  /**
   * Get default configuration values
   */
  getDefaults() {
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
  isValidKey(key) {
    return VALID_CONFIG_KEYS.includes(key);
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
};
//# sourceMappingURL=configuration.js.map
