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
  const { statusLabel, ariaAnnouncement, revertToPublished, handleLogout, draftKey } =
    useDraftPersistence({
      projectSlug,
      documentSlug,
      sectionTitle,
      sectionPath,
      authorId,
    });

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
        {ariaAnnouncement ?? statusLabel}
      </span>
    </div>
  );
}
