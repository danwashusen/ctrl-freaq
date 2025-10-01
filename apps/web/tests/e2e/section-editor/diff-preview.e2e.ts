import { expect, test } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Section Editor Diff Preview & Submit', () => {
  test('renders diff preview before submitting for review', async ({ page }) => {
    let diffRequested = false;

    await page.route('**/__fixtures/api/sections/sec-overview/drafts', async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          draftId: 'draft-sec-overview-004',
          sectionId: 'sec-overview',
          draftVersion: 4,
          conflictState: 'clean',
          formattingAnnotations: [],
          savedAt: '2025-01-15T15:29:15.000Z',
          savedBy: 'Morgan Lee',
          summaryNote: 'Reviewed for architecture alignment.',
        }),
      });
    });

    await page.route('**/__fixtures/api/sections/sec-overview/diff', async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      diffRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'unified',
          segments: [
            {
              type: 'context',
              content: '## CTRL FreaQ Architecture Overview',
              startLine: 1,
            },
            {
              type: 'removed',
              content: '- Documented APIs for every integration point',
              startLine: 4,
            },
            {
              type: 'added',
              content: '- Updated introduction copy for architecture overview.',
              startLine: 4,
            },
            {
              type: 'added',
              content: '- Documented APIs for every integration point',
              startLine: 5,
            },
          ],
          metadata: {
            approvedVersion: 3,
            draftVersion: 4,
            generatedAt: '2025-01-15T15:29:25.000Z',
          },
        }),
      });
    });

    await page.goto('/documents/demo-architecture/sections/sec-overview');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    await page.getByTestId('enter-edit').click();
    const diffViewer = page.getByTestId('diff-viewer');

    await page.evaluate(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="milkdown-editor"] textarea'
      );
      if (textarea) {
        textarea.value = `## CTRL FreaQ Architecture Overview\n\nThe CTRL FreaQ platform unifies research, planning, and execution with a library-first mindset.\n\n- Updated introduction copy for architecture overview.\n- Documented APIs for every integration point\n- Deterministic fixtures ensure QA parity\n- Playwright exercises deep-link navigation and assumption workflows`;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await expect(page.getByTestId('open-diff')).toBeEnabled();
    await page.getByTestId('save-draft').click();

    await page.getByTestId('open-diff').click();
    await expect.poll(() => diffRequested).toBeTruthy();
    await diffViewer.waitFor({ state: 'visible' });

    await expect(diffViewer.getByTestId('diff-context')).toContainText(
      '## CTRL FreaQ Architecture Overview'
    );
    await expect(diffViewer.getByTestId('diff-removed')).toContainText(
      '- Documented APIs for every integration point'
    );
    const addedSegments = diffViewer.getByTestId('diff-added');
    await expect(addedSegments.first()).toContainText(
      '- Updated introduction copy for architecture overview.'
    );
    await expect(addedSegments.nth(1)).toContainText(
      '- Documented APIs for every integration point'
    );

    await page.getByTestId('submit-review').click();

    // Submission completes inline now; check the rendered status + summary.
    await expect(page.getByTestId('section-status-chip')).toHaveText(/review pending/i);
    await expect(page.getByTestId('latest-review-summary')).toContainText(
      'Reviewed for architecture alignment.'
    );
  });
});
