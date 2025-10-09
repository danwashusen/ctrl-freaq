import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import ProposalPreview from './ProposalPreview';
import type { PendingProposalSnapshot } from '../../stores/co-authoring-store';

const baseProposal: PendingProposalSnapshot & {
  diff: {
    mode: 'unified' | 'split';
    segments: Array<{
      segmentId: string;
      type: 'added' | 'removed' | 'context';
      value: string;
      content?: string;
    }>;
  };
} = {
  proposalId: 'proposal-123',
  originTurnId: 'turn-42',
  diff: {
    mode: 'unified',
    segments: [
      { segmentId: 'seg-1', type: 'context', value: 'Existing text', content: 'Existing text' },
      {
        segmentId: 'seg-2',
        type: 'added',
        value: '',
        content: 'New accessible copy',
      },
    ],
  },
  annotations: [
    {
      segmentId: 'seg-2',
      segmentType: 'added',
      originTurnId: 'turn-42',
      promptId: 'prompt-improve-accessibility',
      rationale: 'Adds ARIA live updates reference',
      confidence: 0.86,
      citations: ['decision:telemetry'],
    },
  ],
  confidence: 0.86,
  promptSummary: 'Improve accessibility cues',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  citations: ['decision:telemetry'],
  diffHash: 'sha256:fixture-preview',
};

describe('ProposalPreview', () => {
  it('renders diff segments with prompt badges and confidence', () => {
    render(
      <ProposalPreview
        proposal={baseProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRequestChanges={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /AI proposal preview/i })).toBeInTheDocument();
    expect(screen.getByText('New accessible copy')).toBeInTheDocument();
    expect(screen.getByText(/Prompt: prompt-improve-accessibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 86%/i)).toBeInTheDocument();
    expect(screen.getByText(/Adds ARIA live updates reference/i)).toBeInTheDocument();
  });

  it('maps annotations to rendered diff segments', () => {
    render(
      <ProposalPreview
        proposal={baseProposal}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRequestChanges={vi.fn()}
      />
    );

    const diffSection = screen.getByRole('region', { name: /diff preview/i });
    const addedSegment = within(diffSection).getByText('New accessible copy');
    expect(addedSegment).toHaveAttribute('data-segment-id', 'seg-2');

    const badge = within(diffSection).getByText('turn-42');
    expect(badge).toHaveAttribute('data-origin-turn', 'turn-42');
  });
});
