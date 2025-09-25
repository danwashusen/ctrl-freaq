import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AccessibilityModeToggle } from '@/features/section-editor/components/accessibility-mode-toggle';

describe('AccessibilityModeToggle', () => {
  it('announces mode changes for screen reader users', () => {
    const onToggle = vi.fn();

    render(<AccessibilityModeToggle mode="standard" onToggle={onToggle} />);

    const toggle = screen.getByRole('button', { name: /accessibility mode/i });
    expect(toggle).toBeVisible();

    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(onToggle).toHaveBeenCalledWith('high_contrast');

    const announcer = screen.getByTestId('accessibility-mode-announcer');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveTextContent(/High contrast mode enabled/);
  });

  it('supports keyboard navigation and spacebar toggle', () => {
    const onToggle = vi.fn();

    render(<AccessibilityModeToggle mode="high_contrast" onToggle={onToggle} />);

    const toggle = screen.getByRole('button', { name: /accessibility mode/i });
    toggle.focus();
    expect(toggle).toHaveFocus();

    fireEvent.keyDown(toggle, { key: ' ' });
    expect(onToggle).toHaveBeenCalledWith('standard');
  });
});
