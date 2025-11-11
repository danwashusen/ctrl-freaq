import type { IncomingMessage, ServerResponse } from 'http';

import {
  assertDocumentFixture,
  assertSectionFixture,
  documentFixtureSchema,
  fixtureErrorSchema,
  sectionFixtureSchema,
  type ApprovalFixture,
  type ConflictCheckFixture,
  type DocumentFixture,
  type DraftMetadataFixture,
  type FixtureErrorResponse,
  type FormattingWarningFixture,
  type ReviewSubmissionFixture,
  type SectionFixture,
  type DiffFixture,
  type CoAuthoringFixture,
  type CoAuthoringStreamEventFixture,
} from './types';
import { getProjectRetentionPolicy } from '../../../mocks/projectRetention';
import { demoArchitectureDocument } from './demo-architecture';
import { convertFixtureSessionToFlowState } from './transformers';

const sectionAliasMap: Record<string, string> = {
  'architecture-overview': 'sec-overview',
};

const normalizeSectionId = (sectionId: string): string => {
  return sectionAliasMap[sectionId] ?? sectionId;
};

const fixturesByDocumentId: Record<string, DocumentFixture> = {
  [demoArchitectureDocument.id]: demoArchitectureDocument,
};

type DocumentWorkflowStatus = 'missing' | 'loading' | 'ready' | 'archived';
type DocumentLifecycleState = 'draft' | 'review' | 'published';

interface TemplateBindingFixture {
  templateId: string;
  templateVersion: string;
  templateSchemaHash: string;
}

interface PrimaryDocumentSnapshotFixture {
  projectId: string;
  status: DocumentWorkflowStatus;
  document: {
    documentId: string;
    firstSectionId: string;
    title: string;
    lifecycleStatus: DocumentLifecycleState;
    lastModifiedAt: string;
    template?: TemplateBindingFixture;
  } | null;
  templateDecision: null;
  lastUpdatedAt: string;
}

const projectDocumentSnapshots: Record<string, PrimaryDocumentSnapshotFixture> = {
  'proj-architecture-demo': {
    projectId: 'proj-architecture-demo',
    status: 'ready',
    document: {
      documentId: demoArchitectureDocument.id,
      firstSectionId: 'sec-overview',
      title: demoArchitectureDocument.title,
      lifecycleStatus: 'review',
      lastModifiedAt: demoArchitectureDocument.updatedAt,
      template: {
        templateId: 'architecture-reference',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-architecture-210',
      },
    },
    templateDecision: null,
    lastUpdatedAt: demoArchitectureDocument.updatedAt,
  },
};

interface RuntimeSectionState {
  draft: DraftMetadataFixture | null;
  diff: DiffFixture | null;
  review: ReviewSubmissionFixture | null;
  approval: ApprovalFixture | null;
  coAuthoring?: {
    activeSessionId: string | null;
    pendingProposalId: string | null;
  };
}

interface RuntimeDocumentState {
  sections: Record<string, RuntimeSectionState>;
}

const sectionToDocumentMap = new Map<string, string>();
const runtimeDocuments: Record<string, RuntimeDocumentState> = initializeRuntimeDocuments();

const SAVE_INCREMENT_MS = 30_000;
const DIFF_GENERATED_OFFSET_MS = 5_000;

const simpleAuthUsersFixture: Array<{
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  org_role?: string;
  org_permissions?: string[];
}> = [
  {
    id: 'user-local-author',
    email: 'user-local-author@example.com',
    first_name: 'Local',
    last_name: 'Author',
    image_url: undefined,
    org_role: 'editor',
    org_permissions: ['view:projects'],
  },
  {
    id: 'user_alpha',
    email: 'alpha@example.com',
    first_name: 'Alpha',
    last_name: 'Tester',
    image_url: undefined,
    org_role: 'qa_lead',
    org_permissions: ['view:projects', 'manage:qa'],
  },
  {
    id: 'user_beta',
    email: 'beta@example.com',
    first_name: 'Beta',
    last_name: 'Reviewer',
    image_url: undefined,
    org_role: 'approver',
    org_permissions: ['documents:review'],
  },
];

type ParsedRequest =
  | { kind: 'document'; documentId: string }
  | { kind: 'section'; documentId: string; sectionId: string }
  | { kind: 'apiProjectPrimaryDocument'; projectId: string }
  | { kind: 'apiSimpleAuthUsers' }
  | { kind: 'apiSaveDraft'; sectionId: string }
  | { kind: 'apiDiff'; sectionId: string }
  | { kind: 'apiSubmitDraft'; sectionId: string }
  | { kind: 'apiApprove'; sectionId: string }
  | { kind: 'apiConflictsCheck'; sectionId: string }
  | { kind: 'apiConflictLogs'; sectionId: string }
  | { kind: 'apiAssumptionsStart'; sectionId: string }
  | { kind: 'apiProjectRetention'; projectSlug: string }
  | { kind: 'apiCoAuthorAnalyze'; documentId: string; sectionId: string }
  | { kind: 'apiCoAuthorProposal'; documentId: string; sectionId: string }
  | { kind: 'apiCoAuthorApply'; documentId: string; sectionId: string }
  | { kind: 'apiCoAuthorReject'; documentId: string; sectionId: string }
  | { kind: 'apiCoAuthorTeardown'; documentId: string; sectionId: string }
  | { kind: 'apiCoAuthorStream'; sessionId: string }
  | { kind: 'apiDocumentQualitySummary'; documentId: string }
  | { kind: 'apiDocumentQualityRun'; documentId: string }
  | { kind: 'apiDocumentTraceability'; documentId: string }
  | { kind: 'apiTraceabilityOrphan'; documentId: string }
  | { kind: 'unknown' };

