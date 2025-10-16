import type { FC } from 'react';

import type { RemediationCard } from '../stores/section-quality-store';

const severityClasses: Record<
  RemediationCard['severity'],
  { badge: string; container: string; title: string }
> = {
  Blocker: {
    badge: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100',
    container: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-900/30',
    title: 'text-rose-900 dark:text-rose-100',
  },
  Warning: {
    badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
    container: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-900/30',
    title: 'text-amber-900 dark:text-amber-100',
  },
  Pass: {
    badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
    container: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-900/30',
    title: 'text-emerald-900 dark:text-emerald-100',
  },
  Neutral: {
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
    container: 'border-slate-200 bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/40',
    title: 'text-slate-800 dark:text-slate-100',
  },
};

export interface SectionRemediationListProps {
  items: RemediationCard[];
}

export const SectionRemediationList: FC<SectionRemediationListProps> = ({ items }) => {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="section-remediation-list">
      {items.map(item => {
        const classes = severityClasses[item.severity];
        return (
          <article
            key={item.ruleId}
            className={`rounded-lg border p-4 shadow-sm transition-colors ${classes.container}`}
            data-testid="remediation-card"
          >
            <header className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${classes.badge}`}
                >
                  {item.severity}
                </span>
                <h3 className={`text-sm font-semibold ${classes.title}`}>{item.summary}</h3>
              </div>
              {item.docLink && (
                <a
                  href={item.docLink.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-200"
                  data-testid="remediation-doc-link"
                >
                  {item.docLink.label}
                </a>
              )}
            </header>

            {!!item.steps.length && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {item.steps.map((step, index) => (
                  <li key={`${item.ruleId}-step-${index}`}>{step}</li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default SectionRemediationList;
