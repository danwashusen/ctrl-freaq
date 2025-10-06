import { test, expect } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Document Fixture Missing State', () => {
  test('redirects users to dashboard with helpful messaging when fixtures are absent', async ({
    page,
  }) => {
    await page.goto('/documents/demo-architecture/sections/unknown-section');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const errorView = page.getByTestId('fixture-missing-view');
    await expect(errorView).toBeVisible();
    await expect(errorView).toContainText(/fixture data unavailable/i);

    const supportingCopy = errorView.getByTestId('fixture-missing-supporting-copy');
    await expect(supportingCopy).toBeVisible();
    await expect(supportingCopy).not.toHaveText('');

    const dashboardLink = errorView.getByRole('link', { name: /back to dashboard/i });
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });
});
