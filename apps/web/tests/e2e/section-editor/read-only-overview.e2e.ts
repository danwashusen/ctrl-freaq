import { test, expect } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Editor Read-Only Overview', () => {
  test('surfaces approval metadata and edit affordance', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview?fixture=read-only');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const preview = page.getByTestId('section-preview');
    await preview.waitFor({ state: 'attached', timeout: 5000 });
    await expect(preview).toBeVisible();

    await expect(preview.getByTestId('section-approval-status')).toHaveText(
      /(approved|draft|review|ready)/i
    );
    const reviewerSummary = preview.getByTestId('section-reviewer-summary').locator('span').last();
    await expect(reviewerSummary).toBeVisible();
    const summaryText = (await reviewerSummary.innerText()).trim();
    expect(summaryText.length).toBeGreaterThan(0);
    expect(['Reviewed for architecture alignment.', 'Reviewer summary unavailable']).toContain(
      summaryText
    );

    const approvedTimestamp = preview.getByTestId('section-approved-timestamp');
    await expect(approvedTimestamp).toBeVisible();
    const timestampText = await approvedTimestamp.innerText();
    const timestamp = new Date(timestampText);
    expect(timestamp.toISOString()).toBe(timestampText);

    const editCta = preview.getByTestId('enter-edit');
    await expect(editCta).toBeVisible();
    await expect(editCta).toHaveRole('button');
  });
});
