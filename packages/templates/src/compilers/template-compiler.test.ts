import { readFile } from 'node:fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

import {
  compileTemplateFile,
  compileTemplateSource,
  TemplateCompilationError,
} from './template-compiler';

const fixturesDir = resolve(__dirname, '../../tests/fixtures');

const validFixture = resolve(fixturesDir, 'architecture.valid.yaml');
const invalidVersionFixture = resolve(fixturesDir, 'architecture.invalid-version.yaml');
const missingFieldsFixture = resolve(fixturesDir, 'architecture.missing-fields.yaml');

describe('template compiler', () => {
  it('produces deterministic schema hash and section snapshot for valid templates', async () => {
    const result = await compileTemplateFile(validFixture);

    expect(result.catalog.id).toBe('architecture');
    expect(result.catalog.name).toBe('Architecture Document');
    expect(result.version.version).toBe('1.0.0');
    expect(result.version.schemaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.version.sections).toMatchInlineSnapshot(`
      [
        {
          "children": [],
          "fields": [],
          "guidance": "Summarize the solution and the key decision drivers.",
          "id": "introduction",
          "orderIndex": 1,
          "required": true,
          "title": "Executive Summary",
          "type": "markdown",
        },
        {
          "children": [],
          "fields": [
            {
              "allowedValues": null,
              "dataType": "url",
              "defaultValue": null,
              "description": "Link to the canonical diagram stored in the design system.",
              "id": "architecture_diagram",
              "label": "Architecture Diagram URL",
              "maxLength": null,
              "minLength": null,
              "pattern": null,
              "required": true,
            },
            {
              "allowedValues": [
                "react",
                "node",
                "sqlite",
                "redis",
              ],
              "dataType": "enum",
              "defaultValue": null,
              "description": "Primary Technologies",
              "id": "tech_stack",
              "label": "Primary Technologies",
              "maxLength": null,
              "minLength": null,
              "pattern": null,
              "required": true,
            },
          ],
          "guidance": "Describe the high-level system architecture and major components.",
          "id": "system_overview",
          "orderIndex": 2,
          "required": true,
          "title": "System Overview",
          "type": "rich-text",
        },
        {
          "children": [
            {
              "children": [],
              "fields": [
                {
                  "allowedValues": null,
                  "dataType": "markdown",
                  "defaultValue": null,
                  "description": null,
                  "id": "context",
                  "label": "Context",
                  "maxLength": null,
                  "minLength": null,
                  "pattern": null,
                  "required": true,
                },
                {
                  "allowedValues": null,
                  "dataType": "markdown",
                  "defaultValue": null,
                  "description": null,
                  "id": "decision",
                  "label": "Decision",
                  "maxLength": null,
                  "minLength": null,
                  "pattern": null,
                  "required": true,
                },
                {
                  "allowedValues": [
                    "proposed",
                    "approved",
                    "rejected",
                  ],
                  "dataType": "enum",
                  "defaultValue": null,
                  "description": null,
                  "id": "status",
                  "label": "Status",
                  "maxLength": null,
                  "minLength": null,
                  "pattern": null,
                  "required": true,
                },
              ],
              "guidance": null,
              "id": "decision_entry",
              "orderIndex": 1,
              "required": false,
              "title": "Decision Entry",
              "type": "list",
            },
          ],
          "fields": [],
          "guidance": "Track trade-offs and major architectural decisions.",
          "id": "decision_log",
          "orderIndex": 3,
          "required": false,
          "title": "Decision Log",
          "type": "decision-log",
        },
      ]
    `);
    expect(result.version.schemaJson).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['introduction', 'system_overview']),
      properties: expect.objectContaining({
        introduction: expect.objectContaining({ type: 'string' }),
        system_overview: expect.any(Object),
        decision_log: expect.any(Object),
      }),
    });
  });

  it('throws a semantic version error when version is invalid', async () => {
    await expect(compileTemplateFile(invalidVersionFixture)).rejects.toBeInstanceOf(
      TemplateCompilationError
    );
  });

  it('surfaces missing field metadata failures with context', async () => {
    await expect(compileTemplateFile(missingFieldsFixture)).rejects.toThrow(/metric_value/);
  });

  it('compiles inline YAML sources matching file-based compilation', async () => {
    const fileResult = await compileTemplateFile(validFixture);
    const yaml = await readFile(validFixture, 'utf-8');
    const fromSource = await compileTemplateSource({
      source: yaml,
      sourcePath: '<inline-fixture>',
    });

    expect(fromSource.catalog).toMatchObject({
      id: fileResult.catalog.id,
      name: fileResult.catalog.name,
    });
    expect(fromSource.version.schemaHash).toBe(fileResult.version.schemaHash);
    expect(fromSource.version.sections).toEqual(fileResult.version.sections);
    expect(fromSource.version.sourcePath).toBe('<inline-fixture>');
  });
});
