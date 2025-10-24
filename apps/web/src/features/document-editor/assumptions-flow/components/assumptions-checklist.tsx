import { useMemo, useState } from 'react';
import { AlertTriangle, Check, SkipForward } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { AssumptionAction, AssumptionPromptState } from '../../types/assumption-session';

export interface AssumptionsChecklistProps {
  prompts: AssumptionPromptState[];
  overridesOpen: number;
  onRespond: (
    promptId: string,
    action: AssumptionAction,
    payload?: {
      answer?: string;
      notes?: string;
      overrideJustification?: string;
    }
  ) => void;
  isLoading?: boolean;
  disabled?: boolean;
  streamingStatus?: 'idle' | 'streaming' | 'deferred' | 'canceled' | 'fallback';
  streamingBullets?: Array<{ sequence: number; stageLabel: string; content: string | null }>;
  streamingHasOutOfOrder?: boolean;
  streamingAnnouncements?: string[];
  fallbackState?: {
    status: 'active' | 'completed' | 'canceled' | 'failed';
    message: string;
    progressCopy?: string;
  } | null;
}

const getRemainingCount = (prompts: AssumptionPromptState[]): number =>
  prompts.filter(prompt => prompt.status !== 'answered' && prompt.status !== 'override_skipped')
    .length;

const toMultiSelectValue = (value: string | string[] | null): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map(String);
    }
  } catch {
    // ignore parse errors and fall back to comma-separated parsing
  }
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
};

const fromMultiSelectValue = (values: string[]): string => JSON.stringify(values);

interface AssumptionPromptCardProps {
  prompt: AssumptionPromptState;
  disabled?: boolean;
  onRespond: AssumptionsChecklistProps['onRespond'];
}

const AssumptionPromptCard = ({ prompt, onRespond, disabled }: AssumptionPromptCardProps) => {
  const inputId = `${prompt.id}-input`;
  const initialMulti = useMemo(() => toMultiSelectValue(prompt.answer), [prompt.answer]);

  const [textAnswer, setTextAnswer] = useState(prompt.answer ?? '');
  const [singleAnswer, setSingleAnswer] = useState(() => {
    if (prompt.responseType === 'single_select') {
      if (prompt.answer) {
        return prompt.answer;
      }
      const defaultOption = prompt.options.find(option => option.defaultSelected);
      return defaultOption?.id ?? prompt.options[0]?.id ?? '';
    }
    return '';
  });
  const [multiAnswer, setMultiAnswer] = useState<string[]>(initialMulti);

  const resolved = prompt.status === 'answered';
  const skipped = prompt.status === 'override_skipped';

  const handleAnswer = () => {
    if (prompt.responseType === 'text') {
      onRespond(prompt.id, 'answer', { answer: textAnswer.trim() });
      return;
    }

    if (prompt.responseType === 'single_select') {
      onRespond(prompt.id, 'answer', { answer: singleAnswer });
      return;
    }

    onRespond(prompt.id, 'answer', { answer: fromMultiSelectValue(multiAnswer) });
  };

  const handleSkip = () => {
    onRespond(prompt.id, 'skip_override', {
      overrideJustification: 'User chose to override prompt',
    });
  };

  const handleEscalate = () => {
    onRespond(prompt.id, 'escalate', {
      notes: 'Requires stakeholder input',
    });
  };

  const statusBadge = (() => {
    if (resolved) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <Check className="h-3 w-3" aria-hidden="true" /> Resolved
        </span>
      );
    }

    if (skipped) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <SkipForward className="h-3 w-3" aria-hidden="true" /> Override recorded
        </span>
      );
    }

    return null;
  })();

  const renderInput = () => {
    if (prompt.responseType === 'text') {
      return (
        <textarea
          id={inputId}
          className="border-input focus-visible:ring-primary shadow-xs focus-visible:outline-hidden mt-2 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-2"
          value={textAnswer}
          onChange={event => setTextAnswer(event.target.value)}
          aria-describedby={`${prompt.id}-helper`}
          disabled={disabled}
        />
      );
    }

    if (prompt.responseType === 'single_select') {
      return (
        <div className="mt-2 space-y-2" role="radiogroup" aria-labelledby={`${prompt.id}-label`}>
          {prompt.options.map(option => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={prompt.id}
                value={option.id}
                checked={singleAnswer === option.id}
                onChange={() => setSingleAnswer(option.id)}
                disabled={disabled}
                className="h-4 w-4"
              />
              <span>{option.label}</span>
              {option.description ? (
                <span className="text-muted-foreground text-xs">{option.description}</span>
              ) : null}
            </label>
          ))}
        </div>
      );
    }

    // multi_select
    return (
      <div className="mt-2 space-y-2" role="group" aria-labelledby={`${prompt.id}-label`}>
        {prompt.options.map(option => (
          <label key={option.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              value={option.id}
              checked={multiAnswer.includes(option.id)}
              onChange={event => {
                if (event.target.checked) {
                  setMultiAnswer(prev => Array.from(new Set([...prev, option.id])));
                } else {
                  setMultiAnswer(prev => prev.filter(id => id !== option.id));
                }
              }}
              disabled={disabled}
              className="h-4 w-4"
            />
            <span>{option.label}</span>
            {option.description ? (
              <span className="text-muted-foreground text-xs">{option.description}</span>
            ) : null}
          </label>
        ))}
      </div>
    );
  };

  return (
    <article className="border-border bg-card shadow-xs rounded-md border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label
            id={`${prompt.id}-label`}
            htmlFor={inputId}
            className="text-foreground text-sm font-medium"
          >
            {prompt.heading}
          </label>
          <p id={`${prompt.id}-helper`} className="text-muted-foreground mt-1 text-sm">
            {prompt.body}
          </p>
        </div>
        {statusBadge}
      </div>

      {renderInput()}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleAnswer}
          disabled={disabled}
          aria-label={`Mark answered for ${prompt.heading}`}
        >
          Mark answered
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSkip}
          disabled={disabled}
          aria-label={`Skip prompt ${prompt.heading}`}
        >
          Record override
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEscalate}
          disabled={disabled}
          aria-label={`Escalate prompt ${prompt.heading}`}
        >
          Escalate
        </Button>
      </div>
    </article>
  );
};

