import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_ROOT_ENV = 'CTRL_FREAQ_TEMPLATE_ROOT';
const DEFAULT_TEMPLATE_BASENAME = 'architecture-reference.yaml';

export interface TemplateLocator {
  readonly root: string;
  resolveFile(templateId?: string): string;
}

export function createTemplateLocator(moduleUrl: string): TemplateLocator {
  const searchRoots = buildSearchRoots(moduleUrl);
  const root = searchRoots.find(candidate => existsSync(candidate));

  if (!root) {
    throw new Error(
      `Unable to locate templates directory. Checked: ${searchRoots
        .map(dir => `'${dir}'`)
        .join(', ')}`
    );
  }

  return {
    root,
    resolveFile(templateId?: string) {
      const filename = normalizeTemplateFilename(templateId);
      const candidate = join(root, filename);
      if (existsSync(candidate)) {
        return candidate;
      }
      throw new Error(`Template file '${filename}' not found under ${root}`);
    },
  };
}

function buildSearchRoots(moduleUrl: string): string[] {
  const roots: string[] = [];
  const envRoot = getEnvValue(TEMPLATE_ROOT_ENV);
  if (envRoot && envRoot.trim().length > 0) {
    roots.push(resolve(envRoot.trim()));
  }
  const currentDir = dirname(fileURLToPath(moduleUrl));
  const apiRoot = resolve(currentDir, '..', '..');
  const repoRoot = resolve(currentDir, '..', '..', '..', '..');
  roots.push(resolve(apiRoot, 'dist', 'templates'));
  roots.push(resolve(apiRoot, 'templates'));
  roots.push(resolve(repoRoot, 'templates'));
  return roots;
}

function normalizeTemplateFilename(templateId?: string): string {
  if (!templateId || templateId.trim().length === 0) {
    return DEFAULT_TEMPLATE_BASENAME;
  }
  const trimmed = templateId.trim();
  return trimmed.endsWith('.yaml') ? trimmed : `${trimmed}.yaml`;
}

function getEnvValue(key: string): string | undefined {
  const match = Object.entries(process.env).find(([envKey]) => envKey === key);
  return match?.[1];
}
