-- Initial database schema for CTRL FreaQ MVP
-- Migration: 001 - Create initial tables

-- Users table (references Clerk user IDs)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Clerk user ID
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system',
    deleted_at DATETIME NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Projects table (one project per user in MVP)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, -- UUID
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system',
    deleted_at DATETIME NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(owner_user_id) -- One project per user constraint
);

-- Configuration table (key-value pairs per user)
CREATE TABLE IF NOT EXISTS configurations (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system',
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, key)
);

-- App versions table (for version tracking)
CREATE TABLE IF NOT EXISTS app_versions (
    id TEXT PRIMARY KEY, -- UUID
    version TEXT NOT NULL UNIQUE,
    schema_version TEXT NOT NULL,
    migrated_at TEXT DEFAULT (datetime('now')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system',
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Activity log table (for audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT, -- JSON string
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system',
    deleted_at TEXT NULL,
    deleted_by TEXT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET DEFAULT,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_configurations_user ON configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_configurations_key ON configurations(key);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Seed system audit user to satisfy default foreign key references
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
