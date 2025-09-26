import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEventHandler } from 'react';

type AccessibilityMode = 'standard' | 'high_contrast';

interface AccessibilityModeToggleProps {
  mode: AccessibilityMode;
  onToggle: (mode: AccessibilityMode) => void;
}

const ANNOUNCEMENTS: Record<AccessibilityMode, string> = {
  standard: 'Standard mode enabled',
  high_contrast: 'High contrast mode enabled',
};

const getNextMode = (mode: AccessibilityMode): AccessibilityMode =>
  mode === 'standard' ? 'high_contrast' : 'standard';

export function AccessibilityModeToggle({ mode, onToggle }: AccessibilityModeToggleProps) {
  const [announcement, setAnnouncement] = useState<string>(ANNOUNCEMENTS[mode]);

  useEffect(() => {
    setAnnouncement(ANNOUNCEMENTS[mode]);
  }, [mode]);

  const handleToggle = useCallback(() => {
    const nextMode = getNextMode(mode);
    setAnnouncement(ANNOUNCEMENTS[nextMode]);
    onToggle(nextMode);
  }, [mode, onToggle]);

  const handleKeyDown = useCallback<KeyboardEventHandler<HTMLButtonElement>>(
    event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-pressed={mode === 'high_contrast'}
        aria-label="Accessibility mode"
        className="border-input bg-background focus-visible:outline-ring inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {mode === 'high_contrast' ? 'High contrast' : 'Standard'}
      </button>
      <span data-testid="accessibility-mode-announcer" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
