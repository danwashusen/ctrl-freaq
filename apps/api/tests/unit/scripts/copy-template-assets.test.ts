import { mkdtemp, writeFile, rm, readFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants as fsConstants } from 'node:fs';
import { describe, afterEach, expect, it } from 'vitest';

// @ts-expect-error ESM script has no TypeScript declarations
const { copyTemplateAssets } = await import('../../../scripts/copy-template-assets.mjs');

const tempPaths: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempPaths.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

describe('copy-template-assets script', () => {
  it('copies all template files into the destination directory', async () => {
    const sourceDir = await createTempDir('templates-src-');
    const nestedDir = join(sourceDir, 'catalog');
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(sourceDir, 'architecture-reference.yaml'), 'id: template');
    await writeFile(join(nestedDir, 'readme.md'), '# Catalog', { flag: 'w' });

    const destinationDir = await createTempDir('templates-dest-');

    await copyTemplateAssets({ sourceDir, destinationDir });

    await expect(
      readFile(join(destinationDir, 'architecture-reference.yaml'), 'utf-8')
    ).resolves.toContain('id: template');
    await expect(
      readFile(join(destinationDir, 'catalog', 'readme.md'), 'utf-8')
    ).resolves.toContain('# Catalog');
  });

  it('throws an informative error when the source directory is missing', async () => {
    const missingSource = join(tmpdir(), `missing-src-${Date.now()}`);
    const destinationDir = await createTempDir('templates-dest-');

    await expect(copyTemplateAssets({ sourceDir: missingSource, destinationDir })).rejects.toThrow(
      /Unable to read template assets/
    );

    await expect(access(destinationDir, fsConstants.F_OK)).resolves.toBeUndefined();
  });
});
