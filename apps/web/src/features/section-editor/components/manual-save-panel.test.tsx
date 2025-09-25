import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ManualSavePanel } from './manual-save-panel';

describe('ManualSavePanel', () => {
  const baseProps = {
    summaryNote: '',
    isSaving: false,
    conflictState: 'clean' as const,
    onSummaryChange: vi.fn(),
    onManualSave: vi.fn(),
    onOpenDiff: vi.fn(),
    onSubmitReview: vi.fn(),
  };

  it('updates summary note via callback', () => {
    const onSummaryChange = vi.fn();

    render(<ManualSavePanel {...baseProps} onSummaryChange={onSummaryChange} />);

    fireEvent.change(screen.getByTestId('summary-note-input'), {
      target: { value: 'Updated rationale' },
    });

    expect(onSummaryChange).toHaveBeenCalledWith('Updated rationale');
  });

  it('invokes manual save handler and reflects saving state', () => {
    const onManualSave = vi.fn();

    const { rerender } = render(<ManualSavePanel {...baseProps} onManualSave={onManualSave} />);

    fireEvent.click(screen.getByTestId('save-draft'));
    expect(onManualSave).toHaveBeenCalledTimes(1);

    rerender(<ManualSavePanel {...baseProps} onManualSave={onManualSave} isSaving />);

    const button = screen.getByTestId('save-draft');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('lists formatting warnings for unsupported marks', () => {
    render(
      <ManualSavePanel
        {...baseProps}
        formattingWarnings={[
          { id: 'ann-1', message: 'Inline color not supported', severity: 'warning' },
          { id: 'ann-2', message: 'Font size not supported', severity: 'error' },
        ]}
      />
    );

    const warnings = screen.getAllByTestId('formatting-warning');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toHaveTextContent('Inline color not supported');
  });

  it('exposes review and diff actions', () => {
    const onOpenDiff = vi.fn();
    const onSubmitReview = vi.fn();

    render(
      <ManualSavePanel {...baseProps} onOpenDiff={onOpenDiff} onSubmitReview={onSubmitReview} />
    );

    fireEvent.click(screen.getByTestId('open-diff'));
    fireEvent.click(screen.getByTestId('submit-review'));

    expect(onOpenDiff).toHaveBeenCalledTimes(1);
    expect(onSubmitReview).toHaveBeenCalledTimes(1);
  });

  it('disables review submission when blocked with message', () => {
    render(
      <ManualSavePanel
        {...baseProps}
        isReviewDisabled
        reviewDisabledReason="Resolve conflicts before submitting"
      />
    );

    const submitButton = screen.getByTestId('submit-review');
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('review-blocked-message')).toHaveTextContent(
      'Resolve conflicts before submitting'
    );
  });
});
