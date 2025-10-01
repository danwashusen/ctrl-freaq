import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConflictDialog } from './conflict-dialog';

describe('ConflictDialog', () => {
  it('renders server snapshot when provided', () => {
    render(
      <ConflictDialog
        open
        conflictState="rebase_required"
        conflictReason="Server has newer content"
        latestApprovedVersion={7}
        events={[]}
        serverSnapshot={{
          version: 7,
          content: '## Server approved content',
          capturedAt: '2025-09-30T12:00:00.000Z',
        }}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByTestId('conflict-server-preview')).toHaveTextContent(
      'Server approved content'
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
