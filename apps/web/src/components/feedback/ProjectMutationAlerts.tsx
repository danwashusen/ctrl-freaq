import { X } from 'lucide-react';

type MutationAlertStatus = 'idle' | 'success' | 'conflict' | 'error';

export interface ProjectMutationAlertsProps {
  status: MutationAlertStatus;
  message?: string | null;
  onDismiss?: () => void;
}

const toneClasses: Record<Exclude<MutationAlertStatus, 'idle'>, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  conflict: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

const defaultMessages: Record<Exclude<MutationAlertStatus, 'idle'>, string> = {
  success: 'Project updated successfully.',
  conflict: 'This project was updated elsewhere. Refresh to continue editing.',
  error: 'Unable to update the project. Please try again.',
};

const testIdMap: Record<Exclude<MutationAlertStatus, 'idle'>, string> = {
  success: 'project-update-success',
  conflict: 'project-update-conflict',
  error: 'project-update-error',
};

export function ProjectMutationAlerts({ status, message, onDismiss }: ProjectMutationAlertsProps) {
  if (status === 'idle') {
    return null;
  }

  const resolvedMessage = message ?? defaultMessages[status];
  const testId = testIdMap[status];
  const classes = toneClasses[status];

  return (
    <div
      data-testid={testId}
      role="status"
      aria-live="polite"
      className={`flex items-start justify-between rounded-md border px-4 py-3 text-sm ${classes}`}
    >
      <span className="pr-4">{resolvedMessage}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-current transition hover:bg-black/5"
          aria-label="Dismiss project update message"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
