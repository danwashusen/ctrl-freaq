import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function hasWorkspaceMarker(path: string): boolean {
  if (existsSync(join(path, 'pnpm-workspace.yaml'))) {
    return true;
  }

  const packageJsonPath = join(path, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    const workspaces = packageJson.workspaces;
    if (Array.isArray(workspaces) || (typeof workspaces === 'object' && workspaces !== null)) {
      return true;
    }
    return Boolean(packageJson.private && workspaces);
  } catch {
    return false;
  }
}

export function resolveWorkspaceRoot(start: string): string {
  let current = start;

  while (true) {
    if (hasWorkspaceMarker(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return start;
    }

    current = parent;
  }
}
