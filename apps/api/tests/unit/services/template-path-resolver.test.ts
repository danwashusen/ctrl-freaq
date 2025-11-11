import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createTemplateLocator } from '../../../src/services/templates/template-path-resolver.js';

describe('template-path-resolver', () => {
  let tmpRoot: string | null = null;
  let previousTemplateRoot: string | undefined;

  beforeEach(() => {
    previousTemplateRoot = process.env.CTRL_FREAQ_TEMPLATE_ROOT;
    delete process.env.CTRL_FREAQ_TEMPLATE_ROOT;
  });

  afterEach(async () => {
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = null;
    }
    if (typeof previousTemplateRoot === 'string') {
      process.env.CTRL_FREAQ_TEMPLATE_ROOT = previousTemplateRoot;
    } else {
      delete process.env.CTRL_FREAQ_TEMPLATE_ROOT;
    }
  });

  test('prefers dist templates when running from compiled bundles', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'template-locator-'));
    tmpRoot = baseDir;
    const distServicesDir = join(baseDir, 'apps/api/dist/services');
    const distTemplatesDir = join(baseDir, 'apps/api/dist/templates');

    await mkdir(distServicesDir, { recursive: true });
    await mkdir(distTemplatesDir, { recursive: true });
    await writeFile(
      join(distTemplatesDir, 'architecture-reference.yaml'),
      'version: 9.9.9\ntitle: Test Template\n',
      'utf-8'
    );

    const fakeModuleUrl = pathToFileURL(
      join(distServicesDir, 'document-provisioning.service.js')
    ).href;
    const locator = createTemplateLocator(fakeModuleUrl);

    expect(locator.root).toBe(distTemplatesDir);
    const resolvedPath = locator.resolveFile('architecture-reference');
    expect(resolvedPath).toBe(join(distTemplatesDir, 'architecture-reference.yaml'));
  });
});
