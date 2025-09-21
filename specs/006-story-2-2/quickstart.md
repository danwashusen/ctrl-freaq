# Quickstart Guide: Document Editor Core Infrastructure

**Feature**: Document Editor Core Infrastructure (006-story-2-2) **Date**:
2025-09-20

## Overview

This guide demonstrates the Document Editor Core Infrastructure through test
scenarios that validate the key user stories and acceptance criteria from the
specification.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Run tests in watch mode
pnpm test --watch
```

## Test Scenario 1: Table of Contents Navigation

**User Story**: A senior engineer opens an architecture document and uses the
ToC to navigate between sections.

```typescript
// tests/e2e/toc-navigation.test.ts
import { test, expect } from '@playwright/test';

test('navigates to sections via Table of Contents', async ({ page }) => {
  // Given: An architecture document with populated sections
  await page.goto('/documents/test-doc-123/edit');

  // When: User opens the editor
  await expect(page.locator('[data-testid="toc-panel"]')).toBeVisible();

  // Then: ToC lists all sections with hierarchy
  const tocSections = page.locator('[data-testid="toc-item"]');
  await expect(tocSections).toHaveCount(15); // Example section count

  // When: User clicks a ToC item
  await tocSections.nth(5).click(); // Navigate to 6th section

  // Then: Viewport jumps to selected section
  const targetSection = page.locator('[data-testid="section-6"]');
  await expect(targetSection).toBeInViewport();
  await expect(targetSection).toHaveAttribute('data-active', 'true');
});

test('displays section hierarchy with nesting', async ({ page }) => {
  await page.goto('/documents/test-doc-123/edit');

  // Verify root sections
  const rootSections = page.locator('[data-testid="toc-item"][data-depth="0"]');
  await expect(rootSections).toHaveCount(5);

  // Verify nested sections
  const nestedSections = page.locator(
    '[data-testid="toc-item"][data-depth="1"]'
  );
  await expect(nestedSections.first()).toBeVisible();

  // Expand/collapse functionality
  const expandButton = rootSections
    .first()
    .locator('[data-testid="expand-toggle"]');
  await expandButton.click();
  await expect(nestedSections.first()).toBeHidden();
});
```

## Test Scenario 2: Section Read/Edit Mode Transitions

**User Story**: User reviews read-only previews and switches sections into edit
mode.

```typescript
// tests/integration/section-modes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorStore } from '@/features/document-editor/stores/editor-store';

describe('Section Mode Transitions', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('displays section in read mode by default', () => {
    const { result } = renderHook(() => useEditorStore());

    act(() => {
      result.current.loadSection({
        id: 'sec-1',
        viewState: 'read_mode',
        contentMarkdown: '# Introduction\nThis is the intro.',
        hasContent: true,
      });
    });

    expect(result.current.sections['sec-1'].viewState).toBe('read_mode');
  });

  it('transitions to edit mode when edit button clicked', () => {
    const { result } = renderHook(() => useEditorStore());

    act(() => {
      result.current.loadSection({
        id: 'sec-1',
        viewState: 'read_mode',
        contentMarkdown: '# Introduction',
        hasContent: true,
      });
    });

    act(() => {
      result.current.enterEditMode('sec-1');
    });

    expect(result.current.sections['sec-1'].viewState).toBe('edit_mode');
    expect(result.current.activeSectionId).toBe('sec-1');
  });

  it('preserves content when switching modes', () => {
    const { result } = renderHook(() => useEditorStore());
    const originalContent = '# Original Content\nThis should be preserved.';

    act(() => {
      result.current.loadSection({
        id: 'sec-1',
        viewState: 'read_mode',
        contentMarkdown: originalContent,
        hasContent: true,
      });
    });

    // Enter edit mode
    act(() => {
      result.current.enterEditMode('sec-1');
    });

    // Cancel editing
    act(() => {
      result.current.cancelEditing('sec-1');
    });

    expect(result.current.sections['sec-1'].contentMarkdown).toBe(
      originalContent
    );
    expect(result.current.sections['sec-1'].viewState).toBe('read_mode');
  });
});
```

## Test Scenario 3: Placeholder Content for Empty Sections

**User Story**: User navigates to an empty section and sees helpful placeholder
text.

```typescript
// tests/e2e/placeholder-content.test.ts
import { test, expect } from '@playwright/test';

test('displays placeholder for empty sections', async ({ page }) => {
  // Given: A section with no existing content
  await page.goto('/documents/test-doc-123/edit');

  // When: User navigates to empty section
  const emptySection = page.locator('[data-testid="section-empty"]');
  await emptySection.scrollIntoViewIfNeeded();

  // Then: Placeholder explains section purpose
  const placeholder = emptySection.locator('[data-testid="placeholder-text"]');
  await expect(placeholder).toContainText(
    'This section describes the high-level architecture'
  );

  // And: Option to begin drafting is available
  const startButton = emptySection.locator('[data-testid="start-drafting"]');
  await expect(startButton).toBeVisible();
  await expect(startButton).toHaveText('Begin Drafting');
});

