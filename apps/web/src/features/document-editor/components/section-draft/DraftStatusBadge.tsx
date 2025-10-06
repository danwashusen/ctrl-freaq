import { useCallback, useEffect } from 'react';

import { useDraftPersistence } from '../../hooks/use-draft-persistence';
import { registerDraftLogoutHandler } from '@/lib/draft-logout-registry';

interface DraftStatusBadgeProps {
  projectSlug: string;
  documentSlug: string;
  sectionTitle: string;
  sectionPath: string;
  authorId: string;
  onDraftCleared?: (draftKey: string) => void;
}

export function DraftStatusBadge(props: DraftStatusBadgeProps) {
  const { projectSlug, documentSlug, sectionTitle, sectionPath, authorId, onDraftCleared } = props;
  const {
    statusLabel,
    ariaAnnouncement,
    revertToPublished,
    handleLogout,
    draftKey,
    lastUpdatedLabel,
    lastUpdatedIso,
  } = useDraftPersistence({
    projectSlug,
    documentSlug,
    sectionTitle,
    sectionPath,
    authorId,
  });

  const lastUpdatedText = lastUpdatedLabel ? `Last updated ${lastUpdatedLabel}` : null;
  const liveAnnouncement = ariaAnnouncement
    ? [ariaAnnouncement, lastUpdatedText].filter(Boolean).join(' ')
    : [statusLabel, lastUpdatedText].filter(Boolean).join(' - ');

  const handleRevert = useCallback(async () => {
    await revertToPublished();
    onDraftCleared?.(draftKey);
  }, [revertToPublished, onDraftCleared, draftKey]);

  useEffect(() => {
    const unregister = registerDraftLogoutHandler(authorId, async () => {
      await handleLogout();
      onDraftCleared?.(draftKey);
    });

    return unregister;
  }, [authorId, handleLogout, onDraftCleared, draftKey]);

  return (
    <div className="flex items-center gap-2" data-testid="section-draft-status">
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        {statusLabel}
        {lastUpdatedLabel ? (
          <span className="whitespace-nowrap">
            {' '}
            - Last updated{' '}
            <time
              data-testid="draft-last-updated"
              dateTime={lastUpdatedIso ?? undefined}
              suppressHydrationWarning
            >
              {lastUpdatedLabel}
            </time>
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className="text-xs font-medium text-slate-600 underline hover:text-slate-800"
        onClick={handleRevert}
        data-testid="revert-to-published"
      >
        Revert to published
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </span>
    </div>
  );
}
