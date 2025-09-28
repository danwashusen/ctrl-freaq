import { defineConfig } from '@playwright/test';

import { createFixtureConfig } from './playwright.shared';

export default defineConfig(createFixtureConfig());
