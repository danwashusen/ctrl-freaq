import { expect, test } from '@playwright/test';

test.describe('Section Editor Diff Preview & Submit', () => {
  test('renders diff preview before submitting for review', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

    await page.getByTestId('enter-edit').click();
    const editor = page.getByTestId('milkdown-editor').getByRole('textbox');
    await editor.click();
    await editor.type('Updated introduction copy for architecture overview.');

    await page.getByTestId('save-draft').click();

    await page.getByTestId('open-diff').click();
    const diffViewer = page.getByTestId('diff-viewer');
    await expect(diffViewer).toBeVisible();
    await expect(diffViewer.getByTestId('diff-added')).toContainText('Updated introduction');
    await expect(diffViewer.getByTestId('diff-removed')).toBeVisible();

    await page.getByTestId('submit-review').click();
    const reviewDialog = page.getByTestId('review-submit-dialog');
    await expect(reviewDialog).toBeVisible();

    const summaryInput = reviewDialog.getByTestId('review-summary-input');
    await summaryInput.fill('Align introduction with current architecture decisions.');
    await reviewDialog.getByTestId('confirm-submit').click();

    await expect(page.getByTestId('section-status-chip')).toHaveText(/review pending/i);
    await expect(page.getByTestId('latest-review-summary')).toContainText('Align introduction');
  });
});
