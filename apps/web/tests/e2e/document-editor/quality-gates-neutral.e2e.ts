import { expect, test } from '@playwright/test';

import { registerDocumentQualityFixtures } from './fixtures';

test.describe('Quality gate neutral state', () => {
  test('surfaces neutral badge, tooltip copy, and CTA', async ({ page }) => {
    await registerDocumentQualityFixtures(page);

    await page.goto(
      '/documents/demo-architecture/sections/sec-deployment?fixture=quality-gates-neutral'
    );
    await page.waitForLoadState('networkidle');

    const status = page.getByTestId('section-quality-status');
    await expect(status).toBeVisible();

    const chip = page.getByTestId('section-quality-status-chip');
    await expect(chip).toContainText('Validation not run yet');

    const helper = page.getByTestId('quality-status-helper');
    await expect(helper).toContainText('Run validation before submission');

    const runButton = page.getByRole('button', { name: /run validation/i });
    await expect(runButton).toBeVisible();
  });
});
