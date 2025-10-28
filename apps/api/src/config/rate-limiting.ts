export type RateLimitEnforcementMode = 'reject' | 'log';

export const DEFAULT_RATE_LIMIT_ENFORCEMENT_MODE: RateLimitEnforcementMode = 'reject';

export const RATE_LIMIT_ENFORCEMENT_MODES: ReadonlySet<RateLimitEnforcementMode> = new Set([
  'reject',
  'log',
]);

const isRateLimitEnforcementMode = (value: unknown): value is RateLimitEnforcementMode =>
  value === 'reject' || value === 'log';

export const resolveRateLimitEnforcementMode = (
  value?: string | RateLimitEnforcementMode | null
): RateLimitEnforcementMode => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (isRateLimitEnforcementMode(normalized)) {
      return normalized;
    }
  }

  if (value && isRateLimitEnforcementMode(value)) {
    return value;
  }

  return DEFAULT_RATE_LIMIT_ENFORCEMENT_MODE;
};
