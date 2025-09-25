# Quickstart Guide: Section Editor & WYSIWYG Capabilities

**Feature**: Section Editor & WYSIWYG Capabilities (007-epic-2-story) **Date**:
2025-09-25

## Overview

This guide walks through validation scenarios that exercise the rich text
section editor, manual draft workflow, conflict detection, and diff preview
requirements.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Start dev servers (web:5173, api:5001)
pnpm dev

# Run Vitest in watch mode
pnpm --filter apps/web test -- --watch

# Launch Playwright UI runner
pnpm --filter apps/web test:e2e -- --ui
```

## Scenario 1: Enter Edit Mode With Conflict Check

**Acceptance Criteria**: FR-001, FR-002, FR-006, NFR-001

```typescript
// /apps/web/tests/e2e/section-editor/edit-mode-conflict.e2e.ts
import { test, expect } from '@playwright/test';

test('prompts rebase when newer approved content exists', async ({ page }) => {
  await page.goto('/documents/demo-architecture/sections/sec-overview');

  await expect(page.locator('[data-testid="section-view"]')).toBeVisible();
  await page.locator('[data-testid="enter-edit"]').click();

  // Conflict detection runs on entry
  const conflictDialog = page.locator('[data-testid="conflict-dialog"]');
  await expect(conflictDialog).toBeVisible();
  await expect(conflictDialog).toContainText('Rebase onto latest approved');

  await conflictDialog.locator('[data-testid="confirm-rebase"]').click();

  // Edit mode loads within 300 ms target
  const editor = page.locator('[data-testid="milkdown-editor"]');
  await expect(editor).toBeVisible({ timeout: 300 });
});
```

## Scenario 2: Manual Save Draft With Unsupported Formatting Highlight

**Acceptance Criteria**: FR-003, FR-005, FR-006, FR-008

```typescript
// /apps/web/tests/integration/section-editor/manual-save.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSectionDraft } from '@/features/section-editor/hooks/use-section-draft';

const mockApi = {
  saveDraft: vi.fn().mockResolvedValue({
    draftVersion: 2,
    conflictState: 'clean',
    formattingAnnotations: [
      {
        id: 'ann-1',
        startOffset: 10,
        endOffset: 24,
        markType: 'unsupported-color',
        message: 'Custom colors are not allowed',
        severity: 'warning',
      },
    ],
  }),
};

describe('useSectionDraft manual save', () => {
  it('saves draft and surfaces formatting warnings', async () => {
    const { result } = renderHook(() =>
      useSectionDraft({
        api: mockApi,
        sectionId: 'sec-1',
        initialContent: '## Scope',
        approvedVersion: 4,
      })
    );

    act(() => {
      result.current.updateDraft('# Scope\n<font color="red">Alert</font>');
      result.current.setSummary('Clarified scope statement.');
    });

    await act(async () => {
      await result.current.manualSave();
    });

    expect(mockApi.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: 'sec-1',
        draftBaseVersion: 4,
        summaryNote: 'Clarified scope statement.',
      })
    );
    expect(result.current.state.formattingWarnings).toHaveLength(1);
  });
});
```

## Scenario 3: Diff Preview Before Submit For Review

**Acceptance Criteria**: FR-004, FR-005, FR-010

```typescript
// /apps/web/tests/e2e/section-editor/diff-preview.e2e.ts
import { test, expect } from '@playwright/test';

