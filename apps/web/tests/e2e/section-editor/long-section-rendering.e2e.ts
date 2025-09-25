import { expect, test } from '@playwright/test';

test.describe('Long Section Rendering Performance', () => {
  test('maintains 60 fps and shows fallback indicator on slow loads', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-long-content');

    const section = page.getByTestId('section-long-content');
    await expect(section).toBeVisible();

    const telemetry = page.getByTestId('long-section-telemetry');
    await expect(telemetry).toBeVisible();
    const fpsAttr = await telemetry.getAttribute('data-average-fps');
    expect(fpsAttr).not.toBeNull();
    if (fpsAttr) {
      expect(Number(fpsAttr)).toBeGreaterThanOrEqual(60);
    }

    const fallbackIndicator = page.getByTestId('long-section-fallback');
    await expect(fallbackIndicator).toBeVisible();
    await expect(fallbackIndicator).toContainText('Rendering large section');
    const renderMsAttr = await fallbackIndicator.getAttribute('data-initial-render-ms');
    expect(renderMsAttr).not.toBeNull();
    if (renderMsAttr) {
      expect(Number(renderMsAttr)).toBeGreaterThanOrEqual(500);
    }
  });
});
