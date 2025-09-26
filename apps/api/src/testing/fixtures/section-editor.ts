import type * as BetterSqlite3 from 'better-sqlite3';

interface SeedSectionParams {
  sectionId: string;
  documentId: string;
  userId: string;
  approvedVersion?: number;
  approvedContent?: string;
}

interface SeedDraftParams {
  draftId: string;
  sectionId: string;
  documentId: string;
  userId: string;
  draftVersion?: number;
  draftBaseVersion?: number;
}

interface SeedConflictParams {
  draftId: string;
  sectionId: string;
  userId: string;
  previousVersion: number;
  latestVersion: number;
}

const DEFAULT_APPROVED_CONTENT = '## Approved architecture overview';

export function seedUserFixture(db: BetterSqlite3.Database, userId: string | undefined): void {
  if (!userId) return;

  db.prepare(
    `INSERT OR IGNORE INTO users (
       id,
       email,
       first_name,
       last_name,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (?, ?, NULL, NULL, datetime('now'), 'system', datetime('now'), 'system', NULL, NULL)`
  ).run(userId, `${userId}@test.local`);
}

export function seedSectionFixture(db: BetterSqlite3.Database, params: SeedSectionParams): void {
  const nowIso = new Date().toISOString();
  const approvedVersion = Math.max(params.approvedVersion ?? 6, 1);
  const approvedContent = params.approvedContent ?? DEFAULT_APPROVED_CONTENT;

  seedUserFixture(db, params.userId);
  seedUserFixture(db, 'user-reviewer-001');

  db.prepare(
    `INSERT OR IGNORE INTO documents (
        id,
        project_id,
        title,
        content_json,
        template_id,
        template_version,
        template_schema_hash,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
     ) VALUES (?, ?, ?, '{}', NULL, NULL, NULL, ?, 'system', ?, 'system', NULL, NULL)`
  ).run(params.documentId, 'project-test', 'Demo Architecture Document', nowIso, nowIso);

  const documentExists = db
    .prepare('SELECT id FROM documents WHERE id = ? LIMIT 1')
    .get(params.documentId) as { id: string } | undefined;
  if (!documentExists) {
    throw new Error(`Document fixture missing for ${params.documentId}`);
  }

  db.prepare(
    `INSERT OR REPLACE INTO section_records (
        id,
        document_id,
        template_key,
        title,
        depth,
        order_index,
        approved_version,
        approved_content,
        approved_at,
        approved_by,
        last_summary,
        status,
        quality_gate,
        accessibility_score,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
     ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'ready', 'passed', NULL, ?, ?, ?, ?, NULL, NULL)`
  ).run(
    params.sectionId,
    params.documentId,
    'architecture-overview',
    'Architecture Overview',
    approvedVersion,
    approvedContent,
    nowIso,
    params.userId,
    'Initial change summary',
    nowIso,
    params.userId,
    nowIso,
    params.userId
  );

  const sectionRecordExists = db
    .prepare('SELECT id FROM section_records WHERE id = ? LIMIT 1')
    .get(params.sectionId) as { id: string } | undefined;
  if (!sectionRecordExists) {
    throw new Error(`Section record fixture missing for ${params.sectionId}`);
  }

  db.prepare(
    `UPDATE section_records
        SET approved_version = ?,
            approved_content = ?,
            approved_at = ?,
            approved_by = ?,
            updated_at = ?,
            updated_by = ?,
            status = 'ready',
            quality_gate = 'passed'
      WHERE id = ?`
  ).run(
    approvedVersion,
    approvedContent,
    nowIso,
    params.userId,
    nowIso,
    params.userId,
    params.sectionId
  );

  const sectionExists = db
    .prepare('SELECT id FROM sections WHERE id = ? LIMIT 1')
    .get(params.sectionId) as { id: string } | undefined;

  if (!sectionExists) {
    db.prepare(
      `INSERT OR IGNORE INTO sections (
          id,
          doc_id,
          parent_section_id,
          key,
          title,
          depth,
          order_index,
          content_markdown,
          placeholder_text,
          has_content,
          view_state,
          editing_user,
          last_modified,
          status,
          assumptions_resolved,
          quality_gate_status,
          created_at,
          updated_at
       ) VALUES (?, ?, NULL, ?, ?, 0, 0, ?, '', 1, 'read_mode', NULL, ?, 'ready', 1, 'passed', ?, ?)`
    ).run(
      params.sectionId,
      params.documentId,
      'architecture-overview',
      'Architecture Overview',
      approvedContent,
      nowIso,
      nowIso,
      nowIso
    );
    return;
  }

  db.prepare(
    `UPDATE sections
        SET content_markdown = ?,
            has_content = 1,
            status = 'ready',
            quality_gate_status = 'passed',
            last_modified = ?,
            updated_at = ?
      WHERE id = ?`
  ).run(approvedContent, nowIso, nowIso, params.sectionId);
}

