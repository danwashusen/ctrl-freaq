import { test, expect } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Editor Conflict Handshake', () => {
  test('prompts user to rebase when newer approved content exists', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-assumptions?fixture=conflict');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const conflictDialog = page.getByTestId('conflict-dialog');
    await expect(conflictDialog).toBeVisible();

    await expect(conflictDialog).toContainText('Rebase required before continuing');
    await expect(conflictDialog).toContainText(
      'Another teammate published a newer approved version.'
    );
    await expect(conflictDialog).toContainText('Saving the draft detected a new approval v2 → v3.');
    await expect(conflictDialog).toContainText('Waiting for compliance sign-off.');
    await expect(conflictDialog.getByTestId('conflict-step-refresh')).toBeVisible();
    await expect(conflictDialog.getByTestId('conflict-step-open-diff')).toBeVisible();
    await expect(conflictDialog.getByTestId('conflict-step-reapply')).toBeVisible();
  });
});
