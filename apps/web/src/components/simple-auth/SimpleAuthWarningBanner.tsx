import { AlertTriangle } from 'lucide-react';

import { AUTH_PROVIDER } from '@/lib/auth-provider';

type SimpleAuthWarningBannerProps = {
  provider?: 'simple' | 'clerk';
};

export function SimpleAuthWarningBanner({
  provider = AUTH_PROVIDER,
}: SimpleAuthWarningBannerProps) {
  if (provider !== 'simple') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-100 text-amber-900"
      data-testid="simple-auth-warning"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="font-medium">
          Simple auth mode is active. This flow is intended for local development only. API requests
          use `simple:&lt;userId&gt;` bearer tokens and should never reach production environments.
        </p>
      </div>
    </div>
  );
}
