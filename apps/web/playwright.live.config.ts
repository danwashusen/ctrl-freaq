import { defineConfig } from '@playwright/test';

import { createLiveConfig } from './playwright.shared';

export default defineConfig(createLiveConfig());
