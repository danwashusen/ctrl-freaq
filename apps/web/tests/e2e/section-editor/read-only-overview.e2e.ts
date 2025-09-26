import { test, expect } from '@playwright/test';

test.describe('Section Editor Read-Only Overview', () => {
  test('surfaces approval metadata and edit affordance', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

    const preview = page.getByTestId('section-preview');
    await expect(preview).toBeVisible();

    await expect(preview.getByTestId('section-approval-status')).toHaveText(
      /(approved|draft|review|ready)/i
    );
    await expect(preview.getByTestId('section-reviewer-summary')).toBeVisible();
    await expect(preview.getByTestId('section-reviewer-summary')).not.toHaveText('');

    await expect(preview.getByTestId('section-approved-timestamp')).toBeVisible();
    const timestampText = await preview.getByTestId('section-approved-timestamp').textContent();
    if (!timestampText) {
      throw new Error('Expected approval timestamp text content');
    }
    expect(timestampText).toMatch(/\d{4}-\d{2}-\d{2}T/);

    const editCta = preview.getByTestId('enter-edit');
    await expect(editCta).toBeVisible();
    await expect(editCta).toHaveAttribute('role', 'button');
  });
});
