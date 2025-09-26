import { expect, test } from '@playwright/test';

test.describe('Section Editor Formatting Toolbar & Hotkeys', () => {
  test('exposes formatting controls and honors keyboard shortcuts', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

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

    const editor = page.getByTestId('milkdown-editor').getByRole('textbox');
    await editor.click();
    await page.keyboard.type('Formatting shortcuts demo');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.press('ControlOrMeta+i');
    await page.keyboard.press('ControlOrMeta+k');

    await expect(toolbar.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');
    await expect(toolbar.getByTestId('toolbar-italic')).toHaveAttribute('aria-pressed', 'true');

    const linkDialog = page.getByTestId('link-dialog');
    await expect(linkDialog).toBeVisible();
    await expect(linkDialog).toContainText('Add hyperlink');
  });
});
