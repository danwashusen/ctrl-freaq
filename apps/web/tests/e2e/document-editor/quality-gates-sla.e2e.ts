import { expect, test } from '@playwright/test';

import { registerDocumentQualityFixtures } from './fixtures';

test.describe('Quality gate SLA telemetry', () => {
  test('updates status within SLA and emits telemetry duration metric', async ({ page }) => {
    await registerDocumentQualityFixtures(page);

    const telemetryEvents: string[] = [];
    page.on('console', message => {
      if (message.type() === 'info' && message.text().includes('qualityGates.validation.metric')) {
        telemetryEvents.push(message.text());
      }
    });

    await page.goto('/documents/demo-architecture/sections/sec-overview?fixture=quality-gates-sla');
    await page.waitForLoadState('networkidle');

    const statusChip = page.getByTestId('section-quality-status-chip');
    await expect(statusChip).toBeVisible();
    await expect(statusChip).toHaveText(/validating section/i);

    const rerunButton = page.getByRole('button', { name: /re-run validation/i });
    await rerunButton.click();

    await expect(statusChip).toContainText(/status: (?:warning|blocker|pass)/i, {
      timeout: 2000,
    });

    expect(telemetryEvents.some(event => event.includes('"durationMs"'))).toBe(true);
  });
});
