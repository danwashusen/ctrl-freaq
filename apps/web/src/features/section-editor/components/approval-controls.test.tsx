import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApprovalControls } from './approval-controls';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, 'data-testid': testId, ...props }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid={testId}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <section className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

describe('ApprovalControls', () => {
  const baseProps = {
    sectionTitle: 'Architecture Overview',
    currentStatus: 'review' as const,
    reviewerSummary: 'Pending reviewer sign-off.',
    draftVersion: 7,
    approvedVersion: 6,
    approvedBy: null as string | null,
    approvedAt: null as string | null,
  };

  it('renders review summary and audit placeholders', () => {
    render(<ApprovalControls {...baseProps} approvalNote="Reviewed for architecture alignment." />);

    expect(screen.getByTestId('approval-panel')).toBeInTheDocument();
    expect(screen.getByTestId('review-summary-note')).toHaveTextContent(
      'Pending reviewer sign-off.'
    );
    expect(screen.getByTestId('section-approval-audit')).toBeInTheDocument();
    expect(screen.getByTestId('approved-by')).toHaveTextContent('Not yet approved');
    expect(screen.getByTestId('approved-at')).toHaveTextContent('Awaiting approval');
  });

  it('submits approval note when confirm is clicked after choosing approve', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();

    render(<ApprovalControls {...baseProps} onApprove={onApprove} />);

    await user.click(screen.getByTestId('approval-decision-approve'));
    await user.type(screen.getByTestId('approval-note-input'), 'Ready to publish.');
    await user.click(screen.getByTestId('confirm-approval'));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith({
      decision: 'approve',
      approvalNote: 'Ready to publish.',
    });
  });

  it('disables confirm when submission pending', async () => {
    const user = userEvent.setup();
    render(<ApprovalControls {...baseProps} isSubmitting />);

    const confirmButton = screen.getByTestId('confirm-approval');
    expect(confirmButton).toBeDisabled();

    await user.click(confirmButton);
    expect(confirmButton).toBeDisabled();
  });

  it('renders approval audit data when provided', () => {
    render(
      <ApprovalControls
        {...baseProps}
        approvedBy="staff.engineer@example.com"
        approvedAt="2025-10-02T12:30:00.000Z"
        approvalNote="Validated architecture alignment."
      />
    );

    expect(screen.getByTestId('approved-by')).toHaveTextContent('staff.engineer@example.com');
    expect(screen.getByTestId('approved-at')).toHaveTextContent('2025-10-02T12:30:00.000Z');
    expect(screen.getByTestId('approval-note')).toHaveTextContent(
      'Validated architecture alignment.'
    );
  });
});
