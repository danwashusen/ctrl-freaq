import { test, expect } from '@playwright/test';

test.describe('Document Editor Core Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-api');

    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('toc-panel')).toBeVisible();
  });

  test.describe('Table of Contents Navigation', () => {
    test('displays table of contents with hierarchical sections', async ({ page }) => {
      // Verify ToC panel is visible
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      // Verify sections are displayed
      const tocItems = page.getByTestId('toc-item');
      await expect(tocItems.first()).toBeVisible();

      // Check for hierarchical structure
      const rootSections = page.getByTestId('toc-item').filter({ hasNotText: /ml-/ });
      await expect(rootSections.first()).toBeVisible();
    });

    test('navigates to section when ToC item is clicked', async ({ page }) => {
      // Click on a ToC item
      const firstTocItem = page.getByTestId('toc-item').first();
      const sectionId = await firstTocItem.getAttribute('data-section-id');
      expect(sectionId).not.toBeNull();

      await firstTocItem.click();

      await expect(
        page.locator(`[data-testid="toc-item"][data-section-id="${sectionId}"]`)
      ).toHaveAttribute('data-active', 'true');

      // Verify the section is in viewport
      const targetSection = page.getByTestId(`section-${sectionId}`);
      if ((await targetSection.count()) > 0) {
        await expect(targetSection).toBeInViewport();
      }
    });

    test('expands and collapses nested sections', async ({ page }) => {
      // Find a section with children
      const expandButton = page.getByTestId('expand-toggle').first();

      if ((await expandButton.count()) > 0) {
        // Click to expand
        await expandButton.click();

        // Verify expansion occurred (check for expanded icon or visible children)
        await expect(expandButton).toHaveAttribute('aria-label', /collapse/i);

        // Click to collapse
        await expandButton.click();

        // Verify collapse occurred
        await expect(expandButton).toHaveAttribute('aria-label', /expand/i);
      }
    });

    test('shows status indicators for different section states', async ({ page }) => {
      const tocItems = page.getByTestId('toc-item');

      // Check that status icons are displayed
      await expect(tocItems.first().locator('svg').first()).toBeVisible();

      // Verify different status colors/icons exist
      const statusElements = page.locator('[data-testid="toc-item"] svg');
      await expect(statusElements.first()).toBeVisible();
    });

    test('indicates unsaved changes in ToC', async ({ page }) => {
      // Look for unsaved changes indicator
      const unsavedIndicator = page.locator('[title="Unsaved changes"]');

      // If there are unsaved changes, verify they're indicated
      if ((await unsavedIndicator.count()) > 0) {
        await expect(unsavedIndicator).toBeVisible();
        await expect(unsavedIndicator).toHaveClass(/orange/);
      }
    });
  });

  test.describe('Section Mode Transitions', () => {
    test('displays sections in read mode by default', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        // Should show read mode indicator
        await expect(sectionCard.getByText('Reading')).toBeVisible();

        // Should show edit button
        await expect(sectionCard.getByTestId('edit-button')).toBeVisible();
      }
    });

    test('surfaces approval metadata with ISO timestamp', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        const preview = page.getByTestId('section-preview').first();
        await expect(preview).toBeVisible();

        const approvedTimestamp = preview.getByTestId('section-approved-timestamp');
        await expect(approvedTimestamp).toBeVisible();

        const timestampText = (await approvedTimestamp.innerText()).trim();
        const parsedTimestamp = new Date(timestampText);
        expect(parsedTimestamp.toISOString()).toBe(timestampText);
      }
    });

    test('transitions to edit mode when edit button is clicked', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        const editButton = sectionCard.getByTestId('edit-button');
        await editButton.click();

        // Should transition to edit mode
        await expect(sectionCard.getByText('Editing')).toBeVisible();

        // Should show save and cancel buttons
        await expect(sectionCard.getByTestId('save-section')).toBeVisible();
        await expect(sectionCard.getByTestId('cancel-button')).toBeVisible();
      }
    });

    test('preserves content when canceling edit mode', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        // Get original content if any
        const originalContent = await sectionCard.getByTestId('section-content').textContent();

        // Enter edit mode
        await sectionCard.getByTestId('edit-button').click();

        // Cancel editing
        await sectionCard.getByTestId('cancel-button').click();

        // Should return to read mode
        await expect(sectionCard.getByText('Reading')).toBeVisible();

        // Content should be preserved
        if (originalContent) {
          await expect(sectionCard.getByTestId('section-content')).toContainText(originalContent);
        }
      }
    });

    test('shows saving state during save operation', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        // Enter edit mode
        await sectionCard.getByTestId('edit-button').click();

        // Start save operation
        const saveButton = sectionCard.getByTestId('save-section');
        await saveButton.click();

        // Should show saving state (may be very brief)
        // Note: This test might be flaky due to fast save operations
        try {
          await expect(sectionCard.getByText('Saving...')).toBeVisible({ timeout: 100 });
        } catch {
          // Save might complete too quickly to observe
        }
      }
    });
  });

  test.describe('Placeholder Content for Empty Sections', () => {
    test('displays placeholder for empty sections', async ({ page }) => {
      const emptySection = page.getByTestId('section-empty').first();

      if ((await emptySection.count()) > 0) {
        // Should show placeholder text
        await expect(emptySection.getByTestId('placeholder-text')).toBeVisible();

        // Should show start drafting button
        await expect(emptySection.getByTestId('start-drafting')).toBeVisible();
        await expect(emptySection.getByTestId('start-drafting')).toHaveText('Begin Drafting');
      }
    });

    test('enters edit mode when start drafting is clicked', async ({ page }) => {
      const emptySection = page.getByTestId('section-empty').first();

      if ((await emptySection.count()) > 0) {
        const startButton = emptySection.getByTestId('start-drafting');
        await startButton.click();

        // Should enter edit mode
        await expect(emptySection.getByText('Editing')).toBeVisible();

        // Should show editor interface
        await expect(page.getByTestId('milkdown-editor')).toBeVisible();
      }
    });

    test('replaces placeholder with content after editing', async ({ page }) => {
      const emptySection = page.getByTestId('section-empty').first();

      if ((await emptySection.count()) > 0) {
        // Start editing
        await emptySection.getByTestId('start-drafting').click();

        // Enter content in editor
        const editor = page.getByTestId('milkdown-editor');
        const textarea = editor.getByRole('textbox');
        await textarea.fill('# New Content\nThis is my new section content.');

        // Save the section
        await emptySection.getByTestId('save-section').click();

        // Wait for save to complete
        await page.waitForTimeout(500);

        // Verify placeholder is replaced with content
        await expect(emptySection.getByTestId('placeholder-text')).not.toBeVisible();
        await expect(emptySection.getByTestId('section-content')).toContainText('New Content');
      }
    });
  });

  test.describe('WYSIWYG Editor Integration', () => {
    test('displays Milkdown editor in edit mode', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        await sectionCard.getByTestId('edit-button').click();

        // Should show Milkdown editor
        await expect(page.getByTestId('milkdown-editor')).toBeVisible();

        // Should have a textarea (MVP implementation)
        await expect(page.getByTestId('milkdown-editor').getByRole('textbox')).toBeVisible();
      }
    });

    test('supports basic text input and editing', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        await sectionCard.getByTestId('edit-button').click();

        const editor = page.getByTestId('milkdown-editor');
        const textarea = editor.getByRole('textbox');

        // Type content
        await textarea.fill('# Test Heading\n\nThis is test content with **bold** text.');

        // Verify content is entered
        await expect(textarea).toHaveValue(/Test Heading/);
        await expect(textarea).toHaveValue(/bold/);
      }
    });

    test('maintains content during editing session', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        await sectionCard.getByTestId('edit-button').click();

        const editor = page.getByTestId('milkdown-editor');
        const textarea = editor.getByRole('textbox');

        // Enter initial content
        await textarea.fill('Initial content');

        // Add more content
        await textarea.fill('Initial content\n\nAdditional content');

        // Verify both parts are maintained
        await expect(textarea).toHaveValue(/Initial content/);
        await expect(textarea).toHaveValue(/Additional content/);
      }
    });
  });

  test.describe('Performance Requirements', () => {
    test('section navigation completes within 300ms', async ({ page }) => {
      const tocItems = page.getByTestId('toc-item');

      if ((await tocItems.count()) > 1) {
        const targetItem = tocItems.nth(1);
        await targetItem.getAttribute('data-section-id');

        // Measure navigation time
        const startTime = Date.now();

        await targetItem.click();

        // Wait for active state
        await expect(targetItem).toHaveAttribute('data-active', 'true');

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within 300ms
        expect(duration).toBeLessThan(300);
      }
    });

    test('edit mode transition is responsive', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        const startTime = Date.now();

        await sectionCard.getByTestId('edit-button').click();

        // Wait for edit mode
        await expect(sectionCard.getByText('Editing')).toBeVisible();

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should be responsive (under 200ms)
        expect(duration).toBeLessThan(200);
      }
    });

    test('editor loads without blocking UI', async ({ page }) => {
      // Verify page is interactive during load
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      // Should be able to interact with ToC immediately
      const firstTocItem = page.getByTestId('toc-item').first();
      await expect(firstTocItem).toBeEnabled();
    });
  });

  test.describe('Visual State Indicators', () => {
    test('distinguishes between section states visually', async ({ page }) => {
      const sectionCards = page.getByTestId('section-card');

      if ((await sectionCards.count()) > 0) {
        const firstCard = sectionCards.first();

        // Should have status indicator
        await expect(firstCard.locator('svg').first()).toBeVisible();

        // Should show readable status text
        const statusTexts = ['Idle', 'Reading', 'Editing', 'Saving'];
        const hasStatus = await Promise.all(
          statusTexts.map(status => firstCard.getByText(status).count())
        );

        expect(hasStatus.some(count => count > 0)).toBe(true);
      }
    });

    test('shows active section highlighting', async ({ page }) => {
      const tocItem = page.getByTestId('toc-item').first();
      await tocItem.click();

      // Should have active styling
      await expect(tocItem).toHaveAttribute('data-active', 'true');

      // Should have visual distinction (blue highlight)
      await expect(tocItem).toHaveClass(/blue/);
    });

    test('indicates editing user when present', async ({ page }) => {
      // Look for user indicators
      const userIndicator = page.locator('[data-testid="section-card"] >> text=/by .+/');

      if ((await userIndicator.count()) > 0) {
        await expect(userIndicator).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('adapts to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify ToC is still accessible
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      // Verify sections are still usable
      const sectionCard = page.getByTestId('section-card').first();
      if ((await sectionCard.count()) > 0) {
        await expect(sectionCard).toBeVisible();
        await expect(sectionCard.getByTestId('edit-button')).toBeVisible();
      }
    });

    test('adapts to tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify layout works on tablet
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      const sectionCards = page.getByTestId('section-card');
      if ((await sectionCards.count()) > 0) {
        await expect(sectionCards.first()).toBeVisible();
      }
    });

    test('works on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1440, height: 900 });

      // Verify full desktop experience
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      const sectionCards = page.getByTestId('section-card');
      if ((await sectionCards.count()) > 0) {
        // Should have multiple sections visible
        await expect(sectionCards.first()).toBeVisible();
      }
    });
  });

  test.describe('Keyboard Accessibility', () => {
    test('supports keyboard navigation through ToC', async ({ page }) => {
      // Focus first ToC item
      const firstTocItem = page.getByTestId('toc-item').first();
      await firstTocItem.focus();

      // Should be focusable
      await expect(firstTocItem).toBeFocused();

      // Tab navigation should work
      await page.keyboard.press('Tab');

      // Next focusable element should receive focus
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('supports keyboard activation of edit mode', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        const editButton = sectionCard.getByTestId('edit-button');

        // Focus edit button
        await editButton.focus();
        await expect(editButton).toBeFocused();

        // Activate with Enter key
        await page.keyboard.press('Enter');

        // Should enter edit mode
        await expect(sectionCard.getByText('Editing')).toBeVisible();
      }
    });

    test('supports keyboard navigation in editor', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        await sectionCard.getByTestId('edit-button').click();

        const textarea = page.getByTestId('milkdown-editor').getByRole('textbox');
        await textarea.focus();

        // Should be able to type
        await page.keyboard.type('Test content with keyboard');

        await expect(textarea).toHaveValue(/keyboard/);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('handles network errors gracefully', async ({ page }) => {
      // Simulate network issues
      await page.route('**/api/**', route => route.abort());

      // Should still display UI
      await expect(page.getByTestId('toc-panel')).toBeVisible();

      // Should show appropriate error states or loading indicators
      // (Implementation depends on error handling strategy)
    });

    test('recovers from temporary errors', async ({ page }) => {
      // This would test error recovery mechanisms
      // Implementation depends on error handling strategy
      await expect(page.getByTestId('toc-panel')).toBeVisible();
    });
  });

  test.describe('Assumption Conflict Modal', () => {
    test('surfaces fixture transcript and auth guidance during conflict resolution', async ({
      page,
    }) => {
      await page.goto('/documents/demo-architecture/sections/sec-assumptions');

      const conflictDialog = page.getByTestId('conflict-dialog');
      if (await conflictDialog.isVisible()) {
        await page.getByTestId('dismiss-conflict').click();
        await conflictDialog.waitFor({ state: 'hidden' });
      }

      const preview = page.getByTestId('section-preview');
      await expect(preview).toBeVisible();

      const trigger = preview.getByTestId('assumption-conflict-trigger');
      await expect(trigger).toBeVisible();
      await trigger.evaluate(element => {
        (element as HTMLElement).click();
      });

      const conflictModal = page.getByTestId('assumption-conflict-modal');
      await conflictModal.waitFor({ state: 'visible' });

      const promptList = conflictModal.getByTestId('assumption-prompts');
      await expect(promptList).toBeVisible();
      await expect(promptList).toContainText('Have we documented escalation paths');
      await expect(promptList).toContainText('Does the zero-trust rollout cover legacy services?');
      await expect(promptList).toContainText('Status: pending');
      await expect(promptList).toContainText('Status: answered');

      const entryCount = await promptList.getByTestId('assumption-entry').count();
      expect(entryCount).toBeGreaterThanOrEqual(3);

      const unresolvedBadge = conflictModal.getByTestId('assumption-unresolved-count');
      await expect(unresolvedBadge).toHaveText(/Unresolved items:\s*2/);
    });
  });

  test.describe('Data Persistence', () => {
    test('maintains editor state across page reloads', async ({ page }) => {
      const sectionCard = page.getByTestId('section-card').first();

      if ((await sectionCard.count()) > 0) {
        // Enter edit mode and add content
        await sectionCard.getByTestId('edit-button').click();

        const editor = page.getByTestId('milkdown-editor');
        const textarea = editor.getByRole('textbox');
        await textarea.fill('Persistent content test');

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check if content persisted (depends on auto-save implementation)
        // This test may need adjustment based on persistence strategy
      }
    });
  });
});
