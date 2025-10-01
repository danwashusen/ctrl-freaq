import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Approval Finalization', () => {
  test('allows authorized reviewer to approve and records audit metadata', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const preview = page.getByTestId('section-preview');
    await expect(preview).toBeVisible();

    const enterEdit = preview.getByTestId('enter-edit');
    await enterEdit.evaluate(element => {
      (element as HTMLElement).click();
    });

    const editorPanel = page.getByTestId('section-editor-panel');
    await editorPanel.waitFor({ state: 'visible' });

    const approvalPanel = page.getByTestId('approval-panel');
    await expect(approvalPanel).toBeVisible();
    const initialSummary = (
      await approvalPanel.getByTestId('review-summary-note').innerText()
    ).trim();
    expect([
      'Validate gateway contract schema updates.',
      'Gateway contract ready for QA.',
    ]).toContain(initialSummary);

    const approvalNote = 'Approved gateway contract for fixture review.';
    await approvalPanel.getByTestId('approval-decision-approve').click();
    await approvalPanel.getByTestId('approval-note-input').fill(approvalNote);
    await expect(approvalPanel.getByTestId('confirm-approval')).toBeEnabled();
    await expect(approvalPanel.getByTestId('section-status-chip')).toHaveText(/review pending/i);

    const summaryNote = approvalPanel.getByTestId('review-summary-note');
    await expect(summaryNote).toContainText('Gateway contract ready for QA.');

    const audit = approvalPanel.getByTestId('section-approval-audit');
    await expect(audit).toBeVisible();
    await expect(audit.getByTestId('approved-by')).toContainText('Not yet approved');
    await expect(audit.getByTestId('approved-at')).toHaveText('Awaiting approval');
    await expect(audit.getByTestId('approval-note')).toContainText(
      'Gateway contract ready for QA.'
    );

    await approvalPanel.getByTestId('confirm-approval').click();

    await editorPanel.waitFor({ state: 'hidden' });

    await expect(preview.getByTestId('section-approval-status')).toContainText(/approved|review/i);
    const reviewerSummary = preview.getByTestId('section-reviewer-summary').locator('span').last();
    const summaryText = (await reviewerSummary.innerText()).trim();
    expect([
      'Gateway contract ready for QA.',
      'Approved gateway contract for fixture review.',
    ]).toContain(summaryText);
  });
});
