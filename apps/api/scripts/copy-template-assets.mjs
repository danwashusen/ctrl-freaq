import { access, cp, mkdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');
const repoRoot = resolve(apiRoot, '..', '..');

export async function copyTemplateAssets({
  sourceDir = resolve(repoRoot, 'templates'),
  destinationDir = resolve(apiRoot, 'dist', 'templates'),
} = {}) {
  try {
    await access(sourceDir, fsConstants.R_OK);
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? `Unable to read template assets from ${sourceDir}: ${error.message}`
        : `Unable to read template assets from ${sourceDir}`;
    throw new Error(message, { cause: error instanceof Error ? error : undefined });
  }

  await mkdir(destinationDir, { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
}

async function runFromCli() {
  const start = performance.now();
  try {
    await copyTemplateAssets();
    const duration = (performance.now() - start).toFixed(1);
    console.log(`[copy-template-assets] Copied templates into dist/templates in ${duration}ms`);
  } catch (error) {
    console.error('[copy-template-assets] Failed to copy template assets:', error);
    process.exitCode = 1;
  }
}

const invokedFromCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedFromCli) {
  await runFromCli();
}
