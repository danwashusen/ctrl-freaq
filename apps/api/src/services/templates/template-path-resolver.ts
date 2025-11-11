import { existsSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';

const TEMPLATE_ROOT_ENV = 'CTRL_FREAQ_TEMPLATE_ROOT';
const DEFAULT_TEMPLATE_BASENAME = 'architecture-reference.yaml';

export interface TemplateLocator {
  readonly root: string;
  resolveFile(templateId?: string): string;
}

export function createTemplateLocator(moduleUrl: string, logger?: Logger): TemplateLocator {
  const searchRoots = buildSearchRoots(moduleUrl, logger);
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

function buildSearchRoots(moduleUrl: string, logger?: Logger): string[] {
  const roots: string[] = [];
  const envRoot = getEnvValue(TEMPLATE_ROOT_ENV)?.trim();
  if (envRoot && envRoot.length > 0) {
    const resolvedEnvRoot = resolve(envRoot);
    logger?.debug(
      {
        action: 'template_search_root_env',
        envRoot: resolvedEnvRoot,
      },
      'Including template search root from environment override'
    );
    roots.push(resolvedEnvRoot);
  }
  const {
    apiRoot: derivedApiRoot,
    repoRoot: derivedRepoRoot,
    distRoot: derivedDistRoot,
  } = deriveRuntimeRoots(moduleUrl);
  const apiRoot = derivedApiRoot ?? process.cwd();
  const repoRoot = derivedRepoRoot ?? resolve(apiRoot, '..', '..');
  const distRoot = derivedDistRoot ?? resolve(apiRoot, 'dist');
  const distTemplates = resolve(distRoot, 'templates');
  const repoTemplates = resolve(repoRoot, 'templates');

  logger?.debug(
    {
      action: 'template_search_root_repo',
      apiRoot,
      repoRoot,
      distTemplates,
      repoTemplates,
    },
    'Including repository template search roots'
  );

  roots.push(distTemplates);
  roots.push(repoTemplates);

  logger?.debug(
    {
      action: 'template_search_roots_resolved',
      roots,
    },
    'Resolved template search roots'
  );
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

interface RuntimeRoots {
  apiRoot?: string;
  repoRoot?: string;
  distRoot?: string;
}

function deriveRuntimeRoots(moduleUrl: string): RuntimeRoots {
  const modulePath = normalizeModulePath(moduleUrl);
  if (!modulePath) {
    return {};
  }

  let currentDir = dirname(modulePath);
  const visited = new Set<string>();
  let apiRoot: string | undefined;
  let repoRoot: string | undefined;
  let distRoot: string | undefined;

  while (!visited.has(currentDir)) {
    visited.add(currentDir);
    const parentDir = dirname(currentDir);
    const currentBasename = basename(currentDir);

    if (!distRoot && currentBasename === 'dist') {
      distRoot = currentDir;
    }

    if (!apiRoot && currentBasename === 'api' && basename(parentDir) === 'apps') {
      apiRoot = currentDir;
      repoRoot = dirname(parentDir);
      if (distRoot) {
        break;
      }
    }

    if (currentDir === parentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return { apiRoot, repoRoot, distRoot };
}

function normalizeModulePath(moduleUrl: string): string | undefined {
  if (!moduleUrl) {
    return undefined;
  }
  try {
    if (moduleUrl.startsWith('file:')) {
      return fileURLToPath(moduleUrl);
    }
    return moduleUrl;
  } catch {
    return undefined;
  }
}
