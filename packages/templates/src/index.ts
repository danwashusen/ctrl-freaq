/**
 * @ctrl-freaq/templates
 *
 * YAML template engine for documentation generation
 *
 * Provides:
 * - YAML template parsing and validation
 * - Mustache template rendering
 * - Template composition and inheritance
 * - Variable substitution and transformation
 */

// Export main template engine
export * from './templates/index.js';

// Export parsers
export * from './parsers/index.js';

// Export validators
export * from './validators/index.js';

// Export utilities
export * from './utils/index.js';

// Package metadata
export const PACKAGE_INFO = {
  name: '@ctrl-freaq/templates',
  version: '0.1.0',
  description: 'YAML template engine for CTRL FreaQ documentation generation'
} as const;