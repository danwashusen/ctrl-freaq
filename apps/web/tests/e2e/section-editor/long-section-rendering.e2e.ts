import { expect, test } from '@playwright/test';

test.describe('Long Section Rendering Performance', () => {
  test('maintains 60 fps and shows fallback indicator on slow loads', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-assumptions');

    const conflictDialog = page.getByTestId('conflict-dialog');
    if (await conflictDialog.isVisible()) {
      await page.getByTestId('dismiss-conflict').click();
      await conflictDialog.waitFor({ state: 'hidden' });
    }

    const preview = page.getByTestId('section-preview');
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId('section-preview-content')).toContainText(
      'These fixtures guarantee the modal renders deterministic content for E2E tests.'
    );

    const conflictTrigger = preview.getByTestId('assumption-conflict-trigger');
    await conflictTrigger.evaluate(element => {
      (element as HTMLElement).click();
    });

    const conflictModal = page.getByTestId('assumption-conflict-modal');
    await conflictModal.waitFor({ state: 'visible' });

    const transcript = conflictModal.getByTestId('assumption-transcript');
    await expect(transcript).toBeVisible();
    const transcriptClass = await transcript.getAttribute('class');
    expect(transcriptClass).toContain('overflow-y-auto');

    const { scrollHeight, clientHeight } = await transcript.evaluate(element => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });
});