export function seedDraftFixture(db: BetterSqlite3.Database, params: SeedDraftParams): void {
  const { draftId, sectionId, documentId, userId } = params;
  const now = new Date();
  const savedAt = now.toISOString();
  const targetVersion = params.draftVersion ?? 6;
  const baseVersion = Math.max(
    Math.min(params.draftBaseVersion ?? targetVersion - 1, targetVersion),
    0
  );

  const existing = db.prepare('SELECT id FROM section_drafts WHERE id = ? LIMIT 1').get(draftId) as
    | { id: string }
    | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO section_drafts (
         id,
         section_id,
         document_id,
         user_id,
         draft_version,
         draft_base_version,
         content_markdown,
         summary_note,
         conflict_state,
         conflict_reason,
         rebased_at,
         saved_at,
         saved_by,
         created_at,
         created_by,
         updated_at,
         updated_by,
         deleted_at,
         deleted_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'clean', NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL)`
    ).run(
      draftId,
      sectionId,
      documentId,
      userId,
      targetVersion,
      baseVersion,
      '## Draft content for contract tests',
      savedAt,
      userId,
      savedAt,
      userId,
      savedAt,
      userId
    );
    return;
  }

  db.prepare(
    `UPDATE section_drafts
        SET document_id = ?,
            user_id = ?,
            draft_version = ?,
            draft_base_version = ?,
            content_markdown = ?,
            saved_at = ?,
            saved_by = ?,
            updated_at = ?,
            updated_by = ?
      WHERE id = ?`
  ).run(
    documentId,
    userId,
    targetVersion,
    baseVersion,
    '## Draft content for contract tests',
    savedAt,
    userId,
    savedAt,
    userId,
    draftId
  );
}

export function seedConflictLogFixture(
  db: BetterSqlite3.Database,
  params: SeedConflictParams
): void {
  const { draftId, sectionId, userId, previousVersion, latestVersion } = params;
  const existing = db
    .prepare('SELECT id FROM draft_conflict_logs WHERE draft_id = ? LIMIT 1')
    .get(draftId) as { id: string } | undefined;

  if (existing) {
    return;
  }

  const detectedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO draft_conflict_logs (
       id,
       section_id,
       draft_id,
       detected_at,
       detected_during,
       previous_approved_version,
       latest_approved_version,
       resolved_by,
       resolution_note,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (?, ?, ?, ?, 'entry', ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
  ).run(
    `conflict-${draftId}`,
    sectionId,
    draftId,
    detectedAt,
    previousVersion,
    latestVersion,
    detectedAt,
    userId,
    detectedAt,
    userId
  );
}

export function seedConflictHistory(db: BetterSqlite3.Database, params: SeedConflictParams): void {
  seedConflictLogFixture(db, params);
}

export function seedSectionEditorFixtures(
  db: BetterSqlite3.Database,
  options: SeedSectionParams & SeedDraftParams & { draftId: string }
): void {
  seedSectionFixture(db, options);
  seedDraftFixture(db, options);
}
