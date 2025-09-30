import { expect, test } from '@playwright/test';

test.describe('Section draft persistence', () => {
  test('re-hydrates drafts after reload and offers revert-to-published guardrails', async ({
    page,
  }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');

    const sectionPreview = page.getByTestId('section-preview').first();
    await expect(sectionPreview).toBeVisible();

    await sectionPreview.getByTestId('enter-edit').click();
    const editor = page.getByTestId('draft-markdown-editor');
    await expect(editor).toBeVisible();

    await editor.fill('Rehydration should restore this draft after reload.');

    const statusBadge = sectionPreview.getByTestId('section-draft-status');
    await expect(statusBadge).toHaveText(/draft pending/i);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const sectionPreviewAfterReload = page.getByTestId('section-preview').first();
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toHaveText(
      /draft pending/i
    );
    await sectionPreviewAfterReload.getByTestId('enter-edit').click();
    const editorAfterReload = page.getByTestId('draft-markdown-editor');
    await expect(editorAfterReload).toHaveValue(/Gateway Responsibilities/);

    await sectionPreviewAfterReload.getByTestId('revert-to-published').click();
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toHaveText(
      /synced/i
    );
    await expect(page.getByRole('status')).toHaveText(/Draft reverted to published content/);
  });

  test('surfaces browser quota pruning guidance and clears drafts on logout', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');

    const sectionPreview = page.getByTestId('section-preview').first();
    await sectionPreview.getByTestId('enter-edit').click();

    // Simulate quota exhaustion hook that the UI listens for during implementation.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('draft-storage:quota-exceeded'));
    });

    const pruningBanner = page.getByTestId('draft-pruned-banner');
    await expect(pruningBanner).toBeVisible();
    await expect(pruningBanner).toContainText(/browser storage limit/i);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('draft-storage:quota-cleared'));
    });

    await expect(pruningBanner).not.toBeVisible();
    await expect(sectionPreview.getByTestId('section-draft-status')).toHaveText(/draft pending/i);

    await page.evaluate(async () => {
      const bridge = (
        window as unknown as {
          __CTRL_FREAQ_DRAFT_LOGOUT__?: {
            trigger(authorId: string): Promise<void>;
          };
        }
      ).__CTRL_FREAQ_DRAFT_LOGOUT__;

      if (!bridge) {
        throw new Error('Draft logout bridge unavailable');
      }

      await bridge.trigger('user-local-author');
    });

    await expect(sectionPreview.getByTestId('section-draft-status')).toHaveText(/synced/i);
  });
});
