import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate, selectSimpleAuthUser } from '../support/draft-recovery';

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
    const statusText = (await statusBadge.innerText()).toLowerCase();
    expect(statusText).toMatch(/last updated|revert to published/);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const recoveryGate = page.getByTestId('draft-recovery-gate');
    const recoveryGateCount = await recoveryGate.count();

    if (recoveryGateCount > 0) {
      await expect(recoveryGate).toBeVisible();
      await expect(recoveryGate).toContainText(/review recovered drafts/i);
      await page.getByRole('button', { name: /apply recovered drafts/i }).click();
      await expect(recoveryGate).not.toBeVisible();
    }

    await dismissDraftRecoveryGate(page);

    const sectionPreviewAfterReload = page.getByTestId('section-preview').first();
    if (recoveryGateCount === 0) {
      await expect(sectionPreviewAfterReload.getByTestId('section-draft-status')).toContainText(
        /(?:review recovered draft|draft pending|synced)/i
      );
    }
    const statusAfterReload = sectionPreviewAfterReload.getByTestId('section-draft-status');
    await expect(statusAfterReload).toContainText(
      /(?:review recovered draft|draft pending|synced)/i
    );
    const statusAfterReloadText = (await statusAfterReload.innerText()).toLowerCase();
    expect(statusAfterReloadText).toMatch(/last updated|revert to published/);
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
    await expect(page.getByText(/draft reverted to published content/i)).toBeVisible();
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
    const quotaStatus = sectionPreview.getByTestId('section-draft-status');
    await expect(quotaStatus).toContainText(/(?:review recovered draft|draft pending|synced)/i);
    const quotaStatusText = (await quotaStatus.innerText()).toLowerCase();
    expect(quotaStatusText).toMatch(/last updated|revert to published/);

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
    test.setTimeout(15000);

    await page.route('**/__fixtures/api/sections/sec-api/drafts', async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          draftId: 'draft-sec-api-004',
          sectionId: 'sec-api',
          draftVersion: 4,
          draftBaseVersion: 3,
          conflictState: 'clean',
          formattingAnnotations: [],
          summaryNote: 'Gateway contract ready for QA.',
          savedAt: new Date().toISOString(),
          savedBy: 'Local Author',
        }),
      });
    });

    await page.route('**/__fixtures/api/projects/**/documents/**/draft-bundle', async route => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback();
        return;
      }

      const url = new URL(route.request().url());
      const segments = url.pathname.split('/');
      const documentId = segments[segments.length - 2] ?? 'demo-architecture';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId,
          appliedSections: ['sec-api'],
        }),
      });
    });

    await page.goto('/documents/demo-architecture/sections/sec-api?fixture=draft-persistence');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const sectionPreview = page.getByTestId('section-preview').first();
    await dismissDraftRecoveryGate(page);
    await sectionPreview.getByTestId('enter-edit').click();
    const editor = page.getByTestId('draft-markdown-editor');
    await expect(editor).toBeVisible();

    const updatedContent =
      '## Simple Auth Draft\n\nBundle this change into a single save request. Updated via Playwright.';

    await page.evaluate((content: string) => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="milkdown-editor"] textarea'
      );
      if (!textarea) {
        throw new Error('Milkdown textarea not found');
      }
      textarea.value = content;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, updatedContent);

    const manualSaveButton = page.getByTestId('save-draft');
    await expect(manualSaveButton).toBeEnabled();

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
