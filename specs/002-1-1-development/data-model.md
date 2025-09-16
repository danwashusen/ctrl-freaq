# Data Model: Development Environment Bootstrap

## Overview

This document defines the initial data models for the Development Environment
Bootstrap. Since this is infrastructure setup, the data models are minimal and
focused on configuration and basic application structure.

## Core Entities

### User (from Clerk Authentication)

```typescript
interface User {
  id: string; // Clerk user ID (e.g., "user_2abc...")
  email: string; // User email address
  name?: string; // Display name (optional)
  imageUrl?: string; // Profile image URL
  createdAt: Date; // Account creation timestamp
  updatedAt: Date; // Last update timestamp
}
```

**Notes**:

- Managed entirely by Clerk
- No local user table in MVP
- Referenced by other entities via userId

### Project (Personal Project Container)

```typescript
interface Project {
  id: string; // UUID
  ownerUserId: string; // Reference to Clerk User.id
  name: string; // Project name
  slug: string; // URL-friendly identifier
  description?: string; // Project description
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
}
```

**Constraints**:

- One project per user in MVP (enforced at API level)
- Auto-created on first login
- Slug must be unique across system

### Configuration (Application Settings)

```typescript
interface Configuration {
  id: string; // UUID
  userId: string; // User who owns this config
  key: string; // Configuration key (e.g., "theme", "logLevel")
  value: string; // JSON-stringified value
  createdAt: Date; // Creation timestamp
  updatedAt: Date; // Last update timestamp
}
```

**Common Configuration Keys**:

- `theme`: "light" | "dark" | "system"
- `logLevel`: "debug" | "info" | "warn" | "error"
- `editorPreferences`: JSON object with editor settings
- `apiKeys`: Encrypted API keys (future)

### AppVersion (Version Tracking)

```typescript
interface AppVersion {
  id: string; // UUID
  version: string; // Semver (e.g., "0.1.0")
  schemaVersion: string; // Database schema version
  migratedAt: Date; // When this version was applied
  notes?: string; // Migration notes
}
```

**Usage**:

- Track database migrations
- Ensure compatibility on startup
- Support rollback if needed

### ActivityLog (Audit Trail - Foundation)

```typescript
interface ActivityLog {
  id: string; // UUID
  userId: string; // User who performed action
  action: string; // Action type (e.g., "project.create", "config.update")
  resourceType: string; // Entity type affected
  resourceId: string; // Entity ID affected
  metadata?: Record<string, any>; // Additional context
  ipAddress?: string; // Client IP address
  userAgent?: string; // Client user agent
  createdAt: Date; // When action occurred
}
```

**Action Types** (initial):

- `auth.login`
- `auth.logout`
- `project.create`
- `project.update`
- `config.update`

## Database Schema (SQLite)

```sql
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_projects_owner ON projects(owner_user_id);
CREATE INDEX idx_projects_slug ON projects(slug);

-- Configuration table
CREATE TABLE IF NOT EXISTS configurations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, key)
);
CREATE INDEX idx_configurations_user ON configurations(user_id);

-- App versions table
CREATE TABLE IF NOT EXISTS app_versions (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL,
  migrated_at TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX idx_app_versions_version ON app_versions(version);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata TEXT, -- JSON string
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);
```

## Repository Interfaces

```typescript
// Base repository interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<T[]>;
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// Specific repositories
interface ProjectRepository extends Repository<Project> {
  findBySlug(slug: string): Promise<Project | null>;
  findByUserId(userId: string): Promise<Project | null>;
}

interface ConfigurationRepository extends Repository<Configuration> {
  findByUserAndKey(userId: string, key: string): Promise<Configuration | null>;
  upsert(userId: string, key: string, value: string): Promise<Configuration>;
}

interface ActivityLogRepository {
  create(log: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog>;
  findByUser(userId: string, options?: QueryOptions): Promise<ActivityLog[]>;
  findByAction(action: string, options?: QueryOptions): Promise<ActivityLog[]>;
}
```

## Service Layer Interfaces

```typescript
// Project service
interface ProjectService {
  getOrCreateUserProject(userId: string): Promise<Project>;
  updateProject(userId: string, updates: Partial<Project>): Promise<Project>;
}

// Configuration service
interface ConfigurationService {
  getUserConfig(userId: string, key: string): Promise<string | null>;
  setUserConfig(userId: string, key: string, value: any): Promise<void>;
  getUserConfigs(userId: string): Promise<Record<string, any>>;
}

// Activity logging service
interface ActivityLogger {
  log(activity: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
}
```

## Validation Rules

### Project Validation

- `name`: Required, 1-100 characters
- `slug`: Required, 1-50 characters, lowercase, alphanumeric with hyphens
- `description`: Optional, max 500 characters

### Configuration Validation

- `key`: Required, valid configuration key from enum
- `value`: Required, valid JSON string, max 10KB

### Common Validation

- All IDs: Valid UUID v4 format
- All timestamps: ISO 8601 format
- All user IDs: Valid Clerk user ID format

## Migration Strategy

### Initial Migration (v0.1.0)

```typescript
export async function up(db: Database): Promise<void> {
  // Create all tables as defined above
  db.exec(projectsTableSQL);
  db.exec(configurationsTableSQL);
  db.exec(appVersionsTableSQL);
  db.exec(activityLogsTableSQL);

  // Insert initial version
  db.prepare(
    `
    INSERT INTO app_versions (id, version, schema_version, migrated_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(uuidv4(), '0.1.0', '1', new Date().toISOString());
}

export async function down(db: Database): Promise<void> {
  // Drop all tables in reverse order
  db.exec('DROP TABLE IF EXISTS activity_logs');
  db.exec('DROP TABLE IF EXISTS app_versions');
  db.exec('DROP TABLE IF EXISTS configurations');
  db.exec('DROP TABLE IF EXISTS projects');
}
```

## Future Considerations

### Phase 2 Entities (Document Editor)

- Document
- Section
- Assumption
- Proposal
- Citation
- TraceLink

### DynamoDB Migration Path

- Partition key: `userId` for user-scoped queries
- Sort key: `entityType#entityId` for different entity types
- GSI for slug lookups
- No JOINs - denormalize where needed

### Scalability Notes

- Activity logs may need partitioning by date
- Consider caching frequently accessed configurations
- Project slug uniqueness may need different approach at scale

---

_Data model defined: 2025-09-13_
