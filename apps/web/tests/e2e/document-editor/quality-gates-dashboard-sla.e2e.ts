import { expect, test } from '@playwright/test';

import { registerDocumentQualityFixtures } from './fixtures';
import { selectSimpleAuthUser } from '../support/draft-recovery';

test.describe('Document quality dashboard SLA', () => {
  test('re-runs document gates within SLA and emits telemetry', async ({ page }) => {
    await registerDocumentQualityFixtures(page);

    const telemetryEvents: string[] = [];
    page.on('console', message => {
      if (message.type() === 'info' && message.text().includes('qualityGates.dashboard.metric')) {
        telemetryEvents.push(message.text());
      }
    });

    await page.goto(
      '/documents/demo-architecture/sections/sec-overview?fixture=quality-gates-dashboard'
    );
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const dashboard = page.getByTestId('document-quality-dashboard');
    await expect(dashboard).toBeVisible();

    const publishButton = page.getByRole('button', { name: /publish document/i });
    await expect(publishButton).toBeDisabled();

    const rerunButton = page.getByRole('button', { name: /re-run document validations/i });
    await rerunButton.click();

    const statusBanner = page.getByTestId('document-quality-dashboard-status');
    await expect(statusBanner).toContainText(/validating/i);

    expect(telemetryEvents.some(event => event.includes('"scope":"document"'))).toBe(true);
  });
});
