import type { Express } from 'express';

declare global {
  var __ctrlfreaq_api_apps__: Express[] | undefined;
}

export function registerTestApp(app: Express) {
  if (!globalThis.__ctrlfreaq_api_apps__) globalThis.__ctrlfreaq_api_apps__ = [];
  globalThis.__ctrlfreaq_api_apps__.push(app);
}

export function getRegisteredApps(): Express[] {
  return globalThis.__ctrlfreaq_api_apps__ || [];
}