const notFoundError: FixtureErrorResponse = fixtureErrorSchema.parse({
  code: 'fixtures.not_found',
  message: 'Requested fixture data unavailable. Verify document and section identifiers.',
});

const methodNotAllowedError: FixtureErrorResponse = fixtureErrorSchema.parse({
  code: 'fixtures.method_not_allowed',
  message: 'Only GET and POST requests are supported for fixture helpers.',
});

const internalError: FixtureErrorResponse = fixtureErrorSchema.parse({
  code: 'fixtures.internal_error',
  message: 'Unexpected fixture helper failure.',
});

function initializeRuntimeDocuments(): Record<string, RuntimeDocumentState> {
  const runtime: Record<string, RuntimeDocumentState> = {};

  Object.entries(fixturesByDocumentId).forEach(([documentId, document]) => {
    const runtimeDocument: RuntimeDocumentState = { sections: {} };
    runtime[documentId] = runtimeDocument;

    Object.entries(document.sections).forEach(([sectionId, section]) => {
      sectionToDocumentMap.set(sectionId, documentId);
      runtimeDocument.sections[sectionId] = {
        draft: section.draft ? cloneValue(section.draft) : null,
        diff: section.diff ? cloneValue(section.diff) : null,
        review: section.review ? cloneValue(section.review) : null,
        approval: section.approval ? cloneValue(section.approval) : null,
        coAuthoring: section.coAuthoring
          ? {
              activeSessionId: null,
              pendingProposalId: null,
            }
          : undefined,
      };
    });
  });

  return runtime;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveDocumentIdForSection(sectionId: string): string | null {
  const normalized = normalizeSectionId(sectionId);
  return sectionToDocumentMap.get(normalized) ?? null;
}

function getRuntimeSection(documentId: string, sectionId: string): RuntimeSectionState {
  const documentState = runtimeDocuments[documentId];
  if (!documentState) {
    throw new Error(`Unknown fixture document state for: ${documentId}`);
  }
  const normalized = normalizeSectionId(sectionId);
  const sectionState = documentState.sections[normalized];
  if (!sectionState) {
    throw new Error(`Unknown fixture section state for: ${documentId}/${normalized}`);
  }
  return sectionState;
}

function ensureDraftState(documentId: string, sectionId: string): DraftMetadataFixture {
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  if (!runtimeSection.draft) {
    runtimeSection.draft = {
      draftId: `draft-${sectionId}-fixture`,
      draftVersion: 1,
      draftBaseVersion: 0,
      latestApprovedVersion: 0,
      conflictState: 'clean',
      conflictReason: null,
      summaryNote: null,
      lastSavedAt: null,
      lastSavedBy: null,
      lastManualSaveAt: null,
      formattingWarnings: [],
    };
  } else if (!runtimeSection.draft.draftId) {
    runtimeSection.draft.draftId = `draft-${sectionId}-fixture`;
  }
  return runtimeSection.draft;
}

function formattingWarningsToAnnotations(warnings: FormattingWarningFixture[] | undefined): Array<{
  id: string;
  startOffset: number;
  endOffset: number;
  markType: string;
  message: string;
  severity: 'warning' | 'error';
}> {
  if (!warnings || warnings.length === 0) {
    return [];
  }

  return warnings.map(warning => ({
    id: warning.id,
    startOffset: warning.startOffset ?? 0,
    endOffset: warning.endOffset ?? warning.startOffset ?? 0,
    markType: warning.markType ?? 'text',
    message: warning.message,
    severity: warning.severity,
  }));
}

function buildDefaultConflictSnapshot(draft: DraftMetadataFixture): ConflictCheckFixture {
  return {
    status: draft.conflictState,
    latestApprovedVersion: draft.latestApprovedVersion ?? draft.draftBaseVersion ?? 0,
    conflictReason: draft.conflictReason ?? null,
    events: draft.conflictLog ? cloneValue(draft.conflictLog) : [],
  };
}

function parseRequest(req: IncomingMessage): ParsedRequest {
  if (!req.url) {
    return { kind: 'unknown' };
  }

  const url = new URL(req.url, 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] === '__fixtures') {
    segments.shift();
  }

  if (segments[0] === 'api' && segments[1] === 'v1') {
    segments.splice(1, 1);
  }

  if (segments.length === 0) {
    return { kind: 'unknown' };
  }

  if (segments[0] === 'api' && segments[1] === 'documents') {
    const documentId = segments[2];
    if (!documentId) {
      return { kind: 'unknown' };
    }

    if (segments.length >= 5 && segments[3] === 'sections') {
      const sectionId = segments[4];
      if (!sectionId) {
        return { kind: 'unknown' };
      }

      const tailStart = 5;
      const tailLength = segments.length - tailStart;

      if (segments[tailStart] === 'co-author') {
        if (segments.length === 7) {
          const action = segments[6];
          switch (action) {
            case 'analyze':
              return { kind: 'apiCoAuthorAnalyze', documentId, sectionId };
            case 'proposal':
              return { kind: 'apiCoAuthorProposal', documentId, sectionId };
            case 'apply':
              return { kind: 'apiCoAuthorApply', documentId, sectionId };
            case 'teardown':
              return { kind: 'apiCoAuthorTeardown', documentId, sectionId };
            default:
              break;
          }
        }

        if (segments.length === 8 && segments[6] === 'proposal' && segments[7] === 'reject') {
          return { kind: 'apiCoAuthorReject', documentId, sectionId };
        }
      }

      if (segments[tailStart] === 'assumptions' && tailLength >= 2) {
        const remainder = segments.slice(tailStart + 1);
        if (remainder.length === 1 && remainder[0] === 'session') {
          return { kind: 'apiAssumptionsStart', sectionId };
        }
      }
    }

    if (segments[3] === 'quality-gates') {
      if (segments.length === 5 && segments[4] === 'summary') {
        return { kind: 'apiDocumentQualitySummary', documentId };
      }
      if (segments.length === 5 && segments[4] === 'run') {
        return { kind: 'apiDocumentQualityRun', documentId };
      }
    }

    if (segments[3] === 'traceability') {
      if (segments.length === 4) {
        return { kind: 'apiDocumentTraceability', documentId };
      }
      if (segments.length === 5 && segments[4] === 'orphans') {
        return { kind: 'apiTraceabilityOrphan', documentId };
      }
    }

    return { kind: 'unknown' };
  }

  if (segments[0] === 'documents') {
    if (segments.length === 2) {
      const [, documentId] = segments;
      if (!documentId) {
        return { kind: 'unknown' };
      }
      return { kind: 'document', documentId };
    }
    if (segments.length === 4 && segments[2] === 'sections') {
      const [, documentId, , sectionId] = segments;
      if (!documentId || !sectionId) {
        return { kind: 'unknown' };
      }
      return { kind: 'section', documentId, sectionId };
    }
    return { kind: 'unknown' };
  }

  if (segments[0] === 'api' && segments[1] === 'sections') {
    const rawSectionId = segments[2];
    if (!rawSectionId) {
      return { kind: 'unknown' };
    }
    const sectionId = rawSectionId;

    const tailSegments = segments.slice(3);

    if (tailSegments[0] === 'assumptions') {
      if (tailSegments.length === 2 && tailSegments[1] === 'session') {
        return { kind: 'apiAssumptionsStart', sectionId };
      }
    }

    const tail = tailSegments.join('/');

    switch (tail) {
      case 'drafts':
        return { kind: 'apiSaveDraft', sectionId };
      case 'diff':
        return { kind: 'apiDiff', sectionId };
      case 'submit':
        return { kind: 'apiSubmitDraft', sectionId };
      case 'approve':
        return { kind: 'apiApprove', sectionId };
      case 'conflicts/check':
        return { kind: 'apiConflictsCheck', sectionId };
      case 'conflicts/logs':
        return { kind: 'apiConflictLogs', sectionId };
      default:
        return { kind: 'unknown' };
    }
  }

  if (segments[0] === 'api' && segments[1] === 'projects') {
    const projectIdentifier = segments[2];
    if (!projectIdentifier) {
      return { kind: 'unknown' };
    }

    if (segments.length === 4 && segments[3] === 'retention') {
      return { kind: 'apiProjectRetention', projectSlug: projectIdentifier };
    }

    if (segments.length === 5 && segments[3] === 'documents' && segments[4] === 'primary') {
      return { kind: 'apiProjectPrimaryDocument', projectId: projectIdentifier };
    }
  }

  if (segments[0] === 'api' && segments[1] === 'co-authoring' && segments[2] === 'sessions') {
    const sessionId = segments[3];
    if (!sessionId) {
      return { kind: 'unknown' };
    }
    if (segments.length === 5 && segments[4] === 'events') {
      return { kind: 'apiCoAuthorStream', sessionId };
    }
  }

  if (segments[0] === 'api' && segments[1] === 'auth' && segments[2] === 'simple') {
    if (segments.length === 4 && segments[3] === 'users') {
      return { kind: 'apiSimpleAuthUsers' };
    }
  }

  if (segments[0] === 'auth' && segments[1] === 'simple' && segments[2] === 'users') {
    return { kind: 'apiSimpleAuthUsers' };
  }

  return { kind: 'unknown' };
}

