import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionProgress from './SessionProgress';

describe('SessionProgress', () => {
  it('shows streaming progress with cancel control once threshold exceeded', () => {
    const onCancel = vi.fn();
    render(
      <SessionProgress status="streaming" elapsedMs={6200} onCancel={onCancel} onRetry={vi.fn()} />
    );

    expect(screen.getByText(/streaming/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.2s elapsed/)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel request/i });
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces fallback messaging and retry control on error', () => {
    const onRetry = vi.fn();
    render(<SessionProgress status="error" elapsedMs={0} onCancel={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByText(/assistant paused/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry assistant/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
