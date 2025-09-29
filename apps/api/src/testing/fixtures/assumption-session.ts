import type * as BetterSqlite3 from 'better-sqlite3';

import { seedSectionFixture } from './section-editor';

export interface AssumptionSessionFixtureOptions {
  sectionId: string;
  documentId: string;
  templateVersion: string;
  startedBy: string;
}

const defaultOptions: AssumptionSessionFixtureOptions = {
  sectionId: 'sec-new-content-flow',
  documentId: 'doc-new-content-flow',
  templateVersion: '1.0.0',
  startedBy: 'user-assumption-author',
};

export interface AssumptionSessionSeedResult extends AssumptionSessionFixtureOptions {
  sessionId: string;
}

export const seedAssumptionSessionFixtures = (
  db: BetterSqlite3.Database,
  overrides: Partial<AssumptionSessionFixtureOptions> = {}
): AssumptionSessionSeedResult => {
  const options = { ...defaultOptions, ...overrides } satisfies AssumptionSessionFixtureOptions;

  seedSectionFixture(db, {
    sectionId: options.sectionId,
    documentId: options.documentId,
    userId: options.startedBy,
    approvedContent: '## Placeholder content for assumption run',
    approvedVersion: 1,
  });

  const nowIso = new Date().toISOString();
  const sessionId = `${options.sectionId}-assumption-session`;

  db.prepare(
    `INSERT OR REPLACE INTO assumption_sessions (
        id,
        section_id,
        document_id,
        started_by,
        started_at,
        status,
        template_version,
        decision_snapshot_id,
        unresolved_override_count,
        answered_count,
        deferred_count,
        escalated_count,
        override_count,
        latest_proposal_id,
        summary_markdown,
        closed_at,
        closed_by,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
     ) VALUES (?, ?, ?, ?, ?, 'in_progress', ?, NULL, 1, 1, 0, 0, 1, NULL, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
  ).run(
    sessionId,
    options.sectionId,
    options.documentId,
    options.startedBy,
    nowIso,
    options.templateVersion,
    '## Pending assumption summary for fixture verification',
    nowIso,
    options.startedBy,
    nowIso,
    options.startedBy
  );

  const prompts = [
    {
      id: `${sessionId}-prompt-1`,
      templateKey: 'assumptions.security.baseline',
      heading: 'Confirm security posture',
      body: 'Does this section introduce security changes requiring review?',
      responseType: 'single_select',
      optionsJson: JSON.stringify([
        {
          id: 'requires-review',
          label: 'Requires security review',
          description: null,
          defaultSelected: false,
        },
        {
          id: 'no-changes',
          label: 'No significant change',
          description: null,
          defaultSelected: true,
        },
      ]),
      status: 'override_skipped',
      answerValueJson: JSON.stringify('requires-review'),
      overrideJustification: 'Awaiting security controls evidence.',
    },
    {
      id: `${sessionId}-prompt-2`,
      templateKey: 'assumptions.performance.latency',
      heading: 'Validate latency targets',
      body: 'Are the latency SLOs updated for this change?',
      responseType: 'text',
      optionsJson: JSON.stringify([]),
      status: 'answered',
      answerValueJson: JSON.stringify('Latency target remains <300ms for EU/US regions.'),
      overrideJustification: null,
    },
  ] as const;

  for (const [index, prompt] of prompts.entries()) {
    db.prepare(
      `INSERT OR REPLACE INTO section_assumptions (
          id,
          session_id,
          section_id,
          document_id,
          template_key,
          prompt_heading,
          prompt_body,
          response_type,
          options_json,
          priority,
          status,
          answer_value_json,
          answer_notes,
          override_justification,
          conflict_decision_id,
          conflict_resolved_at,
          created_at,
          created_by,
          updated_at,
          updated_by,
          deleted_at,
          deleted_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
    ).run(
      prompt.id,
      sessionId,
      options.sectionId,
      options.documentId,
      prompt.templateKey,
      prompt.heading,
      prompt.body,
      prompt.responseType,
      prompt.optionsJson,
      index,
      prompt.status,
      prompt.answerValueJson,
      prompt.overrideJustification,
      nowIso,
      options.startedBy,
      nowIso,
      options.startedBy
    );
  }

  const proposals = [
    {
      id: `${sessionId}-proposal-1`,
      proposalIndex: 0,
      source: 'ai_generated',
      content:
        '### Initial Draft\n\n- Captures baseline security controls.\n- Flags pending latency verification.',
      rationale: JSON.stringify([
        { assumptionId: prompts[0].id, summary: 'Security review pending resolution.' },
        { assumptionId: prompts[1].id, summary: 'Latency targets restated for EU/US regions.' },
      ]),
    },
  ] as const;

  for (const proposal of proposals) {
    db.prepare(
      `INSERT OR REPLACE INTO draft_proposals (
          id,
          session_id,
          section_id,
          proposal_index,
          source,
          content_markdown,
          rationale_json,
          ai_confidence,
          failed_reason,
          created_at,
          created_by,
          updated_at,
          updated_by,
          superseded_at,
          superseded_by_proposal_id,
          deleted_at,
          deleted_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.85, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`
    ).run(
      proposal.id,
      sessionId,
      options.sectionId,
      proposal.proposalIndex,
      proposal.source,
      proposal.content,
      proposal.rationale,
      nowIso,
      options.startedBy,
      nowIso,
      options.startedBy
    );
  }

  const decisionLog = [
    {
      id: 'doc-security-baseline',
      decision: 'No significant change',
      status: 'approved',
      assumptionKeys: ['assumptions.security.baseline'],
      optionIds: ['no-changes'],
      allowedAnswers: ['No significant change'],
      responseType: 'single_select',
    },
  ];

  db.prepare('UPDATE documents SET content_json = json(?) WHERE id = ?').run(
    JSON.stringify({ decision_log: decisionLog }),
    options.documentId
  );

  return {
    ...options,
    sessionId,
  };
};
