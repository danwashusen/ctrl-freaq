import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import { compileTemplateFile } from '../compilers/template-compiler';
import { createTemplateValidator } from './template-validator';

const fixturesDir = resolve(__dirname, '../../tests/fixtures');

const validFixture = resolve(fixturesDir, 'architecture.valid.yaml');

describe('template validator generation', () => {
  it('validates required sections and nested fields', async () => {
    const compiled = await compileTemplateFile(validFixture);
    const validator = createTemplateValidator({
      templateId: compiled.catalog.id,
      version: compiled.version.version,
      schemaJson: compiled.version.schemaJson,
    });

    const result = validator.safeParse({
      introduction: 'High level summary',
      system_overview: {
        architecture_diagram: 'https://cdn.ctrl-freaq.dev/diagram.png',
        tech_stack: 'react',
      },
      decision_log: [
        {
          context: 'Need to choose a database vendor',
          decision: 'Use SQLite for MVP',
          status: 'approved',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects payloads missing required sections', async () => {
    const compiled = await compileTemplateFile(validFixture);
    const validator = createTemplateValidator({
      templateId: compiled.catalog.id,
      version: compiled.version.version,
      schemaJson: compiled.version.schemaJson,
    });

    const result = validator.safeParse({
      system_overview: {
        architecture_diagram: 'https://cdn.ctrl-freaq.dev/diagram.png',
        tech_stack: 'react',
      },
    });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.issues.map(issue => issue.path.join('.'))).toContain('introduction');
    }
  });

  it('rejects invalid enum values on nested fields', async () => {
    const compiled = await compileTemplateFile(validFixture);
    const validator = createTemplateValidator({
      templateId: compiled.catalog.id,
      version: compiled.version.version,
      schemaJson: compiled.version.schemaJson,
    });

    const result = validator.safeParse({
      introduction: 'Summary',
      system_overview: {
        architecture_diagram: 'https://cdn.ctrl-freaq.dev/diagram.png',
        tech_stack: 'golang',
      },
    });

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(
        result.error.issues.some(issue => issue.path.join('.') === 'system_overview.tech_stack')
      ).toBe(true);
    }
  });

  it('allows optional sections to be omitted', async () => {
    const compiled = await compileTemplateFile(validFixture);
    const validator = createTemplateValidator({
      templateId: compiled.catalog.id,
      version: compiled.version.version,
      schemaJson: compiled.version.schemaJson,
    });

    const result = validator.safeParse({
      introduction: 'Summary',
      system_overview: {
        architecture_diagram: 'https://cdn.ctrl-freaq.dev/diagram.png',
        tech_stack: 'redis',
      },
    });

    expect(result.success).toBe(true);
  });
});