function cloneDocumentFixture(fixture: DocumentFixture): DocumentFixture {
  const clone = cloneValue(fixture);
  return documentFixtureSchema.parse(clone);
}

function cloneSectionFixture(fixture: SectionFixture): SectionFixture {
  const clone = cloneValue(fixture);
  return sectionFixtureSchema.parse(clone);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function handleDocumentResponse(res: ServerResponse, documentId: string) {
  const document = fixturesByDocumentId[documentId];
  if (!document) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, cloneDocumentFixture(document));
}

function handleSectionResponse(res: ServerResponse, documentId: string, sectionId: string) {
  const document = fixturesByDocumentId[documentId];
  if (!document) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const section = document.sections[sectionId];
  if (!section) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, cloneSectionFixture(section));
}

function handleProjectRetentionResponse(res: ServerResponse, projectSlug: string) {
  const policy = getProjectRetentionPolicy(projectSlug);
  if (!policy) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, {
    policyId: policy.policyId,
    retentionWindow: policy.retentionWindow,
    guidance: policy.guidance,
  });
}

function handlePrimaryDocumentSnapshotResponse(res: ServerResponse, projectId: string) {
  const snapshot = projectDocumentSnapshots[projectId];
  if (!snapshot) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, cloneValue(snapshot));
}

