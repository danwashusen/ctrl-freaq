import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type AxeAnalysis = Awaited<ReturnType<AxeBuilder['analyze']>>;

const formatViolations = (violations: AxeAnalysis['violations']) =>
  violations
    .map((violation: AxeAnalysis['violations'][number]) => {
      const nodes = violation.nodes
        .map(
          (node: (typeof violation.nodes)[number]) =>
            `  • ${node.target.join(' ')}: ${node.failureSummary}`
        )
        .join('\n');
      return `${violation.id} (${violation.help}):\n${nodes}`;
    })
    .join('\n\n');

test.describe('Section Editor Accessibility', () => {
  test('meets WCAG AA guidelines in edit mode', async ({ page }) => {
    await page.goto('/documents/demo-architecture/sections/sec-overview');

    await page.getByTestId('enter-edit').click();
    await expect(page.getByTestId('milkdown-editor')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude(['[data-testid="milkdown-editor"] [contenteditable="true"]'])
      .analyze();

    expect(
      accessibilityScanResults.violations,
      formatViolations(accessibilityScanResults.violations)
    ).toEqual([]);
  });
});
