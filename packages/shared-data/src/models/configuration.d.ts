import Database from 'better-sqlite3';
import { z } from 'zod';
import { BaseRepository, Repository } from '../repositories/index.js';
/**
 * Configuration entity schema
 */
export declare const ConfigurationSchema: z.ZodObject<
  {
    id: z.ZodString;
    userId: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
  },
  'strip',
  z.ZodTypeAny,
  {
    userId: string;
    key: string;
    value: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
  },
  {
    userId: string;
    key: string;
    value: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
  }
>;
export type Configuration = z.infer<typeof ConfigurationSchema>;
/**
 * Input schema for creating a configuration
 */
export declare const CreateConfigurationSchema: z.ZodObject<
  Omit<
    {
      id: z.ZodString;
      userId: z.ZodString;
      key: z.ZodString;
      value: z.ZodString;
      createdAt: z.ZodDate;
      updatedAt: z.ZodDate;
    },
    'id' | 'createdAt' | 'updatedAt'
  >,
  'strip',
  z.ZodTypeAny,
  {
    userId: string;
    key: string;
    value: string;
  },
  {
    userId: string;
    key: string;
    value: string;
  }
>;
export type CreateConfigurationInput = z.infer<typeof CreateConfigurationSchema>;
/**
 * Input schema for updating a configuration
 */
export declare const UpdateConfigurationSchema: z.ZodObject<
  Omit<
    {
      id: z.ZodOptional<z.ZodString>;
      userId: z.ZodOptional<z.ZodString>;
      key: z.ZodOptional<z.ZodString>;
      value: z.ZodOptional<z.ZodString>;
      createdAt: z.ZodOptional<z.ZodDate>;
      updatedAt: z.ZodOptional<z.ZodDate>;
    },
    'userId' | 'key' | 'id' | 'createdAt' | 'updatedAt'
  >,
  'strip',
  z.ZodTypeAny,
  {
    value?: string | undefined;
  },
  {
    value?: string | undefined;
  }
>;
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
export declare class ConfigurationRepositoryImpl
  extends BaseRepository<Configuration>
  implements ConfigurationRepository
{
  constructor(db: Database.Database);
  /**
   * Find configuration by user ID and key
   */
  findByUserAndKey(userId: string, key: string): Promise<Configuration | null>;
  /**
   * Find all configurations for a user
   */
  findByUserId(userId: string): Promise<Configuration[]>;
  /**
   * Insert or update configuration (upsert)
   */
  upsert(userId: string, key: string, value: string): Promise<Configuration>;
  /**
   * Override create to enforce user+key uniqueness
   */
  create(configData: CreateConfigurationInput): Promise<Configuration>;
}
/**
 * Valid configuration keys
 */
export declare const VALID_CONFIG_KEYS: readonly [
  'theme',
  'logLevel',
  'editorPreferences',
  'apiKeys',
  'notifications',
  'language',
];
export type ConfigKey = (typeof VALID_CONFIG_KEYS)[number];
/**
 * Configuration value schemas for validation
 */
export declare const ConfigValueSchemas: {
  theme: z.ZodEnum<['light', 'dark', 'system']>;
  logLevel: z.ZodEnum<['debug', 'info', 'warn', 'error']>;
  editorPreferences: z.ZodObject<
    {
      fontSize: z.ZodOptional<z.ZodNumber>;
      lineNumbers: z.ZodOptional<z.ZodBoolean>;
      wordWrap: z.ZodOptional<z.ZodBoolean>;
      tabSize: z.ZodOptional<z.ZodNumber>;
      theme: z.ZodOptional<z.ZodString>;
    },
    'strip',
    z.ZodTypeAny,
    {
      theme?: string | undefined;
      fontSize?: number | undefined;
      lineNumbers?: boolean | undefined;
      wordWrap?: boolean | undefined;
      tabSize?: number | undefined;
    },
    {
      theme?: string | undefined;
      fontSize?: number | undefined;
      lineNumbers?: boolean | undefined;
      wordWrap?: boolean | undefined;
      tabSize?: number | undefined;
    }
  >;
  apiKeys: z.ZodRecord<z.ZodString, z.ZodString>;
  notifications: z.ZodObject<
    {
      email: z.ZodOptional<z.ZodBoolean>;
      desktop: z.ZodOptional<z.ZodBoolean>;
      frequency: z.ZodOptional<z.ZodEnum<['immediate', 'hourly', 'daily', 'weekly']>>;
    },
    'strip',
    z.ZodTypeAny,
    {
      email?: boolean | undefined;
      desktop?: boolean | undefined;
      frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly' | undefined;
    },
    {
      email?: boolean | undefined;
      desktop?: boolean | undefined;
      frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly' | undefined;
    }
  >;
  language: z.ZodEnum<['en', 'es', 'fr', 'de', 'ja', 'zh']>;
};
/**
 * Validation functions
 */
export declare const validateConfiguration: (data: unknown) => Configuration;
export declare const validateCreateConfiguration: (data: unknown) => CreateConfigurationInput;
export declare const validateUpdateConfiguration: (data: unknown) => UpdateConfigurationInput;
/**
 * Configuration utility functions
 */
export declare const ConfigurationUtils: {
  /**
   * Parse JSON configuration value safely
   */
  parseValue<T = unknown>(config: Configuration): T | null;
  /**
   * Stringify configuration value
   */
  stringifyValue(value: unknown): string;
  /**
   * Validate configuration value against schema
   */
  validateValue(key: ConfigKey, value: unknown): boolean;
  /**
   * Get default configuration values
   */
  getDefaults(): Record<ConfigKey, unknown>;
  /**
   * Check if configuration key is valid
   */
  isValidKey(key: string): key is ConfigKey;
};
/**
 * Configuration constants
 */
export declare const CONFIG_CONSTANTS: {
  readonly MAX_KEY_LENGTH: 100;
  readonly MAX_VALUE_SIZE: 10240;
  readonly MIN_KEY_LENGTH: 1;
  readonly VALID_KEYS: readonly [
    'theme',
    'logLevel',
    'editorPreferences',
    'apiKeys',
    'notifications',
    'language',
  ];
};
//# sourceMappingURL=configuration.d.ts.map