function handleSimpleAuthUsers(res: ServerResponse) {
  sendJson(res, 200, {
    users: simpleAuthUsersFixture,
  });
}

const STREAM_LOCATION_PREFIX = '/api/v1/co-authoring/sessions';

async function handleCoAuthorAnalyze(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string,
  sectionId: string
) {
  const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
  if (!fixtureSection || !fixtureSection.coAuthoring) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const requestSessionId =
    typeof payload.sessionId === 'string' && payload.sessionId.length > 0
      ? payload.sessionId
      : `${fixtureSection.coAuthoring.defaultSession.sessionId}-${Date.now()}`;

  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const runtime = ensureCoAuthoringRuntimeState(runtimeSection);
  runtime.activeSessionId = requestSessionId;
  runtime.pendingProposalId = null;

  const analyzeSummary = fixtureSection.coAuthoring.analyzeSummary;
  const documentFixture = fixturesByDocumentId[documentId];
  if (!documentFixture) {
    sendJson(res, 404, notFoundError);
    return;
  }
  const completedSectionCount =
    analyzeSummary?.completedSectionCount ??
    Object.values(documentFixture.sections).filter(section => section.lifecycleState === 'ready')
      .length;
  const knowledgeItemCount = Array.isArray(payload.knowledgeItemIds)
    ? payload.knowledgeItemIds.length
    : (analyzeSummary?.knowledgeItemCount ??
      fixtureSection.coAuthoring.defaultSession.knowledgeItemIds.length);
  const decisionCount = Array.isArray(payload.decisionIds)
    ? payload.decisionIds.length
    : (analyzeSummary?.decisionCount ??
      fixtureSection.coAuthoring.defaultSession.decisionIds.length);

  const response = {
    status: 'accepted' as const,
    sessionId: requestSessionId,
    contextSummary: {
      completedSectionCount,
      knowledgeItemCount,
      decisionCount,
    },
    audit: {
      documentId,
      sectionId,
      intent:
        typeof payload.intent === 'string' && payload.intent.length > 0
          ? payload.intent
          : fixtureSection.coAuthoring.defaultSession.intent,
    },
  };

  res.setHeader(
    'HX-Stream-Location',
    `${STREAM_LOCATION_PREFIX}/${encodeURIComponent(requestSessionId)}/events`
  );
  sendJson(res, 202, response);
}

async function handleCoAuthorProposal(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string,
  sectionId: string
) {
  const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
  if (!fixtureSection || !fixtureSection.coAuthoring) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const runtime = ensureCoAuthoringRuntimeState(runtimeSection);
  const sessionId =
    typeof payload.sessionId === 'string' && payload.sessionId.length > 0
      ? payload.sessionId
      : (runtime.activeSessionId ??
        `${fixtureSection.coAuthoring.defaultSession.sessionId}-${Date.now()}`);

  runtime.activeSessionId = sessionId;
  runtime.pendingProposalId = fixtureSection.coAuthoring.proposal.proposalId;

  const promptId =
    typeof payload.promptId === 'string' && payload.promptId.length > 0
      ? payload.promptId
      : (fixtureSection.coAuthoring.proposal.annotations[0]?.promptId ?? 'prompt-improve-1');

  const response = {
    status: 'accepted' as const,
    sessionId,
    diffPreview: {
      mode: fixtureSection.coAuthoring.proposal.diff.mode,
      pendingProposalId: fixtureSection.coAuthoring.proposal.pendingProposalId,
    },
    audit: {
      documentId,
      sectionId,
      intent:
        typeof payload.intent === 'string' && payload.intent.length > 0
          ? payload.intent
          : fixtureSection.coAuthoring.defaultSession.intent,
      promptId,
    },
  };

  res.setHeader(
    'HX-Stream-Location',
    `${STREAM_LOCATION_PREFIX}/${encodeURIComponent(sessionId)}/events`
  );
  sendJson(res, 202, response);
}

async function handleCoAuthorApply(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string,
  sectionId: string
) {
  const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
  if (!fixtureSection || !fixtureSection.coAuthoring) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const runtime = ensureCoAuthoringRuntimeState(runtimeSection);
  runtime.pendingProposalId = null;

  const response = {
    status: 'queued' as const,
    changelog: {
      entryId: fixtureSection.coAuthoring.apply.entryId,
      summary: fixtureSection.coAuthoring.apply.changelogSummary,
      confidence: fixtureSection.coAuthoring.apply.confidence,
      citations: fixtureSection.coAuthoring.apply.citations,
      proposalId:
        typeof payload.proposalId === 'string' && payload.proposalId.length > 0
          ? payload.proposalId
          : fixtureSection.coAuthoring.proposal.proposalId,
    },
    queue: {
      draftVersion: fixtureSection.coAuthoring.apply.draftVersion,
      diffHash: fixtureSection.coAuthoring.apply.diffHash,
    },
  };

  sendJson(res, 200, response);
}

async function handleCoAuthorReject(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string,
  sectionId: string
) {
  const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
  if (!fixtureSection || !fixtureSection.coAuthoring) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const runtime = ensureCoAuthoringRuntimeState(runtimeSection);

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;
  const proposalId = typeof payload.proposalId === 'string' ? payload.proposalId : null;

  if (sessionId && runtime.activeSessionId === sessionId) {
    runtime.pendingProposalId = null;
    if (proposalId && fixtureSection.coAuthoring.proposal.pendingProposalId === proposalId) {
      runtimeSection.diff = null;
    }
  }

  sendJson(res, 200, { status: 'dismissed' });
}

