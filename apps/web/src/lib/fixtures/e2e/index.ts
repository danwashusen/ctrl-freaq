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
} from './types';
import { demoArchitectureDocument } from './demo-architecture';
import { convertFixtureSessionToFlowState } from './transformers';

const fixturesByDocumentId: Record<string, DocumentFixture> = {
  [demoArchitectureDocument.id]: demoArchitectureDocument,
};

interface RuntimeSectionState {
  draft: DraftMetadataFixture | null;
  diff: DiffFixture | null;
  review: ReviewSubmissionFixture | null;
  approval: ApprovalFixture | null;
}

interface RuntimeDocumentState {
  sections: Record<string, RuntimeSectionState>;
}

const sectionToDocumentMap = new Map<string, string>();
const runtimeDocuments: Record<string, RuntimeDocumentState> = initializeRuntimeDocuments();

const SAVE_INCREMENT_MS = 30_000;
const DIFF_GENERATED_OFFSET_MS = 5_000;

type ParsedRequest =
  | { kind: 'document'; documentId: string }
  | { kind: 'section'; documentId: string; sectionId: string }
  | { kind: 'apiSaveDraft'; sectionId: string }
  | { kind: 'apiDiff'; sectionId: string }
  | { kind: 'apiSubmitDraft'; sectionId: string }
  | { kind: 'apiApprove'; sectionId: string }
  | { kind: 'apiConflictsCheck'; sectionId: string }
  | { kind: 'apiConflictLogs'; sectionId: string }
  | { kind: 'apiAssumptionsStart'; sectionId: string }
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
  return sectionToDocumentMap.get(sectionId) ?? null;
}

function getRuntimeSection(documentId: string, sectionId: string): RuntimeSectionState {
  const documentState = runtimeDocuments[documentId];
  if (!documentState) {
    throw new Error(`Unknown fixture document state for: ${documentId}`);
  }
  const sectionState = documentState.sections[sectionId];
  if (!sectionState) {
    throw new Error(`Unknown fixture section state for: ${documentId}/${sectionId}`);
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

  if (segments.length === 0) {
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

  const section = candidate.sections[sectionId];
  if (!section) {
    throw new Error(`Unknown section fixture: ${documentId}/${sectionId}`);
  }

  return cloneSectionFixture(assertSectionFixture(section));
};

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
