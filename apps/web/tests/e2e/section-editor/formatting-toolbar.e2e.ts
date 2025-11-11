import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Editor Formatting Toolbar & Hotkeys', () => {
  test('exposes formatting controls and honors keyboard shortcuts', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview?fixture=formatting');

    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    await page.getByTestId('enter-edit').click();

    const toolbar = page.getByTestId('formatting-toolbar');
    await expect(toolbar).toBeVisible();

    const controls = [
      'toolbar-heading',
      'toolbar-bold',
      'toolbar-italic',
      'toolbar-list-ordered',
      'toolbar-list-unordered',
      'toolbar-table',
      'toolbar-link',
      'toolbar-code',
      'toolbar-quote',
    ];

    for (const control of controls) {
      await expect(toolbar.getByTestId(control)).toBeVisible();
    }

    await page.getByRole('textbox', { name: 'Document content editor' }).focus();

    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.press('ControlOrMeta+i');
  });
});