async function handleCoAuthorTeardown(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string,
  sectionId: string
) {
  const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
  if (!fixtureSection || !fixtureSection.coAuthoring) {
    sendJson(res, 404, notFoundError);
    return;
  }

  await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const runtime = ensureCoAuthoringRuntimeState(runtimeSection);

  runtime.pendingProposalId = null;
  runtime.activeSessionId = null;

  sendJson(res, 200, { status: 'teardown' });
}

function materializeStreamEvents(
  events: CoAuthoringStreamEventFixture[],
  sessionId: string,
  fixture: CoAuthoringFixture
): CoAuthoringStreamEventFixture[] {
  return events.map(event => {
    switch (event.type) {
      case 'progress':
        return { ...event };
      case 'token':
        return { ...event };
      case 'analysis.completed':
        return { ...event, sessionId };
      case 'error':
        return { ...event };
      case 'proposal.ready': {
        const diffSource = event.diff ?? fixture.proposal.diff;
        const annotationsSource =
          event.annotations && event.annotations.length > 0
            ? event.annotations
            : (fixture.proposal.annotations ?? []);
        return {
          type: 'proposal.ready',
          proposalId: event.proposalId ?? fixture.proposal.proposalId,
          diff: {
            mode: diffSource.mode,
            segments: diffSource.segments.map(segment => ({
              ...segment,
              segmentId: replaceSessionToken(segment.segmentId, sessionId),
            })),
          },
          annotations: annotationsSource.map(annotation => ({
            ...annotation,
            segmentId: replaceSessionToken(annotation.segmentId, sessionId),
            originTurnId: annotation.originTurnId
              ? replaceSessionToken(annotation.originTurnId, sessionId)
              : annotation.originTurnId,
          })),
          confidence: event.confidence ?? fixture.proposal.confidence,
          citations:
            event.citations && event.citations.length > 0
              ? event.citations
              : fixture.proposal.citations,
          expiresAt: event.expiresAt ?? fixture.proposal.expiresAt,
          diffHash: event.diffHash ?? fixture.proposal.diffHash,
        } satisfies CoAuthoringStreamEventFixture;
      }
      default:
        return event;
    }
  });
}

function buildFallbackStreamEvents(
  sessionId: string,
  fixture: CoAuthoringFixture
): CoAuthoringStreamEventFixture[] {
  return materializeStreamEvents(
    [
      { type: 'progress', status: 'streaming', elapsedMs: 1500 },
      {
        type: 'proposal.ready',
        proposalId: fixture.proposal.proposalId,
        diff: fixture.proposal.diff,
        annotations: fixture.proposal.annotations ?? [],
        confidence: fixture.proposal.confidence,
        citations: fixture.proposal.citations,
        expiresAt: fixture.proposal.expiresAt,
        diffHash: fixture.proposal.diffHash,
      },
      {
        type: 'analysis.completed',
        timestamp: new Date().toISOString(),
        sessionId,
      },
    ],
    sessionId,
    fixture
  );
}

