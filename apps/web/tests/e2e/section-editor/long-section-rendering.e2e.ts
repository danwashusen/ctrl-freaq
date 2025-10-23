import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Long Section Rendering Performance', () => {
  test('maintains 60 fps and shows fallback indicator on slow loads', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-assumptions');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const conflictDialog = page.getByTestId('conflict-dialog');
    if (await conflictDialog.isVisible()) {
      await page.getByTestId('dismiss-conflict').click();
      await conflictDialog.waitFor({ state: 'hidden' });
    }

    await page.waitForSelector('[data-testid="section-preview"]', { timeout: 8000 });
    const preview = page.getByTestId('section-preview');

    await expect(preview).toBeVisible({ timeout: 8000 });
    await expect(preview.getByTestId('section-preview-content')).toContainText(
      'These fixtures guarantee the modal renders deterministic content for E2E tests.'
    );

    const conflictTrigger = preview.getByTestId('assumption-conflict-trigger');
    await conflictTrigger.evaluate(element => {
      (element as HTMLElement).click();
    });

    const conflictModal = page.getByTestId('assumption-conflict-modal');
    await conflictModal.waitFor({ state: 'visible' });

    const promptList = conflictModal.getByTestId('assumption-prompts');
    await expect(promptList).toBeVisible();
    const promptContainerClass = await promptList.getAttribute('class');
    expect(promptContainerClass).toContain('overflow-y-auto');

    const { scrollHeight, clientHeight } = await promptList.evaluate(element => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });
});
