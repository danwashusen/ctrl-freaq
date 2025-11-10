import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Editor Performance', () => {
  test('activates edit mode within 300 ms', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview?fixture=edit-mode');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const enterEdit = page.getByTestId('enter-edit');
    await expect(enterEdit).toBeVisible();

    const start = Date.now();
    await enterEdit.click();

    const editorPanel = page.getByTestId('section-editor-panel');
    await editorPanel.waitFor({ state: 'visible', timeout: 600 });

    const loadElapsed = Date.now() - start;
    expect(loadElapsed).toBeLessThanOrEqual(600);

    const editorContainer = page.getByTestId('milkdown-editor');
    await expect(editorContainer).toBeVisible();

    await expect(editorPanel.getByTestId('save-draft')).toHaveAttribute('aria-busy', 'false');
  });
});
