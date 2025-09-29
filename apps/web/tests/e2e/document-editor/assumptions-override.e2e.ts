import { test, expect } from '@playwright/test';

test.describe('Assumptions Override Flow', () => {
  test('blocks submission when overrides are unresolved', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-assumptions');

    const conflictDialog = page.getByTestId('conflict-dialog');
    if (await conflictDialog.isVisible()) {
      const closeCandidates = [
        page.getByTestId('dismiss-conflict'),
        page.getByRole('button', { name: /^Cancel$/i }),
        page.getByRole('button', { name: /Rebase and continue/i }),
      ];

      let resolved = false;
      for (const locator of closeCandidates) {
        try {
          await locator.click({ timeout: 1500 });
          resolved = true;
          break;
        } catch (error) {
          void error;
        }
      }

      if (!resolved) {
        throw new Error('Failed to dismiss conflict dialog during assumptions override flow E2E');
      }
      await conflictDialog.waitFor({ state: 'hidden' });
      await page.getByTestId('conflict-dialog-backdrop').waitFor({ state: 'hidden' });
    }

    const overrideBadge = page.getByTestId('assumption-unresolved-count');
    await expect(overrideBadge).toHaveText('2');

    const conflictTrigger = page.getByTestId('assumption-conflict-trigger');
    await expect(conflictTrigger).toBeVisible();
    await conflictTrigger.evaluate(element => {
      (element as HTMLElement).click();
    });

    const conflictModal = page.getByTestId('assumption-conflict-modal');
    await conflictModal.waitFor({ state: 'visible' });
    await expect(conflictModal.getByTestId('assumption-prompts')).toBeVisible();
    await expect(conflictModal.getByTestId('assumption-unresolved-count')).toContainText('2');

    await page.getByRole('button', { name: 'Close assumption conflicts' }).evaluate(element => {
      (element as HTMLElement).click();
    });

    const overrideBanner = page.getByTestId('override-banner');
    await expect(overrideBanner).toContainText('Resolve overrides before submission');

    const editButton = page.getByTestId('enter-edit');
    await expect(editButton).toBeDisabled();
  });
});
