import { expect, test } from '@playwright/test';

test.describe('Section Approval Finalization', () => {
  test('allows authorized reviewer to approve and records audit metadata', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview/review');

    const approvalPanel = page.getByTestId('approval-panel');
    await expect(approvalPanel).toBeVisible();
    await expect(approvalPanel.getByTestId('review-summary-note')).toBeVisible();

    await approvalPanel.getByTestId('approval-decision-approve').click();
    await approvalPanel
      .getByTestId('approval-note-input')
      .fill('Reviewed for architecture alignment.');
    await approvalPanel.getByTestId('confirm-approval').click();

    const statusChip = page.getByTestId('section-status-chip');
    await expect(statusChip).toHaveText(/ready/i);

    const audit = page.getByTestId('section-approval-audit');
    await expect(audit).toBeVisible();
    await expect(audit.getByTestId('approved-by')).toContainText('Reviewed by');
    await expect(audit.getByTestId('approved-at')).toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(audit.getByTestId('approval-note')).toContainText(
      'Reviewed for architecture alignment.'
    );
  });
});