test('replaces placeholder with content after editing', async ({ page }) => {
  await page.goto('/documents/test-doc-123/edit');

  // Start editing empty section
  const emptySection = page.locator('[data-testid="section-empty"]');
  await emptySection.locator('[data-testid="start-drafting"]').click();

  // Enter content in WYSIWYG editor
  const editor = page.locator('[data-testid="milkdown-editor"]');
  await editor.type('# New Content\nThis is my new section content.');

  // Save the section
  await page.locator('[data-testid="save-section"]').click();

  // Verify placeholder is replaced
  await expect(
    emptySection.locator('[data-testid="placeholder-text"]')
  ).toBeHidden();
  await expect(
    emptySection.locator('[data-testid="section-content"]')
  ).toContainText('New Content');
});
```

## Test Scenario 4: Patch Generation and Diff Preview

**User Story**: User makes changes and reviews Git-style diffs before saving.

```typescript
// tests/unit/patch-engine.test.ts
import { describe, it, expect } from 'vitest';
import {
  createPatch,
  applyPatch,
  previewPatch,
} from '@/packages/editor-core/patch-engine';

describe('Patch Engine', () => {
  it('generates patches for content changes', () => {
    const original = '# Title\nOriginal content here.';
    const modified = '# Title\nModified content here.\nNew line added.';

    const patches = createPatch(original, modified);

    expect(patches).toHaveLength(2);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].oldValue).toContain('Original');
    expect(patches[0].value).toContain('Modified');
    expect(patches[1].op).toBe('add');
    expect(patches[1].value).toContain('New line');
  });

  it('applies patches to restore content', () => {
    const original = '# Title\nOriginal content.';
    const patches = [
      {
        op: 'replace',
        path: '/1',
        oldValue: 'Original content.',
        value: 'Updated content.',
      },
      { op: 'add', path: '/2', value: 'Additional line.' },
    ];

    const result = applyPatch(original, patches);

    expect(result).toBe('# Title\nUpdated content.\nAdditional line.');
  });

  it('generates preview diff for review', () => {
    const original = '# Section\nLine 1\nLine 2';
    const modified = '# Section\nLine 1 modified\nLine 3';

    const diff = previewPatch(original, modified);

    expect(diff.additions).toBe(2);
    expect(diff.deletions).toBe(1);
    expect(diff.preview).toContain('- Line 2');
    expect(diff.preview).toContain('+ Line 1 modified');
    expect(diff.preview).toContain('+ Line 3');
  });
});
```

## Test Scenario 5: Performance Validation

**User Story**: Navigation and editing operations meet performance requirements.

```typescript
// tests/performance/editor-performance.test.ts
import { test, expect } from '@playwright/test';

test('section navigation completes within 300ms', async ({ page }) => {
  await page.goto('/documents/test-doc-123/edit');

  // Measure navigation performance
  const startTime = Date.now();

  await page.locator('[data-testid="toc-item"]').nth(10).click();
  await page.waitForSelector('[data-testid="section-11"][data-active="true"]');

  const endTime = Date.now();
  const duration = endTime - startTime;

  expect(duration).toBeLessThan(300);
});

test('animations run at 60fps', async ({ page }) => {
  await page.goto('/documents/test-doc-123/edit');

  // Start performance measurement
  await page.evaluate(() => {
    window.frameCount = 0;
    window.startTime = performance.now();

    const countFrames = () => {
      window.frameCount++;
      if (performance.now() - window.startTime < 1000) {
        requestAnimationFrame(countFrames);
      }
    };
    requestAnimationFrame(countFrames);
  });

  // Trigger animation (expand ToC section)
  await page.locator('[data-testid="expand-toggle"]').first().click();

  // Wait for animation to complete
  await page.waitForTimeout(1000);

  // Check frame rate
  const fps = await page.evaluate(() => window.frameCount);
  expect(fps).toBeGreaterThanOrEqual(55); // Allow small variance from 60fps
});

test('patch generation completes within 100ms', async ({ page }) => {
  await page.goto('/documents/test-doc-123/edit');

  // Enter edit mode
  await page.locator('[data-testid="edit-button"]').first().click();

  // Make changes
  const editor = page.locator('[data-testid="milkdown-editor"]');
  await editor.type('New content added for testing patch generation speed.');

  // Measure patch generation
  const startTime = Date.now();
  await page.locator('[data-testid="preview-changes"]').click();
  await page.waitForSelector('[data-testid="diff-preview"]');
  const endTime = Date.now();

  expect(endTime - startTime).toBeLessThan(100);
});
```

## Running the Tests

```bash
# Run all tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run integration tests
pnpm test:integration

# Run unit tests
pnpm test:unit

# Run performance tests
pnpm test:performance

# Generate coverage report
pnpm test:coverage
```

## Validation Checklist

- [ ] Table of Contents displays all sections hierarchically
- [ ] Navigation to sections updates viewport and active state
- [ ] Sections display in read-only mode by default
- [ ] Edit mode preserves content and allows WYSIWYG editing
- [ ] Empty sections show appropriate placeholder text
- [ ] Changes generate Git-style patches for review
- [ ] Diff preview shows additions/deletions clearly
- [ ] Section navigation completes within 300ms
- [ ] Animations maintain 60fps
- [ ] Patch generation completes within 100ms
- [ ] Multiple sections can be edited independently
- [ ] Pending changes persist across page reloads
- [ ] Save operations batch multiple sections efficiently
- [ ] Visual state indicators distinguish modes clearly
- [ ] Responsive design works on mobile/tablet/desktop

## Next Steps

After validating all test scenarios:

1. Integrate with AI assistance features
2. Add collaboration indicators for multi-user editing
3. Implement quality gates integration
4. Add export functionality
5. Performance optimization for large documents (100+ sections)
