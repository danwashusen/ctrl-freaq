import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreateProjectRequest, ProjectVisibility } from '@/lib/api';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_GOAL_SUMMARY_LENGTH = 280;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type CreateProjectFieldErrors = {
  name?: string;
  description?: string;
  goalSummary?: string;
  goalTargetDate?: string;
};

const defaultState = (visibility: ProjectVisibility) => ({
  name: '',
  description: '',
  visibility,
  goalTargetDate: '',
  goalSummary: '',
});

export interface CreateProjectDialogProps {
  open: boolean;
  onCancel: () => void;
  onCreate: (payload: CreateProjectRequest) => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  defaultVisibility?: ProjectVisibility;
}

export function CreateProjectDialog({
  open,
  onCancel,
  onCreate,
  isSubmitting = false,
  errorMessage,
  defaultVisibility = 'workspace',
}: CreateProjectDialogProps) {
  const [formState, setFormState] = useState(() => defaultState(defaultVisibility));
  const [fieldErrors, setFieldErrors] = useState<CreateProjectFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setFormState(defaultState(defaultVisibility));
      setFieldErrors({});
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [open, defaultVisibility]);

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) {
      return true;
    }
    return !formState.name.trim();
  }, [formState.name, isSubmitting]);

  if (!open) {
    return null;
  }

  const dialogTitleId = 'create-project-dialog-title';
  const dialogDescriptionId = 'create-project-dialog-description';

  const handleInputChange =
    (field: keyof typeof formState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState(prev => ({ ...prev, [field]: value }));
      if (fieldErrors[field as keyof CreateProjectFieldErrors]) {
        setFieldErrors(prev => {
          const next = { ...prev };
          delete next[field as keyof CreateProjectFieldErrors];
          return next;
        });
      }
    };

  const validate = (): CreateProjectFieldErrors => {
    const nextErrors: CreateProjectFieldErrors = {};
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      nextErrors.name = 'Project name is required';
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      nextErrors.name = `Project name must be ${MAX_NAME_LENGTH} characters or fewer`;
    }

    const trimmedDescription = formState.description.trim();
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
    }

    const trimmedGoalSummary = formState.goalSummary.trim();
    if (trimmedGoalSummary.length > MAX_GOAL_SUMMARY_LENGTH) {
      nextErrors.goalSummary = `Goal summary must be ${MAX_GOAL_SUMMARY_LENGTH} characters or fewer`;
    }

    if (formState.goalTargetDate && !ISO_DATE_PATTERN.test(formState.goalTargetDate)) {
      nextErrors.goalTargetDate = 'Goal date must be in YYYY-MM-DD format';
    }

    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    const trimmedName = formState.name.trim();
    const trimmedDescription = formState.description.trim();
    const trimmedGoalSummary = formState.goalSummary.trim();

    const payload: CreateProjectRequest = {
      name: trimmedName,
      visibility: formState.visibility,
    };

    if (trimmedDescription) {
      payload.description = trimmedDescription;
    }

    if (formState.goalTargetDate) {
      payload.goalTargetDate = formState.goalTargetDate;
    }

    if (trimmedGoalSummary) {
      payload.goalSummary = trimmedGoalSummary;
    }

    await onCreate(payload);
  };

  return (
    <div
      className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="create-project-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        data-testid="create-project-dialog"
        className="w-full max-w-xl rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <form onSubmit={handleSubmit}>
          <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                New project
              </p>
              <h2 id={dialogTitleId} className="mt-1 text-lg font-semibold text-slate-900">
                Create a documentation project
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              aria-label="Close create project dialog"
            >
              ✕
            </Button>
          </header>

          <div id={dialogDescriptionId} className="space-y-4 px-6 py-4 text-sm text-slate-700">
            <div>
              <label className="text-sm font-medium text-slate-900" htmlFor="create-project-name">
                Project name
              </label>
              <input
                id="create-project-name"
                ref={nameInputRef}
                data-testid="create-project-name"
                type="text"
                maxLength={MAX_NAME_LENGTH}
                value={formState.name}
                onChange={handleInputChange('name')}
                disabled={isSubmitting}
                className="focus:outline-hidden mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Acme Onboarding"
                required
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label
                className="text-sm font-medium text-slate-900"
                htmlFor="create-project-description"
              >
                Description <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                id="create-project-description"
                data-testid="create-project-description"
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={formState.description}
                onChange={handleInputChange('description')}
                disabled={isSubmitting}
                rows={3}
                className="focus:outline-hidden mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Outline the initiative and expected deliverables"
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  className="text-sm font-medium text-slate-900"
                  htmlFor="create-project-visibility"
                >
                  Visibility
                </label>
                <select
                  id="create-project-visibility"
                  data-testid="create-project-visibility"
                  value={formState.visibility}
                  onChange={handleInputChange('visibility')}
                  disabled={isSubmitting}
                  className="focus:outline-hidden mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="workspace">Workspace</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label
                  className="text-sm font-medium text-slate-900"
                  htmlFor="create-project-goal-target-date"
                >
                  Goal target date <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="create-project-goal-target-date"
                  data-testid="create-project-goal-target-date"
                  type="date"
                  value={formState.goalTargetDate}
                  onChange={handleInputChange('goalTargetDate')}
                  disabled={isSubmitting}
                  className="focus:outline-hidden mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                />
                {fieldErrors.goalTargetDate && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {fieldErrors.goalTargetDate}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                className="text-sm font-medium text-slate-900"
                htmlFor="create-project-goal-summary"
              >
                Goal summary <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                id="create-project-goal-summary"
                data-testid="create-project-goal-summary"
                maxLength={MAX_GOAL_SUMMARY_LENGTH}
                value={formState.goalSummary}
                onChange={handleInputChange('goalSummary')}
                disabled={isSubmitting}
                rows={2}
                className="focus:outline-hidden mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="E.g., Ship dashboard lifecycle MVP"
              />
              {fieldErrors.goalSummary && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.goalSummary}
                </p>
              )}
            </div>

            {errorMessage && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {errorMessage}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="create-project-submit"
              disabled={isSubmitDisabled}
              aria-busy={isSubmitting}
              className={cn(
                'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-600',
                isSubmitting && 'pointer-events-none opacity-70'
              )}
            >
              {isSubmitting ? 'Creating…' : 'Create project'}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
