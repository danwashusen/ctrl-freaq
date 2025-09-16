import type { JSX, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import { logger } from '../../lib/logger';

export interface TemplateMigrationSummary {
  status: 'pending' | 'succeeded' | 'failed';
  fromVersion: string;
  toVersion: string;
  templateId: string;
  completedAt?: string;
}

export interface RemovedVersionInfo {
  templateId: string;
  version: string;
  message: string;
}

export interface TemplateUpgradeBannerProps {
  migration: TemplateMigrationSummary | null;
  removedVersion?: RemovedVersionInfo | null;
  children?: ReactNode;
}

export function TemplateUpgradeBanner(props: TemplateUpgradeBannerProps): JSX.Element {
  const { migration, removedVersion, children } = props;

  const bannerState = useMemo(() => {
    if (removedVersion) {
      return 'removed' as const;
    }

    if (migration) {
      return migration.status;
    }

    return null;
  }, [migration, removedVersion]);

  useEffect(() => {
    if (migration && migration.status === 'succeeded') {
      logger.info('document.template.upgraded', {
        templateId: migration.templateId,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        completedAt: migration.completedAt ?? null,
      });
    }
  }, [migration]);

  useEffect(() => {
    if (removedVersion) {
      logger.warn('document.template.version_removed', {
        templateId: removedVersion.templateId,
        missingVersion: removedVersion.version,
      });
    }
  }, [removedVersion]);

  if (bannerState === null) {
    return <>{children}</>;
  }

  if (bannerState === 'removed' && removedVersion) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        data-testid="template-removed-banner"
      >
        <p className="font-semibold">
          Template version {removedVersion.version} is no longer available.
        </p>
        <p className="mt-1">{removedVersion.message}</p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  if (bannerState === 'succeeded' && migration) {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        data-testid="template-upgraded-banner"
      >
        <p className="font-semibold">Document upgraded to version {migration.toVersion}.</p>
        <p className="mt-1 text-emerald-800">
          Previously on {migration.fromVersion}. Template {migration.templateId} is now up to date.
        </p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  if (bannerState === 'failed' && migration) {
    return (
      <div
        role="alert"
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        data-testid="template-upgrade-failed-banner"
      >
        <p className="font-semibold">Template upgrade failed for version {migration.toVersion}.</p>
        <p className="mt-1 text-amber-800">
          Please review validation errors and retry. Original version {migration.fromVersion} remains active.
        </p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  if (bannerState === 'pending' && migration) {
    return (
      <div
        role="status"
        className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
        data-testid="template-upgrade-pending-banner"
      >
        <p className="font-semibold">Upgrading template to version {migration.toVersion}…</p>
        <p className="mt-1 text-sky-800">Previous version: {migration.fromVersion}. Hang tight.</p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  return <>{children}</>;
}
