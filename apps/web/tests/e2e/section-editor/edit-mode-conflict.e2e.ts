import { test, expect } from '@playwright/test';

test.describe('Section Editor Conflict Handshake', () => {
  test('prompts user to rebase when newer approved content exists', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

    await expect(page.getByTestId('section-preview')).toBeVisible();

    await page.getByTestId('enter-edit').click();

    const conflictDialog = page.getByTestId('conflict-dialog');
    await expect(conflictDialog).toBeVisible();
    await expect(conflictDialog).toContainText('Rebase onto latest approved');
    await expect(conflictDialog.getByTestId('conflict-approved-version')).toHaveText(
      /latest version: \d+/
    );

    await conflictDialog.getByTestId('confirm-rebase').click();

    const editor = page.getByTestId('milkdown-editor');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Rebased draft ready for review');

    const banner = page.getByTestId('conflict-resolution-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Rebased onto approved version');
  });
});
