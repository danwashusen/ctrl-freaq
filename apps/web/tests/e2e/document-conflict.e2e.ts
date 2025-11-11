import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate, selectSimpleAuthUser } from './support/draft-recovery';

const SECTION_ID = 'sec-api';

const conflictPayload = {
  status: 'rebase_required',
  latestApprovedVersion: 7,
  conflictReason: 'A teammate published a new approved version while you were editing.',
  rebasedDraft: {
    draftVersion: 8,
    contentMarkdown:
      '## Assumption Governance Playbook\n\n- Adopt refreshed compliance controls before submitting changes.\n- Merge teammate updates, then reapply your draft.\n- Preserve your local notes before leaving the editor.',
    formattingAnnotations: [],
  },
  events: [
    {
      detectedAt: '2025-11-05T09:31:12.000Z',
      detectedDuring: 'save',
      previousApprovedVersion: 6,
      latestApprovedVersion: 7,
      resolvedBy: null,
      resolutionNote: 'Waiting for author to reapply draft after compliance update.',
    },
  ],
  serverSnapshot: {
    version: 7,
    content:
      '## Assumption Governance Playbook\n\nThe compliance team landed new baseline copy moments ago. Refresh the section to pull their updates before retrying your save.',
    capturedAt: '2025-11-05T09:30:45.000Z',
  },
};

const cleanSnapshot = {
  status: 'clean',
  latestApprovedVersion: 8,
  rebasedDraft: {
    draftVersion: 8,
    contentMarkdown:
      '## Assumption Governance Playbook\n\n- Compliance copy refreshed from approved version 7.\n- Your saved notes are ready to reapply once you finish the steps.',
    formattingAnnotations: [],
  },
  conflictReason: null,
  events: conflictPayload.events,
  serverSnapshot: {
    version: 8,
    content:
      '## Assumption Governance Playbook\n\nApproved baseline pulled from the server. Continue reviewing the diff before reapplying your draft.',
    capturedAt: '2025-11-05T09:32:18.000Z',
  },
};

const diffResponse = {
  mode: 'unified',
  segments: [
    {
      type: 'context',
      content: '## Assumption Governance Playbook',
      startLine: 1,
      endLine: 1,
    },
    {
      type: 'removed',
      content: '- Track unresolved assumption count in the conflict dialog badge.',
      startLine: 3,
      endLine: 3,
    },
    {
      type: 'added',
      content: '- Adopt refreshed compliance controls before submitting changes.',
      startLine: 3,
      endLine: 3,
    },
    {
      type: 'added',
      content: '- Merge teammate updates, then reapply your draft.',
      startLine: 4,
      endLine: 4,
    },
  ],
  metadata: {
    approvedVersion: 7,
    draftVersion: 8,
    generatedAt: '2025-11-05T09:32:40.000Z',
  },
};

test.describe('Document manual save conflicts', () => {
  test('guides the author through refresh, diff review, and draft reapply steps', async ({
    page,
  }) => {
    let conflictDelivered = false;

    await page.route(`**/sections/${SECTION_ID}/drafts`, async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      if (!conflictDelivered) {
        conflictDelivered = true;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify(conflictPayload),
        });
        return;
      }

      await route.fallback();
    });

    await page.route(`**/sections/${SECTION_ID}/conflicts/logs`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: conflictPayload.events }),
      });
    });

    await page.route(`**/sections/${SECTION_ID}/conflicts/check`, async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(cleanSnapshot),
      });
    });

    await page.route(`**/sections/${SECTION_ID}/diff`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(diffResponse),
      });
    });

    await page.route(`**/sections/${SECTION_ID}/assumptions/session`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'assumption-session-conflict',
          policy: 'balanced',
          unresolvedCount: 0,
          promptsRemaining: 0,
          overridesOpen: 0,
          prompts: [],
          transcript: [],
          proposals: [],
        }),
      });
    });

    await page.goto(`/documents/demo-architecture/sections/${SECTION_ID}`);
    await dismissDraftRecoveryGate(page);
    await selectSimpleAuthUser(page);

    const initialConflictDialog = page.getByTestId('conflict-dialog');
    if (await initialConflictDialog.isVisible()) {
      await page.getByTestId('dismiss-conflict').click();
      await initialConflictDialog.waitFor({ state: 'hidden' });
      await page.getByTestId('conflict-dialog-backdrop').waitFor({ state: 'hidden' });
    }

    const sectionCard = page.getByTestId('section-preview').first();
    await expect(sectionCard).toBeVisible();

    const enterEditButton = sectionCard.getByTestId('enter-edit');
    await expect(enterEditButton).toBeEnabled();
    await enterEditButton.click();
    const editor = page.getByTestId('draft-markdown-editor');
    await expect(editor).toBeVisible();

    await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="milkdown-editor"] textarea'
      );
      if (!textarea) {
        throw new Error('Milkdown markdown textarea not found');
      }
      textarea.value =
        '## Assumption Governance Playbook\n\nDraft updates authored in the failing test to trigger conflict resolution steps.';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const manualSave = page.getByTestId('save-draft');
    await expect(manualSave).toBeEnabled();

    const conflictRequest = page.waitForRequest(
      request =>
        request.url().includes(`/sections/${SECTION_ID}/drafts`) && request.method() === 'POST'
    );
    await manualSave.click();
    await conflictRequest;

    const dialog = page.getByTestId('conflict-dialog');
    await dialog.waitFor({ state: 'visible' });

    await expect(dialog.getByTestId('conflict-resolution-note')).toContainText(
      'Your draft is still cached. Complete the steps below to reapply it.'
    );

    const refreshStep = dialog.locator(
      '[data-testid="conflict-resolution-step"][data-step="refresh"]'
    );
    await expect(refreshStep).toContainText('1. Refresh section');

    const refreshButton = dialog.getByTestId('conflict-step-refresh');
    const checkRequest = page.waitForRequest(
      request =>
        request.url().includes(`/sections/${SECTION_ID}/conflicts/check`) &&
        request.method() === 'POST'
    );
    await refreshButton.click();
    await checkRequest;
    await expect(refreshStep).toHaveAttribute('data-status', 'done');
    await expect(refreshStep).toContainText('Latest approved content loaded');

    const diffStep = dialog.locator('[data-testid="conflict-resolution-step"][data-step="diff"]');
    await expect(diffStep).toContainText('2. Review incoming diff');

    await dialog.getByTestId('conflict-step-open-diff').click();
    await expect(page.getByTestId('diff-viewer')).toBeVisible();
    await expect(diffStep).toHaveAttribute('data-status', 'done');

    const reapplyStep = dialog.locator(
      '[data-testid="conflict-resolution-step"][data-step="reapply"]'
    );
    await expect(reapplyStep).toContainText('3. Reapply your draft');

    await dialog.getByTestId('conflict-step-reapply').click();
    await dialog.waitFor({ state: 'hidden' });

    const manualSavePanel = page.getByTestId('manual-save-panel');
    await expect(manualSavePanel).toContainText('Draft rebased');
    await expect(manualSavePanel).toContainText('Review the merged draft before saving again.');
  });
});