const OverrideWarningBanner = ({ overridesOpen }: { overridesOpen: number }) => (
  <div
    role="alert"
    className="flex items-start gap-3 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    data-testid="override-banner"
  >
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
    <div>
      <p className="font-medium">Resolve overrides before submission</p>
      <p>
        {overridesOpen === 1
          ? '1 prompt remains overridden and must be reconciled before submission.'
          : `${overridesOpen} prompts remain overridden and must be reconciled before submission.`}
      </p>
    </div>
  </div>
);

export const AssumptionsChecklist = ({
  prompts,
  overridesOpen,
  onRespond,
  isLoading = false,
  disabled = false,
  streamingStatus = 'idle',
  streamingBullets = [],
  streamingHasOutOfOrder = false,
  streamingAnnouncements = [],
  fallbackState = null,
}: AssumptionsChecklistProps) => {
  const remaining = useMemo(() => getRemainingCount(prompts), [prompts]);
  const streamingStatusBadge = useMemo(() => {
    switch (streamingStatus) {
      case 'streaming':
        return {
          label: 'Live guidance in progress',
          className: 'bg-sky-100 text-sky-700',
        };
      case 'deferred':
        return {
          label: 'Streaming deferred',
          className: 'bg-amber-100 text-amber-800',
        };
      case 'canceled':
        return {
          label: 'Streaming canceled',
          className: 'bg-rose-100 text-rose-700',
        };
      case 'fallback':
        return {
          label: 'Fallback delivery in progress',
          className: 'bg-amber-100 text-amber-800',
        };
      default:
        return null;
    }
  }, [streamingStatus]);
  const latestAnnouncement = streamingAnnouncements[streamingAnnouncements.length - 1] ?? '';

  if (isLoading) {
    return (
      <div
        role="status"
        className="border-border bg-card text-muted-foreground rounded-md border px-4 py-6 text-sm"
      >
        Loading assumption prompts…
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="assumptions-checklist-heading">
      <header className="space-y-1">
        <h2 id="assumptions-checklist-heading" className="text-foreground text-lg font-semibold">
          Resolve assumptions ({remaining} remaining)
        </h2>
        <p className="text-muted-foreground text-sm">
          Work through each prompt before drafting new content. Overrides block submission until
          resolved.
        </p>
      </header>

      {overridesOpen > 0 ? <OverrideWarningBanner overridesOpen={overridesOpen} /> : null}

      {streamingStatusBadge || streamingBullets.length > 0 || streamingHasOutOfOrder ? (
        <div className="space-y-2">
          {streamingStatusBadge ? (
            <div
              className={`flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium ${streamingStatusBadge.className}`}
            >
              <span>{streamingStatusBadge.label}</span>
              {streamingHasOutOfOrder ? (
                <span className="flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Resequenced updates
                </span>
              ) : null}
            </div>
          ) : null}

          {streamingStatus === 'fallback' && fallbackState ? (
            <div
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
              aria-live="assertive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              <div>
                <p className="font-medium">{fallbackState.message}</p>
                {fallbackState.progressCopy ? (
                  <p className="text-xs text-amber-800">{fallbackState.progressCopy}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {streamingBullets.length > 0 ? (
            <ul className="border-border/60 bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-sm">
              {streamingBullets.map(bullet => (
                <li key={bullet.sequence} className="flex items-start gap-2">
                  <span className="text-foreground text-xs font-semibold">{bullet.stageLabel}</span>
                  <span>{bullet.content ?? 'Processing…'}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <ul className="space-y-3">
        {prompts.map(prompt => (
          <li key={prompt.id} className="list-none">
            <AssumptionPromptCard prompt={prompt} onRespond={onRespond} disabled={disabled} />
          </li>
        ))}
      </ul>

      {prompts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No assumption prompts available for this section.
        </p>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {latestAnnouncement}
      </div>
    </section>
  );
};
