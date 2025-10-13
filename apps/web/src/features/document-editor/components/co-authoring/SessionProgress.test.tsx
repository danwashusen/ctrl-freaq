import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionProgress from './SessionProgress';

describe('SessionProgress', () => {
  it('shows streaming progress with cancel control once threshold exceeded', () => {
    const onCancel = vi.fn();
    render(
      <SessionProgress
        progress={{ status: 'streaming', elapsedMs: 6200, retryCount: 0 }}
        replacementNotice={null}
        onCancel={onCancel}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/streaming/i)).toBeInTheDocument();
    expect(screen.getByText(/6\.2s elapsed/)).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /cancel request/i });
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces fallback messaging and retry control on error', () => {
    const onRetry = vi.fn();
    render(
      <SessionProgress
        progress={{ status: 'error', elapsedMs: 0, retryCount: 0 }}
        replacementNotice={null}
        onCancel={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/assistant paused/i)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /retry assistant/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('displays stage labels and first update metrics when available', () => {
    render(
      <SessionProgress
        progress={{
          status: 'streaming',
          elapsedMs: 420,
          stageLabel: 'drafting',
          firstUpdateMs: 180,
          retryCount: 0,
        }}
        replacementNotice={null}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/drafting/)).toBeInTheDocument();
    expect(screen.getByTestId('co-author-progress-first-update')).toHaveTextContent(/0\.18s/);
  });

  it('announces cancellation details and retry metadata', () => {
    const onRetry = vi.fn();
    render(
      <SessionProgress
        progress={{
          status: 'canceled',
          elapsedMs: 2_400,
          cancelReason: 'author_cancelled',
          retryCount: 2,
        }}
        replacementNotice={null}
        onCancel={vi.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/you canceled the assistant request/i)).toBeInTheDocument();
    expect(screen.getByText(/retry attempts: 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry assistant/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders replacement notices when present', () => {
    render(
      <SessionProgress
        progress={{ status: 'streaming', elapsedMs: 1200, retryCount: 0 }}
        replacementNotice={{
          previousSessionId: 'session-abc123',
          replacedAt: new Date().toISOString(),
        }}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByTestId('co-author-progress-replacement')).toHaveTextContent(/abc123/i);
  });
});