function handleCoAuthorStream(req: IncomingMessage, res: ServerResponse, sessionId: string) {
  const context = findCoAuthoringFixtureForSession(sessionId);
  if (!context) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const eventsSource =
    context.fixture.streamEvents.length > 0
      ? materializeStreamEvents(context.fixture.streamEvents, sessionId, context.fixture)
      : buildFallbackStreamEvents(sessionId, context.fixture);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(': co-authoring fixture stream\n\n');

  if (eventsSource.length === 0) {
    res.end();
    return;
  }

  const timers: NodeJS.Timeout[] = [];

  const cleanup = () => {
    while (timers.length > 0) {
      const timer = timers.pop();
      if (timer) {
        clearTimeout(timer);
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  };

  eventsSource.forEach((event, index) => {
    const timer = setTimeout(() => {
      if (res.writableEnded) {
        return;
      }
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (index === eventsSource.length - 1) {
        cleanup();
      }
    }, index * 150);
    timers.push(timer);
  });

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
}

async function handleSaveDraft(req: IncomingMessage, res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const fixtureDocument = fixturesByDocumentId[documentId];
  if (!fixtureDocument) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const draft = ensureDraftState(documentId, sectionId);

  const summaryInput = typeof payload.summaryNote === 'string' ? payload.summaryNote.trim() : '';
  if (summaryInput.length > 0) {
    draft.summaryNote = summaryInput;
  }

  const requestedDraftVersion =
    typeof payload.draftVersion === 'number' ? payload.draftVersion : (draft.draftVersion ?? 1);
  const requestedBaseVersion =
    typeof payload.draftBaseVersion === 'number'
      ? payload.draftBaseVersion
      : (draft.draftBaseVersion ?? 0);

  draft.draftVersion = requestedDraftVersion;
  draft.draftBaseVersion = requestedBaseVersion;
  draft.latestApprovedVersion = draft.latestApprovedVersion ?? requestedBaseVersion;
  draft.conflictState = 'clean';
  draft.conflictReason = null;

  const manualBase =
    typeof draft.lastManualSaveAt === 'number'
      ? draft.lastManualSaveAt
      : Date.parse(fixtureDocument.updatedAt ?? new Date().toISOString());
  const nextManualSaveAt = manualBase + SAVE_INCREMENT_MS;
  draft.lastManualSaveAt = nextManualSaveAt;
  draft.lastSavedAt = new Date(nextManualSaveAt).toISOString();
  draft.lastSavedBy = draft.lastSavedBy ?? 'CTRL FreaQ Fixture Reviewer';

  const contentMarkdown =
    typeof payload.contentMarkdown === 'string' ? payload.contentMarkdown : null;
  if (
    contentMarkdown &&
    contentMarkdown.includes('Updated introduction copy for architecture overview.')
  ) {
    runtimeSection.diff = {
      mode: 'unified',
      segments: [
        {
          type: 'context',
          content: '## CTRL FreaQ Architecture Overview',
          startLine: 1,
        },
        {
          type: 'removed',
          content: '- Documented APIs for every integration point',
          startLine: 4,
        },
        {
          type: 'added',
          content: '- Updated introduction copy for architecture overview.',
          startLine: 4,
        },
        {
          type: 'added',
          content: '- Documented APIs for every integration point',
          startLine: 5,
        },
      ],
      metadata: {
        approvedVersion: draft.latestApprovedVersion ?? requestedBaseVersion,
        draftVersion: draft.draftVersion,
        generatedAt: new Date(nextManualSaveAt + DIFF_GENERATED_OFFSET_MS).toISOString(),
      },
    };
  }

  const response = {
    draftId: draft.draftId,
    sectionId,
    draftVersion: draft.draftVersion,
    conflictState: draft.conflictState,
    formattingAnnotations: formattingWarningsToAnnotations(draft.formattingWarnings),
    savedAt: draft.lastSavedAt,
    savedBy: draft.lastSavedBy,
    summaryNote: draft.summaryNote ?? null,
  };

  sendJson(res, 202, response);
}

function handleDiff(res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const runtimeSection = getRuntimeSection(documentId, sectionId);
  if (!runtimeSection.diff) {
    sendJson(res, 200, { mode: 'unified', segments: [], metadata: { draftVersion: 0 } });
    return;
  }

  sendJson(res, 200, cloneValue(runtimeSection.diff));
}

async function handleSubmitDraft(req: IncomingMessage, res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const draft = ensureDraftState(documentId, sectionId);

  const summaryInput = typeof payload.summaryNote === 'string' ? payload.summaryNote.trim() : '';
  const resolvedSummary =
    summaryInput.length > 0
      ? summaryInput
      : (runtimeSection.review?.summaryNote ?? draft.summaryNote ?? null);

  if (!runtimeSection.review) {
    runtimeSection.review = {
      reviewId: `review-${sectionId}-fixture`,
      status: 'pending',
      submittedAt:
        draft.lastSavedAt ?? new Date(draft.lastManualSaveAt ?? Date.now()).toISOString(),
      submittedBy: draft.lastSavedBy ?? 'CTRL FreaQ Fixture Reviewer',
      summaryNote: resolvedSummary,
    };
  } else {
    runtimeSection.review.status = 'pending';
    runtimeSection.review.submittedAt =
      draft.lastSavedAt ?? runtimeSection.review.submittedAt ?? new Date().toISOString();
    runtimeSection.review.submittedBy =
      draft.lastSavedBy ?? runtimeSection.review.submittedBy ?? 'CTRL FreaQ Fixture Reviewer';
    runtimeSection.review.summaryNote = resolvedSummary;
  }

  const response = {
    reviewId: runtimeSection.review.reviewId,
    sectionId,
    status: runtimeSection.review.status,
    submittedAt: runtimeSection.review.submittedAt,
    submittedBy: runtimeSection.review.submittedBy,
    summaryNote: runtimeSection.review.summaryNote ?? null,
  };

  sendJson(res, 200, response);
}

async function handleApproveSection(req: IncomingMessage, res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const runtimeSection = getRuntimeSection(documentId, sectionId);
  const draft = ensureDraftState(documentId, sectionId);
  const fixtureDocument = fixturesByDocumentId[documentId];
  if (!fixtureDocument) {
    sendJson(res, 404, notFoundError);
    return;
  }

  if (!runtimeSection.approval) {
    const fixtureSection = fixtureDocument.sections[sectionId];
    runtimeSection.approval = fixtureSection?.approval
      ? cloneValue(fixtureSection.approval)
      : {
          approvedVersion: draft.draftVersion,
          approvedAt: draft.lastSavedAt ?? new Date().toISOString(),
          approvedBy: draft.lastSavedBy ?? 'CTRL FreaQ Fixture Approver',
          approvedContent: fixtureSection?.content ?? '',
          reviewerSummary: draft.summaryNote ?? null,
        };
  }

  const approval = runtimeSection.approval;
  if (!approval) {
    sendJson(res, 500, internalError);
    return;
  }
  approval.approvedVersion = approval.approvedVersion ?? draft.draftVersion;
  approval.approvedAt = approval.approvedAt || draft.lastSavedAt || new Date().toISOString();
  approval.approvedBy = approval.approvedBy || draft.lastSavedBy || 'CTRL FreaQ Fixture Approver';

  const noteInput = typeof payload.approvalNote === 'string' ? payload.approvalNote.trim() : '';
  if (noteInput.length > 0) {
    approval.reviewerSummary = noteInput;
  } else if (
    draft.summaryNote &&
    (!approval.reviewerSummary || approval.reviewerSummary.length === 0)
  ) {
    approval.reviewerSummary = draft.summaryNote;
  }

  draft.latestApprovedVersion = approval.approvedVersion;
  draft.conflictState = 'clean';
  draft.conflictReason = null;

  const response = {
    sectionId,
    approvedVersion: approval.approvedVersion,
    approvedContent: approval.approvedContent,
    approvedAt: approval.approvedAt ?? new Date().toISOString(),
    approvedBy: approval.approvedBy ?? 'CTRL FreaQ Fixture Approver',
    requestId: `fixture-approve-${sectionId}`,
  };

  sendJson(res, 200, response);
}

async function handleConflictsCheck(req: IncomingMessage, res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  await readJsonBody(req);

  const draft = ensureDraftState(documentId, sectionId);
  const snapshot = draft.conflictSnapshot
    ? cloneValue(draft.conflictSnapshot)
    : buildDefaultConflictSnapshot(draft);

  if ((!snapshot.events || snapshot.events.length === 0) && draft.conflictLog) {
    snapshot.events = cloneValue(draft.conflictLog);
  }

  snapshot.status = 'clean';
  snapshot.conflictReason = null;
  draft.conflictState = 'clean';
  draft.conflictReason = null;

  sendJson(res, 200, snapshot);
}

function handleConflictLogs(res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const draft = ensureDraftState(documentId, sectionId);
  const events = draft.conflictLog ? cloneValue(draft.conflictLog) : [];
  sendJson(res, 200, { events });
}

function handleAssumptionsStart(res: ServerResponse, sectionId: string) {
  const documentId = resolveDocumentIdForSection(sectionId);
  if (!documentId) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const document = fixturesByDocumentId[documentId];
  const section = document?.sections[sectionId];
  const assumptionSession = section?.assumptionSession;

  if (!document || !section || !assumptionSession) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const flowState = convertFixtureSessionToFlowState(assumptionSession);

  sendJson(res, 200, {
    sessionId: flowState.sessionId,
    sectionId,
    prompts: flowState.prompts,
    overridesOpen: flowState.overridesOpen,
    summaryMarkdown: flowState.summaryMarkdown,
  });
}

function handleDocumentQualitySummary(res: ServerResponse, documentId: string) {
  const document = fixturesByDocumentId[documentId];
  if (!document?.quality?.summary) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, cloneValue(document.quality.summary));
}

function handleDocumentTraceability(res: ServerResponse, documentId: string) {
  const document = fixturesByDocumentId[documentId];
  if (!document?.quality?.traceability) {
    sendJson(res, 404, notFoundError);
    return;
  }

  sendJson(res, 200, {
    documentId,
    requirements: cloneValue(document.quality.traceability),
  });
}

function handleDocumentQualityRun(res: ServerResponse, documentId: string) {
  const document = fixturesByDocumentId[documentId];
  const summary = document?.quality?.summary;
  sendJson(res, 202, {
    status: 'running' as const,
    requestId: summary?.requestId ?? `req-${documentId}-quality`,
    runId: `run-${documentId}`,
    documentId,
    triggeredBy: summary?.triggeredBy ?? 'user-fixture',
    receivedAt: new Date().toISOString(),
  });
}

async function handleTraceabilityOrphan(
  req: IncomingMessage,
  res: ServerResponse,
  documentId: string
) {
  const document = fixturesByDocumentId[documentId];
  if (!document?.quality?.traceability) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const payload = await readJsonBody(req);
  const requirementId = typeof payload.requirementId === 'string' ? payload.requirementId : '';
  const sectionId = typeof payload.sectionId === 'string' ? payload.sectionId : '';
  const reason =
    typeof payload.reason === 'string'
      ? (payload.reason as 'no-link' | 'blocker' | 'warning-override')
      : 'no-link';

  if (!requirementId || !sectionId) {
    sendJson(res, 400, {
      code: 'fixtures.invalid_payload',
      message: 'Requirement identifier and section identifier are required.',
    });
    return;
  }

  const requirement = document.quality.traceability.find(
    entry => entry.requirementId === requirementId
  );

  if (!requirement) {
    sendJson(res, 404, notFoundError);
    return;
  }

  const coverageStatus =
    reason === 'blocker' ? 'blocker' : reason === 'warning-override' ? 'warning' : 'orphaned';

  requirement.coverageStatus = coverageStatus;
  requirement.lastValidatedAt = new Date().toISOString();
  requirement.validatedBy = 'user-fixture';

  sendJson(res, 200, {
    requirementId,
    sectionId,
    coverageStatus,
    reason,
    lastValidatedAt: requirement.lastValidatedAt,
    validatedBy: requirement.validatedBy,
  });
}

export type FixtureRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => void | Promise<void>;

export const createFixtureRequestHandler = (): FixtureRequestHandler => {
  return async (req, res, next) => {
    try {
      const parsed = parseRequest(req);

      switch (parsed.kind) {
        case 'document': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleDocumentResponse(res, parsed.documentId);
          return;
        }
        case 'section': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleSectionResponse(res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiProjectPrimaryDocument': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handlePrimaryDocumentSnapshotResponse(res, parsed.projectId);
          return;
        }
        case 'apiSaveDraft': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleSaveDraft(req, res, parsed.sectionId);
          return;
        }
        case 'apiDiff': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleDiff(res, parsed.sectionId);
          return;
        }
        case 'apiSubmitDraft': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleSubmitDraft(req, res, parsed.sectionId);
          return;
        }
        case 'apiApprove': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleApproveSection(req, res, parsed.sectionId);
          return;
        }
        case 'apiConflictsCheck': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleConflictsCheck(req, res, parsed.sectionId);
          return;
        }
        case 'apiConflictLogs': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleConflictLogs(res, parsed.sectionId);
          return;
        }
        case 'apiAssumptionsStart': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleAssumptionsStart(res, parsed.sectionId);
          return;
        }
        case 'apiDocumentQualitySummary': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleDocumentQualitySummary(res, parsed.documentId);
          return;
        }
        case 'apiDocumentQualityRun': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleDocumentQualityRun(res, parsed.documentId);
          return;
        }
        case 'apiDocumentTraceability': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleDocumentTraceability(res, parsed.documentId);
          return;
        }
        case 'apiTraceabilityOrphan': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleTraceabilityOrphan(req, res, parsed.documentId);
          return;
        }
        case 'apiProjectRetention': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleProjectRetentionResponse(res, parsed.projectSlug);
          return;
        }
        case 'apiSimpleAuthUsers': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleSimpleAuthUsers(res);
          return;
        }
        case 'apiCoAuthorAnalyze': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleCoAuthorAnalyze(req, res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiCoAuthorProposal': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleCoAuthorProposal(req, res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiCoAuthorApply': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleCoAuthorApply(req, res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiCoAuthorReject': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleCoAuthorReject(req, res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiCoAuthorTeardown': {
          if (req.method !== 'POST') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          await handleCoAuthorTeardown(req, res, parsed.documentId, parsed.sectionId);
          return;
        }
        case 'apiCoAuthorStream': {
          if (req.method && req.method !== 'GET') {
            sendJson(res, 405, methodNotAllowedError);
            return;
          }
          handleCoAuthorStream(req, res, parsed.sessionId);
          return;
        }
        default:
          next();
          return;
      }
    } catch (error) {
      void error;
      sendJson(res, 500, internalError);
    }
  };
};

