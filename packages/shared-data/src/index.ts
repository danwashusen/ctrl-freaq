/**
 * @ctrl-freaq/shared-data
 *
 * Shared data models, repositories, and types for CTRL FreaQ
 *
 * Provides:
 * - Entity models with validation
 * - Repository pattern implementations
 * - Database abstraction layer
 * - Type definitions
 */

// Export types
export type {
  AuditableEntity,
  BaseEntity,
  DatabaseConnection,
  QueryOptions,
  Repository,
} from './types/index';

// Export models
export * from './models/index.js';

// Export repositories
export * from './repositories/index.js';

// Export utilities
export * from './utils/index.js';

// Export migrations loader
export * from './migrations/index.js';
export { runSharedDataMigrations } from './migrations/run-migrations.js';

// Package metadata
export const PACKAGE_INFO = {
  name: '@ctrl-freaq/shared-data',
  version: '0.1.0',
  description: 'Shared data models and repositories for CTRL FreaQ',
} as const;
