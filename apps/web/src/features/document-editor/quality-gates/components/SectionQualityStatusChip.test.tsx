import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SectionQualityStatusChip } from './SectionQualityStatusChip';

describe('SectionQualityStatusChip', () => {
  it('renders status message and outcome badge for blocker results', () => {
    render(
      <SectionQualityStatusChip
        status="completed"
        statusMessage="Validation found blockers."
        lastStatus="Blocker"
        isSubmissionBlocked
        blockerCount={2}
        onRun={vi.fn()}
      />
    );

    expect(screen.getByTestId('section-quality-status-chip')).toHaveTextContent(
      'Validation found blockers.'
    );
    expect(screen.getByTestId('quality-status-outcome')).toHaveTextContent('Blocker');
    expect(screen.getByTestId('quality-status-helper')).toHaveTextContent('Publishing blocked');
  });

  it('invokes onRun when the re-run button is clicked', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();

    render(
      <SectionQualityStatusChip
        status="completed"
        statusMessage="Validation passed."
        lastStatus="Pass"
        onRun={onRun}
      />
    );

    const rerunButton = screen.getByTestId('quality-run-again');
    await user.click(rerunButton);

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('shows helper copy and run CTA for neutral status', () => {
    const onRun = vi.fn();

    render(
      <SectionQualityStatusChip
        status="idle"
        statusMessage="Validation not run yet."
        onRun={onRun}
      />
    );

    expect(screen.getByTestId('quality-status-helper')).toHaveTextContent(
      'Run validation before submission.'
    );
    expect(screen.getByTestId('quality-run-again')).toHaveTextContent('Run validation');
  });

  it('shows failure alert and retry handler when validation fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <SectionQualityStatusChip
        status="failed"
        statusMessage="Validation failed—retry required."
        timeoutCopy="Incident incident-xyz logged for QA follow-up."
        incidentId="incident-xyz"
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('quality-runner-alert')).toHaveTextContent(
      'Validation paused—service unavailable. Try again or contact QA.'
    );
    expect(screen.getByTestId('quality-incident-id')).toHaveTextContent('incident-xyz');

    const retryButton = screen.getByTestId('quality-runner-retry');
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
