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
    deleted_by TEXT NULL
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
    deleted_by TEXT NULL
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_configurations_user ON configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_configurations_key ON configurations(key);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
