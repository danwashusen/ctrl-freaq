# Quickstart Guide: New Section Content Flow

**Feature**: New Section Content Flow (009-epic-2-story-4) **Date**: 2025-09-29

## Overview

This guide validates the assumption-driven authoring workflow: forcing prompt
resolution before drafting, aligning section answers with document-level
decisions, and retaining every draft proposal with rationale for reviewer
transparency.

## Prerequisites

```bash
# Install dependencies
pnpm install

# Start dev servers (web:5173, api:5001)
pnpm dev

# Run contract + unit tests in watch mode
pnpm test -- --watch

# Launch Playwright runner for editor flows
pnpm --filter @ctrl-freaq/web test:e2e -- --ui
```

## Scenario 1: Override Skip Blocks Submission

**Acceptance Criteria**: FR-001, FR-002, FR-006

```typescript
// /apps/web/tests/e2e/document-editor/assumptions-override.e2e.ts
import { test, expect } from '@playwright/test';

test('skip override blocks final submission until reconciled', async ({
  page,
}) => {
  await page.goto('/documents/demo-architecture/sections/sec-streaming');
  await page.locator('[data-testid="start-new-content"]').click();

  // Skip the first prompt (records override)
  await page
    .locator('[data-testid="assumption-item"]')
    .first()
    .locator('[data-testid="override-skip"]')
    .click();
  await expect(page.locator('[data-testid="override-banner"]')).toContainText(
    'Resolve overrides before submission'
  );

  // Generate draft should still allow editing
  await page.locator('[data-testid="generate-draft"]').click();
  await expect(page.locator('[data-testid="draft-workspace"]')).toBeVisible();

  // Attempt to continue to review is blocked until override resolved
  await page.locator('[data-testid="finalise-draft"]').click();
  await expect(
    page.locator('[data-testid="submission-blocker"]')
  ).toContainText('Resolve 1 override');
});
```

## Scenario 2: Conflicting Decision Requires Revision

**Acceptance Criteria**: FR-003

```typescript
// /apps/api/tests/contract/assumption-session.contract.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { request } from '../utils/request';

const ConflictResponse = z.object({
  status: z.literal('conflict'),
  decisionId: z.string(),
  message: z.string(),
});

describe('assumption session conflict handling', () => {
  it('blocks conflicting answers with document-level decisions', async () => {
    const session = await request(
      'POST',
      '/sections/sec-streaming/assumptions/session',
      {
        body: { templateVersion: '1.2.0' },
      }
    );

    const res = await request(
      'POST',
      `/sections/sec-streaming/assumptions/${session.body.prompts[0].id}/answer`,
      {
        body: {
          answer: 'Use on-prem queues',
        },
      }
    );

    const conflict = ConflictResponse.parse(res.body);
    expect(conflict.decisionId).toBe('doc-decision-streaming-target');
    expect(conflict.message).toContain('Reconcile with document decision');
  });
});
```

## Scenario 3: Proposal History Retains Every Draft

**Acceptance Criteria**: FR-005, FR-007

```typescript
// /apps/web/tests/integration/document-editor/proposal-history.test.ts
import { describe, it, expect } from 'vitest';
import { createProposalStore } from '@/features/document-editor/assumptions-flow/stores/proposal-store';

describe('proposal history', () => {
  it('retains every generated draft with rationale mapping', () => {
    const store = createProposalStore({ sessionId: 'sess-1' });

    store.recordProposal({
      proposalId: 'prop-1',
      contentMarkdown: 'Draft v1',
      rationale: [
        { assumptionId: 'assume-1', summary: 'Follows streaming baseline' },
      ],
      source: 'ai_generated',
    });

    store.recordProposal({
      proposalId: 'prop-2',
      contentMarkdown: 'Draft v2 with edits',
      rationale: [
        { assumptionId: 'assume-1', summary: 'Updated per reviewer feedback' },
      ],
      source: 'manual_revision',
    });

    const history = store.getHistory();
    expect(history).toHaveLength(2);
    expect(history[1].supersededByProposalId).toBeNull();
    expect(history[0].supersededByProposalId).toBe('prop-2');
  });
});
```

## Exit Criteria

- All scenarios executed without unexpected blockers.
- Overrides resolved before submission; conflicting answers enforced by backend
  contract.
- Proposal history exposes full lineage for reviewer audit.
