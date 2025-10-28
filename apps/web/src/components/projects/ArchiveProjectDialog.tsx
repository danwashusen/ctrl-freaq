import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface ArchiveProjectDialogProps {
  open: boolean;
  projectName: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveProjectDialog({
  open,
  projectName,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ArchiveProjectDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold text-gray-900">Archive project</h2>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to archive <span className="font-medium">{projectName}</span>?
          Archived projects disappear from the dashboard for everyone until they are restored.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
            data-testid="archive-project-confirm"
          >
            {isSubmitting ? 'Archiving…' : 'Archive'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ArchiveProjectDialog;