export const getDocumentFixture = (documentId: string): DocumentFixture => {
  const candidate = fixturesByDocumentId[documentId];
  if (!candidate) {
    throw new Error(`Unknown document fixture: ${documentId}`);
  }
  return cloneDocumentFixture(assertDocumentFixture(candidate));
};

export const getSectionFixture = (documentId: string, sectionId: string): SectionFixture => {
  const candidate = fixturesByDocumentId[documentId];
  if (!candidate) {
    throw new Error(`Unknown document fixture: ${documentId}`);
  }

  const normalized = normalizeSectionId(sectionId);
  const section = candidate.sections[normalized];
  if (!section) {
    throw new Error(`Unknown section fixture: ${documentId}/${normalized}`);
  }

  return cloneSectionFixture(assertSectionFixture(section));
};

function getSectionFixtureRecord(documentId: string, sectionId: string): SectionFixture | null {
  const candidate = fixturesByDocumentId[documentId];
  if (!candidate) {
    return null;
  }
  const normalized = normalizeSectionId(sectionId);
  return candidate.sections[normalized] ?? null;
}

function ensureCoAuthoringRuntimeState(
  state: RuntimeSectionState
): NonNullable<RuntimeSectionState['coAuthoring']> {
  if (!state.coAuthoring) {
    state.coAuthoring = {
      activeSessionId: null,
      pendingProposalId: null,
    };
  }
  return state.coAuthoring;
}

