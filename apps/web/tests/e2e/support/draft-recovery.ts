import { expect, type Page } from '@playwright/test';

export async function dismissDraftRecoveryGate(page: Page) {
  const gate = page.getByTestId('draft-recovery-gate');

  if (!(await gate.count())) {
    return;
  }

  if (!(await gate.isVisible())) {
    return;
  }

  await page.evaluate(async () => {
    const globalWindow = window as typeof window & {
      __CTRL_FREAQ_DRAFT_LOGOUT__?: {
        trigger(authorId: string): Promise<void>;
      };
    };

    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch (error) {
      void error;
    }

    const logoutBridge = globalWindow.__CTRL_FREAQ_DRAFT_LOGOUT__;
    if (logoutBridge?.trigger) {
      try {
        await logoutBridge.trigger('user-local-author');
      } catch (error) {
        void error;
      }
    }
  });

  await page.waitForTimeout(100);

  const discardButton = page.getByRole('button', { name: /discard recovered drafts/i });
  if ((await discardButton.count()) > 0) {
    await discardButton.click({ force: true });
  } else {
    const applyButton = page.getByRole('button', { name: /apply recovered drafts/i });
    if ((await applyButton.count()) > 0) {
      await applyButton.click({ force: true });
    }
  }

  await expect(gate).not.toBeVisible();
}
