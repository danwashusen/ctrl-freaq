import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section draft persistence', () => {
  test('re-hydrates drafts after reload and offers revert-to-published guardrails', async ({
    page,
  }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const sectionPreview = page.getByTestId('section-preview').first();
    await expect(sectionPreview).toBeVisible();

    await sectionPreview.getByTestId('enter-edit').click();
    const editor = page.getByTestId('draft-markdown-editor');
    await expect(editor).toBeVisible();

    await editor.fill('Rehydration should restore this draft after reload.');

    const statusBadge = sectionPreview.getByTestId('section-draft-status');
    await expect(statusBadge).toContainText(/(?:review recovered draft|draft pending|synced)/i);
    await expect(statusBadge).toContainText(/last updated/i);

    await page.reload();
    await page.waitForLoadState('networkidle');

    const recoveryGate = page.getByTestId('draft-recovery-gate');
    const recoveryGateCount = await recoveryGate.count();

    if (recoveryGateCount > 0) {
      await expect(recoveryGate).toBeVisible();
      await expect(recoveryGate).toContainText(/review recovered drafts/i);
      await page.getByRole('button', { name: /apply recovered drafts/i }).click();
    }

    const sectionPreviewAfterReload = page.getByTestId('section-preview').first();
    if (recoveryGateCount === 0) {
      await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toContainText(
        /review recovered draft/i
      );
    }
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toContainText(
      /(?:review recovered draft|draft pending|synced)/i
    );
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toContainText(
      /last updated/i
    );
    await sectionPreviewAfterReload.getByTestId('enter-edit').click();
    const editorAfterReload = page.getByTestId('draft-markdown-editor');
    await expect(editorAfterReload).toHaveValue(/Gateway Responsibilities/);

    await sectionPreviewAfterReload.getByTestId('revert-to-published').click();
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toHaveText(
      /synced/i
    );
    await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).not.toContainText(
      /last updated/i
    );
    await expect(page.getByRole('status')).toHaveText(/Draft reverted to published content/);
  });

  test('surfaces browser quota pruning guidance and clears drafts on logout', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const sectionPreview = page.getByTestId('section-preview').first();
    await sectionPreview.getByTestId('enter-edit').click();
    const editor = page.getByTestId('draft-markdown-editor');
    await expect(editor).toBeVisible();
    await editor.fill('Trigger draft persistence before quota warning.');

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
    await expect(sectionPreview.getByTestId('section-draft-status')).toContainText(
      /(?:review recovered draft|draft pending|synced)/i
    );
    await expect(sectionPreview.getByTestId('section-draft-status')).toContainText(/last updated/i);

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
    await expect(sectionPreview.getByTestId('section-draft-status')).not.toContainText(
      /last updated/i
    );
  });

  test('logs retention compliance warnings when policy requires escalation', async ({ page }) => {
    const complianceRequestPromise = page.waitForRequest(request => {
      return request.url().includes('/draft-compliance') && request.method() === 'POST';
    });

    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const complianceRequest = await complianceRequestPromise;
    const payload = complianceRequest.postDataJSON();
    expect(payload).toMatchObject({
      policyId: expect.stringContaining('retention'),
      authorId: expect.any(String),
    });
  });

  test('saving drafts issues a bundled PATCH request', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const sectionPreview = page.getByTestId('section-preview').first();
    await sectionPreview.getByTestId('enter-edit').click();

    const editor = page.getByTestId('draft-markdown-editor');
    await editor.fill('Bundle this change into a single save request.');

    const manualSaveButton = page.getByTestId('save-draft');

    const [bundleRequest] = await Promise.all([
      page.waitForRequest(
        request => request.url().includes('/draft-bundle') && request.method() === 'PATCH'
      ),
      manualSaveButton.click(),
    ]);

    const payload = bundleRequest.postDataJSON();
    expect(Array.isArray(payload?.sections)).toBe(true);
    expect(payload?.sections?.length ?? 0).toBeGreaterThan(0);
    expect(payload?.sections?.[0]?.sectionPath).toBeDefined();
  });
});
