import type { Express } from 'express';

export function resetDatabaseForApp(app: Express) {
  try {
    const ctx = app.locals.appContext as {
      database: import('better-sqlite3').Database;
    };
    const db = ctx.database;
    // Order matters for FK, but in test we disable FKs; still delete in reverse dependency order
    db.exec(`
      DELETE FROM activity_logs;
      DELETE FROM configurations;
      DELETE FROM projects;
      DELETE FROM users;
      INSERT OR IGNORE INTO users (
        id,
        email,
        first_name,
        last_name,
        created_by,
        updated_by
      ) VALUES (
        'system',
        'system@ctrl-freaq.local',
        'System',
        'User',
        'system',
        'system'
      );
    `);
  } catch {
    // ignore
  }
}

export function resetAllRegisteredApps() {
  const apps = (globalThis as unknown as { __ctrlfreaq_api_apps__?: Express[] })
    .__ctrlfreaq_api_apps__;
  if (!apps) return;
  for (const app of apps) {
    resetDatabaseForApp(app);
  }
}
