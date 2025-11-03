import type { HTMLAttributes } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  FileClock,
  HelpCircle,
  PauseCircle,
  type LucideIcon,
} from 'lucide-react';

import type { ProjectStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

type ProjectStatusBadgeSize = 'sm' | 'md';

interface ProjectStatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
  status?: ProjectStatus | null;
  icon?: boolean;
  label?: boolean;
  size?: ProjectStatusBadgeSize;
  'aria-label'?: string;
}

const statusMeta: Record<
  ProjectStatus,
  {
    icon: LucideIcon;
    label: string;
  }
> = {
  draft: { icon: FileClock, label: 'Draft' },
  active: { icon: Activity, label: 'Active' },
  paused: { icon: PauseCircle, label: 'Paused' },
  completed: { icon: CheckCircle2, label: 'Completed' },
  archived: { icon: Archive, label: 'Archived' },
};

const fallbackMeta = {
  icon: HelpCircle,
  label: 'Unknown status',
};

const sizeStyles: Record<ProjectStatusBadgeSize, string> = {
  md: 'gap-1.5 px-2.5 py-0.5 text-xs',
  sm: 'gap-1 px-2 py-0.5 text-[0.6875rem]',
};

const iconSizeStyles: Record<ProjectStatusBadgeSize, string> = {
  md: 'h-3.5 w-3.5',
  sm: 'h-3 w-3',
};

const statusTokenClasses: Record<ProjectStatus, string> = {
  draft:
    'bg-[hsl(var(--dashboard-status-draft-bg))] text-[hsl(var(--dashboard-status-draft-text))]',
  active:
    'bg-[hsl(var(--dashboard-status-active-bg))] text-[hsl(var(--dashboard-status-active-text))]',
  paused:
    'bg-[hsl(var(--dashboard-status-paused-bg))] text-[hsl(var(--dashboard-status-paused-text))]',
  completed:
    'bg-[hsl(var(--dashboard-status-completed-bg))] text-[hsl(var(--dashboard-status-completed-text))]',
  archived:
    'bg-[hsl(var(--dashboard-status-archived-bg))] text-[hsl(var(--dashboard-status-archived-text))]',
};

const isProjectStatus = (value: ProjectStatusBadgeProps['status']): value is ProjectStatus =>
  value != null;

export function ProjectStatusBadge({
  status,
  icon = true,
  label = true,
  size = 'md',
  className,
  'aria-label': ariaLabelProp,
  ...rest
}: ProjectStatusBadgeProps) {
  const hasKnownStatus = isProjectStatus(status);
  const meta = hasKnownStatus ? statusMeta[status] : undefined;
  const resolvedMeta = meta ?? fallbackMeta;
  const spanLabel = resolvedMeta.label;
  const showIcon = icon !== false;
  const showLabel = label !== false;
  const tooltipLabel = ariaLabelProp ?? spanLabel;
  const finalAriaLabel = showLabel ? ariaLabelProp : (ariaLabelProp ?? spanLabel);

  const { 'data-testid': dataTestId, ...restProps } = rest as { 'data-testid'?: string };
  const IconComponent = resolvedMeta.icon;
  const badgeStatus = hasKnownStatus ? status : 'unknown';
  const statusClasses = hasKnownStatus ? statusTokenClasses[status] : statusTokenClasses.draft;

  return (
    <span
      role="status"
      data-testid={dataTestId ?? 'project-status-badge'}
      className={cn(
        'inline-flex items-center rounded-full font-semibold uppercase tracking-wide',
        statusClasses,
        sizeStyles[size],
        className
      )}
      data-status={badgeStatus}
      aria-label={finalAriaLabel}
      title={tooltipLabel}
      {...restProps}
    >
      {showIcon ? (
        <IconComponent
          aria-hidden="true"
          className={cn(iconSizeStyles[size])}
          data-testid="project-status-badge-icon"
        />
      ) : null}
      {showLabel ? <span>{spanLabel}</span> : null}
    </span>
  );
}

export default ProjectStatusBadge;
