# Data Model: Document Schema & Template System

## Overview

This data model formalizes document template cataloging, version management, and
schema validation assets required to drive the editor experience and backend
enforcement. Templates are authored in YAML, compiled into JSON schema
snapshots, and referenced by documents via (`templateId`, `templateVersion`).

## Core Entities

### DocumentTemplate (Catalog Entry)

```typescript
interface DocumentTemplate {
  id: string; // Slug (e.g., "architecture")
  name: string; // Display name
  description?: string; // Manager-facing summary
  documentType: 'architecture' | 'prd' | 'qa' | 'other';
  activeVersionId?: string; // FK → TemplateVersion.id
  status: 'draft' | 'active' | 'deprecated';
  defaultAggressiveness?: 'conservative' | 'balanced' | 'yolo';
  createdAt: Date;
  createdBy: string; // Clerk userId
  updatedAt: Date;
  updatedBy: string;
  deletedAt?: Date;
  deletedBy?: string;
}
```

**Constraints/Notes**:

- `id` acts as canonical key and matches YAML filename prefix
  (`templates/{id}.yaml`).
- `activeVersionId` is `NULL` until a version is promoted; enforced via FK with
  `ON DELETE SET NULL`.
- Soft-deletes preserve audit history per SOC 2 (`deletedAt`, `deletedBy`).
- Managers may mark `status = 'deprecated'` without clearing `activeVersionId`;
  UI warns editors when active version is deprecated.

### TemplateVersion

```typescript
interface TemplateVersion {
  id: string; // UUID
  templateId: string; // FK → DocumentTemplate.id
  version: string; // Semver string (e.g., "1.2.0")
  status: 'draft' | 'active' | 'deprecated';
  changelog?: string; // Markdown summary of changes
  schemaHash: string; // SHA256 of canonical JSON schema
  schemaJson: JsonValue; // Compiled JSON schema for validation
  sectionsJson: TemplateSection[]; // Hierarchical section definitions
  sourcePath: string; // Relative path to YAML file used for publish
  publishedAt?: Date;
  publishedBy?: string; // Clerk userId
  deprecatedAt?: Date;
  deprecatedBy?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}
```

**Constraints/Notes**:

- (`templateId`, `version`) must be unique.
- `status = 'active'` implies `publishedAt` and `publishedBy` populated;
  triggers update of catalog `activeVersionId` inside transaction.
- `schemaJson` is used by shared validator; `sectionsJson` drives UI scaffolding
  (mirrors YAML structure for client consumption).
- Soft deletion is not allowed; versions remain immutable for auditing.
  Deprecation uses dedicated columns.

### TemplateSection

```typescript
type TemplateSection = {
  id: string; // Stable section identifier (e.g., "introduction")
  title: string;
  orderIndex: number; // Ordering inside parent
  guidance?: string; // Helper text shown in UI
  required: boolean;
  type: 'markdown' | 'rich-text' | 'table' | 'list' | 'decision-log';
  versionedCopy?: string; // Optional default content snippet
  fields?: TemplateField[]; // Leaf fields, optional for structured sections
  children?: TemplateSection[]; // Nested subsections
};
```

### TemplateField

```typescript
type TemplateField = {
  id: string; // Unique within section (e.g., "technical_risks")
  label: string; // Display label in UI
  description?: string; // Guidance text
  dataType: 'markdown' | 'string' | 'enum' | 'number' | 'url' | 'boolean';
  required: boolean;
  defaultValue?: string | number | boolean;
  allowedValues?: string[]; // For enum types
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex for strings/urls
};
```

**Storage Strategy**:

- `TemplateSection` and `TemplateField` are persisted inside
  `TemplateVersion.sectionsJson` as structured JSON (mirrors YAML) and cached
  via `packages/template-resolver`.
- Normalized table for sections is unnecessary in MVP; JSON allows hierarchical
  traversal and aligns with existing resolver APIs.

## Supporting Entities & Relationships

### Document (Existing)

- Fields `templateId: string` and `templateVersion: string` already exist.
- Add FK constraints:
  - `templateId` → `DocumentTemplate.id`
  - (`templateId`, `templateVersion`) → `TemplateVersion(templateId, version)`
- Introduce `templateSchemaHash` column to pin the schema snapshot used when the
  document was last validated.
- Auto-upgrade workflow updates `templateVersion` and `templateSchemaHash` on
  document load when the active version changes; removed versions surface
  block-state metadata for the editor.

### DocumentTemplateMigration (Event Log)

```typescript
interface DocumentTemplateMigration {
  id: string; // UUID
  documentId: string; // FK → Document.id
  fromVersion: string;
  toVersion: string;
  status: 'pending' | 'succeeded' | 'failed';
  validationErrors?: JsonValue; // Zod issues when migration fails
  initiatedBy: string; // Clerk userId or system actor
  initiatedAt: Date;
  completedAt?: Date;
}
```

**Purpose**:

- Records automatic upgrades triggered on document load as well as manual CLI
  migrations.
- Used for audit history, compliance reporting, and to present migration state
  or failure reasons in UI banners.

## Relationships Diagram (Textual)

- `DocumentTemplate` 1─\* `TemplateVersion`
- `TemplateVersion` embeds `TemplateSection[]` JSON definitions
- `Document` references `DocumentTemplate` and specific `TemplateVersion`
- `DocumentTemplateMigration` belongs to `Document`; references version string
  pair

## Indexing & Performance Considerations

- Index `TemplateVersion(templateId, status)` to quickly locate active/published
  versions.
- Index `TemplateVersion(schemaHash)` for caching/resolver lookups.
- Index `Document(templateId, templateVersion)` to expedite validation queries.
- Use partial index on `DocumentTemplate(status)` for filtering active vs
  deprecated templates.

## Data Integrity & Audit

- All create/update operations populate `created_by/updated_by` from
  authenticated manager identity.
- `TemplateVersion` updates are restricted to status transitions; schema content
  is immutable after publish.
- `DocumentTemplateMigration` records capture validation errors with sanitized
  field identifiers only (no raw content) per logging standards.
