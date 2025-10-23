import { expect, type Page } from '@playwright/test';

export async function selectSimpleAuthUser(page: Page) {
  const loginHeading = page.getByRole('heading', { name: /select a local test user/i });
  if (!(await loginHeading.count())) {
    return;
  }

  try {
    await loginHeading.waitFor({ state: 'visible', timeout: 1000 });
  } catch {
    return;
  }

  const storedSelection = await page.evaluate(() => {
    try {
      return window.localStorage?.getItem('ctrl-freaq.simple-auth.selected-user') ?? null;
    } catch {
      return null;
    }
  });

  const storedSelector =
    storedSelection && storedSelection.length > 0
      ? page.locator(`[data-testid="simple-auth-user-card"][data-user-id="${storedSelection}"]`)
      : null;

  let target = storedSelector && (await storedSelector.count()) > 0 ? storedSelector.first() : null;
  if (!target) {
    const firstCard = page.getByTestId('simple-auth-user-card').first();
    if ((await firstCard.count()) > 0) {
      target = firstCard;
    }
  }

  if (!target) {
    return;
  }

  await target.click();
  await expect(loginHeading).not.toBeVisible({ timeout: 2000 });
}

export async function dismissDraftRecoveryGate(page: Page) {
  await selectSimpleAuthUser(page);

  const gate = page.getByTestId('draft-recovery-gate');

  let gateVisible = false;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await gate.count()) === 0) {
      await page.waitForTimeout(100);
      continue;
    }
    if (await gate.isVisible()) {
      gateVisible = true;
      break;
    }
    await page.waitForTimeout(100);
  }

  if (!gateVisible) {
    return;
  }

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

  await page.evaluate(() => {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const storagePrefix = 'draft-store:';
      if (window.localStorage) {
        const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
          window.localStorage.key(index)
        ).filter((key): key is string => Boolean(key));
        for (const key of keys) {
          if (key.startsWith(storagePrefix)) {
            window.localStorage.removeItem(key);
          }
        }
      }
      if (window.sessionStorage) {
        const sessionKeys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
          window.sessionStorage.key(index)
        ).filter((key): key is string => Boolean(key));
        for (const key of sessionKeys) {
          if (key.startsWith(storagePrefix)) {
            window.sessionStorage.removeItem(key);
          }
        }
      }
    } catch {
      // Ignore storage access issues in test environments.
    }
  });
}
