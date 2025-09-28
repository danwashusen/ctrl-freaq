import { defineConfig } from '@playwright/test';

import { createFixtureConfig } from './playwright.shared';

/**
 * Default export remains pointed at fixture mode so existing commands continue to work.
 * Dedicated fixture/live configs are provided for explicit control by workspace scripts.
 */
export default defineConfig(createFixtureConfig());
