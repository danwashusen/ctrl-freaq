const TRUTHY = new Set(['1', 'true', 'TRUE']);

export function isTestRuntime(): boolean {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'test' || env === 'ci') {
    return true;
  }
  if (process.env.VITEST) {
    return true;
  }
  const ci = process.env.CI;
  if (ci && TRUTHY.has(ci)) {
    return true;
  }
  return false;
}
