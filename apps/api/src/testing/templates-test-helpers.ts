import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { Template } from '@ctrl-freaq/templates';

import { TEMPLATE_MANAGER_JWT_TOKEN, TEMPLATE_MANAGER_USER_ID } from '../middleware/test-auth.js';

/**
 * Fixture identifiers shared between API contract tests and template resolver tests.
 */
export type TemplateFixtureName =
  | 'architecture.valid'
  | 'architecture.missingFields'
  | 'architecture.invalidVersion';

export const TEMPLATE_FIXTURES = new Map<TemplateFixtureName, string>([
  ['architecture.valid', 'architecture.valid.yaml'],
  ['architecture.missingFields', 'architecture.missing-fields.yaml'],
  ['architecture.invalidVersion', 'architecture.invalid-version.yaml'],
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'templates',
  'tests',
  'fixtures'
);

/**
 * Resolve an absolute path to a YAML template fixture.
 */
export function resolveTemplateFixture(name: TemplateFixtureName): string {
  const fileName = TEMPLATE_FIXTURES.get(name);
  if (!fileName) {
    throw new Error(`Unknown template fixture: ${name}`);
  }
  return join(FIXTURE_ROOT, fileName);
}

/**
 * Read the raw YAML content for a template fixture.
 */
export function readTemplateFixture(name: TemplateFixtureName): string {
  return readFileSync(resolveTemplateFixture(name), 'utf-8');
}

/**
 * Load and compile a template fixture using the shared template engine.
 * Useful for resolver tests that need concrete schema metadata.
 */
export async function loadTemplateFixture(name: TemplateFixtureName): Promise<Template> {
  const { TemplateEngine } = await import('@ctrl-freaq/templates');
  const engine = new TemplateEngine();
  const content = readTemplateFixture(name);
  const templateKey = name.split('.')[0];
  return engine.loadTemplate(content, templateKey);
}

/**
 * Deterministic Clerk identity representing a template manager.
 */
export const TEMPLATE_MANAGER_IDENTITY = {
  token: TEMPLATE_MANAGER_JWT_TOKEN,
  userId: TEMPLATE_MANAGER_USER_ID,
  role: 'template_manager',
  permissions: ['templates:manage'] as const,
};

/**
 * Authorization header value for template manager requests.
 */
export function getManagerAuthHeader(): string {
  return `Bearer ${TEMPLATE_MANAGER_IDENTITY.token}`;
}

/**
 * Apply manager authorization to a Supertest request chain.
 */
export function withManagerAuth<T extends import('supertest').Test>(request: T): T {
  return request.set('Authorization', getManagerAuthHeader());
}