test('shows side-by-side diff prior to review request', async ({ page }) => {
  await page.goto('/documents/demo-architecture/sections/sec-overview');

  // Enter edit mode and make changes
  await page.locator('[data-testid="enter-edit"]').click();
  await page.locator('[data-testid="milkdown-editor"]').type('Updated intro');
  await page.locator('[data-testid="save-draft"]').click();

  // Open diff preview
  await page.locator('[data-testid="open-diff"]').click();
  const diffPane = page.locator('[data-testid="diff-viewer"]');
  await expect(diffPane).toBeVisible();
  await expect(diffPane.locator('[data-testid="diff-added"]')).toContainText(
    'Updated intro'
  );

  // Submit for review with summary
  await page.locator('[data-testid="submit-review"]').click();
  await page
    .locator('[data-testid="review-summary-input"]')
    .fill('Document introduction clarified.');
  await page.locator('[data-testid="confirm-submit"]').click();

  await expect(page.locator('[data-testid="section-status-chip"]')).toHaveText(
    'Review pending'
  );
});
```

## Scenario 4: Conflict Resolution Logs API

**Acceptance Criteria**: FR-006, Constitution observability requirement

```typescript
// /apps/api/tests/contract/section-conflicts.contract.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ConflictResponseSchema = z.object({
  status: z.enum(['clean', 'rebase_required', 'blocked']),
  latestApprovedVersion: z.number().int().positive(),
  rebasedDraft: z
    .object({
      contentMarkdown: z.string(),
      draftVersion: z.number().int().positive(),
    })
    .optional(),
  events: z.array(
    z.object({
      detectedAt: z.string().datetime(),
      detectedDuring: z.enum(['entry', 'save']),
      resolvedBy: z
        .enum(['auto_rebase', 'manual_reapply', 'abandoned'])
        .nullable(),
    })
  ),
});

describe('POST /api/v1/sections/:id/conflicts/check contract', () => {
  it('returns structured conflict outcome', async () => {
    const response = await fetch(
      'http://localhost:5001/api/v1/sections/sec-1/conflicts/check',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid_jwt_token',
        },
        body: JSON.stringify({
          draftBaseVersion: 4,
          approvedVersion: 5,
          draftVersion: 2,
        }),
      }
    );

    expect(response.status).toBe(409); // fails RED phase until implemented
    const payload = await response.json();
    expect(() => ConflictResponseSchema.parse(payload)).not.toThrow();
  });
});
```

## Scenario 5: Telemetry Logging for Long Sections

**Acceptance Criteria**: NFR-001, observability requirements

1. Start the local dev stack (`pnpm dev`).
2. Open the long-section fixture at
   `http://localhost:5173/documents/demo-architecture/sections/sec-long-content`.
3. Wait for the `data-testid="long-section-telemetry"` element to render and
   confirm its `data-average-fps` attribute stays ≥ 60.
4. Inspect the browser console with devtools open; a structured log entry with
   `operation: "long_section_performance"` should appear, showing section id,
   measured FPS, and the 60 FPS threshold.
5. Verify the fallback indicator (`data-testid="long-section-fallback"`) records
   the initial render time via the `data-initial-render-ms` attribute.

## Scenario 6: Accessibility Audit

**Acceptance Criteria**: FR-007, WCAG 2.1 AA coverage

```bash
pnpm --filter @ctrl-freaq/web test:e2e \
  -- tests/e2e/section-editor/accessibility-audit.e2e.ts
```

The Axe scan ignores the mutable Milkdown contenteditable surface but enforces
all WCAG A/AA rules across the surrounding editor shell, approval controls, and
diff viewer.

## Automation Checklist

```bash
# Backend service protections
pnpm --filter @ctrl-freaq/api test -- \
  src/modules/section-editor/services/section-conflict.service.test.ts \
  src/modules/section-editor/services/section-draft.service.test.ts \
  src/modules/section-editor/services/section-approval.service.test.ts

# Frontend hook and diff performance guards
pnpm --filter @ctrl-freaq/web test -- \
  src/features/section-editor/hooks/use-section-draft.test.ts
pnpm --filter @ctrl-freaq/editor-core test -- src/patch-engine.test.ts

# WCAG audit via Playwright + Axe
pnpm --filter @ctrl-freaq/web test:e2e -- \
  tests/e2e/section-editor/accessibility-audit.e2e.ts
```

## Next Steps

Execute `/tasks` after reviewers accept this plan to materialize the numbered
implementation tasks derived from the research and design artifacts.
