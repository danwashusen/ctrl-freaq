import type { JSX, ReactNode } from 'react';

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

export function TemplateUpgradeBanner(_props: TemplateUpgradeBannerProps): JSX.Element {
  throw new Error('TemplateUpgradeBanner component not implemented');
}
