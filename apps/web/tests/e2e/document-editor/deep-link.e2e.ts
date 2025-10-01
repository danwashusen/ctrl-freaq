import { test, expect } from '@playwright/test';

import { dismissDraftRecoveryGate } from '../support/draft-recovery';

test.describe('Document Editor Deep Link Experience', () => {
  test('renders document fixtures when navigating directly to a section', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api');
    await page.waitForLoadState('networkidle');
    await dismissDraftRecoveryGate(page);

    // Table of contents should render with active section selection.
    const tocPanel = page.getByTestId('toc-panel');
    await expect(tocPanel).toBeVisible();

    const activeItem = page.locator('[data-testid="toc-item"][data-section-id="sec-api"]');
    await expect(activeItem).toHaveAttribute('data-active', 'true');

    // Section preview should be visible with content for the requested section.
    const sectionPreview = page.getByTestId('section-preview');
    await expect(sectionPreview).toBeVisible();

    const previewContent = sectionPreview.getByTestId('section-preview-content');
    await expect(previewContent).not.toHaveText('');

    // Edit affordance should remain available in fixture mode.
    const editButton = page.getByTestId('enter-edit');
    await expect(editButton).toBeVisible();
    await expect(editButton).toBeEnabled();
  });
});
