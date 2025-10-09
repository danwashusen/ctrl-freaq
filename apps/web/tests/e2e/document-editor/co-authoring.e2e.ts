import { expect, test } from '@playwright/test';
import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Conversational co-authoring assistant', () => {
  test('guidance, proposal, and approval flow with fallback handling', async ({ page }) => {
    await page.goto(
      '/documents/demo-architecture/sections/architecture-overview?fixture=co-authoring'
    );
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    const preview = page.getByTestId('section-preview');
    await preview.waitFor({ state: 'visible', timeout: 5000 });

    const toggleButton = page.getByRole('button', { name: /open co-author/i });
    await expect(toggleButton).toBeEnabled();
    await toggleButton.click();

    const sidebar = page.getByTestId('co-author-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    await expect(sidebar).toContainText('Executive Overview');

    await page.getByRole('button', { name: /explain intent/i }).click();
    await page
      .getByRole('textbox', { name: /ask the assistant/i })
      .fill('Summarize the approved architecture decisions in one paragraph.');

    const analyzeRequestPromise = page.waitForRequest(
      request => request.url().includes('/co-author/analyze') && request.method() === 'POST'
    );
    await page.getByRole('button', { name: /ask assistant/i }).click();
    const analyzeRequest = await analyzeRequestPromise;
    expect(analyzeRequest.postDataJSON()).toMatchObject({
      sessionId: expect.stringMatching(/^session-/),
      intent: 'explain',
      knowledgeItemIds: expect.arrayContaining(['knowledge:wcag']),
    });
    await analyzeRequest.response();

    const progress = page.getByTestId('co-author-session-progress');
    await expect(progress).toContainText(/streaming/i);
    await expect(progress).toContainText(/elapsed/i);

    const proposalRequestPromise = page.waitForRequest(
      request => request.url().includes('/co-author/proposal') && request.method() === 'POST'
    );
    await page.getByRole('button', { name: /generate proposal/i }).click();
    const proposalRequest = await proposalRequestPromise;
    const proposalPayload = proposalRequest.postDataJSON();
    expect(proposalPayload.completedSections?.length).toBeGreaterThan(0);
    expect(proposalPayload.sessionId).toMatch(/^session-/);

    const diffPreview = page.getByTestId('proposal-diff-preview');
    await expect(diffPreview).toBeVisible({ timeout: 4000 });
    await expect(diffPreview).toContainText(/Added/i, { timeout: 4000 });
    await expect(page.getByTestId('prompt-badge')).toContainText('prompt-improve');

    const applyRequestPromise = page.waitForRequest(
      request => request.url().includes('/co-author/apply') && request.method() === 'POST'
    );
    await page.getByRole('button', { name: /approve proposal/i }).click();
    const applyRequest = await applyRequestPromise;
    expect(applyRequest.postDataJSON()).not.toHaveProperty('transcript');
    const applyResponse = await applyRequest.response();
    const applyBody = applyResponse ? await applyResponse.json() : null;
    expect(applyBody).toMatchObject({ status: 'queued', changelog: expect.any(Object) });

    const fallbackBanner = page.getByTestId('co-author-fallback');
    await expect(fallbackBanner).not.toBeVisible();

    // Trigger fallback to verify retry guidance.
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('coauthor:stream-error'));
    });

    await expect(fallbackBanner).toBeVisible();
    await expect(fallbackBanner).toContainText(/try again/i);
  });
});