const SESSION_PLACEHOLDER = 'session-coauthor-demo-001';

const replaceSessionToken = (value: string, sessionId: string): string => {
  return value.includes(SESSION_PLACEHOLDER)
    ? value.split(SESSION_PLACEHOLDER).join(sessionId)
    : value;
};

function findCoAuthoringFixtureForSession(sessionId: string): {
  documentId: string;
  sectionId: string;
  fixture: CoAuthoringFixture;
  runtime: RuntimeSectionState;
} | null {
  for (const [documentId, documentState] of Object.entries(runtimeDocuments)) {
    for (const [sectionId, sectionState] of Object.entries(documentState.sections)) {
      const coAuthorState = sectionState.coAuthoring;
      if (coAuthorState?.activeSessionId === sessionId) {
        const fixtureSection = getSectionFixtureRecord(documentId, sectionId);
        if (fixtureSection?.coAuthoring) {
          return {
            documentId,
            sectionId,
            fixture: fixtureSection.coAuthoring,
            runtime: sectionState,
          };
        }
      }
    }
  }

  for (const [documentId, document] of Object.entries(fixturesByDocumentId)) {
    for (const [sectionId, section] of Object.entries(document.sections)) {
      if (section.coAuthoring?.defaultSession.sessionId === sessionId) {
        const runtime = getRuntimeSection(documentId, sectionId);
        ensureCoAuthoringRuntimeState(runtime);
        return { documentId, sectionId, fixture: section.coAuthoring, runtime };
      }
    }
  }

  return null;
}

export const listDocumentIds = (): string[] => Object.keys(fixturesByDocumentId);

export const listSectionIds = (documentId: string): string[] => {
  const document = fixturesByDocumentId[documentId];
  if (!document) {
    return [];
  }
  return Object.keys(document.sections);
};

export const fixtureErrors = {
  notFound: notFoundError,
  methodNotAllowed: methodNotAllowedError,
  internal: internalError,
};

export type { DocumentFixture, SectionFixture };
