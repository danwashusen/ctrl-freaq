import { expect, test } from '@playwright/test';

test.describe('Section Editor Performance', () => {
  test('activates edit mode within 300 ms', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

    const enterEdit = page.getByTestId('enter-edit');
    await expect(enterEdit).toBeVisible();

    const start = Date.now();
    await enterEdit.click();

    const editor = page.getByTestId('milkdown-editor');
    await editor.waitFor({ state: 'visible', timeout: 300 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThanOrEqual(300);

    const telemetry = page.getByTestId('editor-performance-telemetry');
    await expect(telemetry).toBeVisible();
    const activationMs = await telemetry.getAttribute('data-activation-ms');
    expect(activationMs).not.toBeNull();
    if (activationMs) {
      expect(Number(activationMs)).toBeLessThanOrEqual(300);
    }
  });
});
