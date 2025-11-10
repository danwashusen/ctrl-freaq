import type { SectionView } from '@/features/document-editor/types/section-view';
import type { TableOfContents, TocNode } from '@/features/document-editor/types/table-of-contents';

import type {
  AssumptionSessionFixture,
  DocumentFixture,
  RetentionPolicyFixture,
  SectionFixture,
  SectionReference,
} from './types';
import type { AssumptionFlowState } from '@/features/document-editor/assumptions-flow';
import type { AssumptionPromptState } from '@/features/document-editor/types/assumption-session';

type DocumentStoreStatus = 'draft' | 'review' | 'published';

interface FixtureDocumentView {
  documentId: string;
  title: string;
  summary: string;
  lifecycleStatus: DocumentStoreStatus;
  updatedAt: string;
  projectId: string;
  projectSlug: string;
  sections: SectionView[];
  toc: TableOfContents;
  assumptionSessions: Record<string, AssumptionFlowState | null>;
  retentionPolicy: RetentionPolicyFixture | null;
}

const sectionStatusToStoreStatus: Record<'draft' | 'review' | 'ready', DocumentStoreStatus> = {
  draft: 'draft',
  review: 'review',
  ready: 'published',
};

const lifecycleStateToSectionStatus: Record<
  SectionFixture['lifecycleState'],
  SectionView['status']
> = {
  idle: 'idle',
  assumptions: 'assumptions',
  drafting: 'drafting',
  review: 'review',
  ready: 'ready',
};

const mapFixtureQuestionToPrompt = (
  question: AssumptionSessionFixture['questions'][number],
  index: number,
  unresolvedCount: number
): AssumptionPromptState => ({
  id: question.id,
  heading: question.prompt,
  body: question.prompt,
  responseType: 'text',
  options: [],
  priority: index,
  status: question.status === 'resolved' ? 'answered' : 'pending',
  answer: question.decision ?? null,
  overrideJustification: null,
  unresolvedOverrideCount: question.status === 'resolved' ? 0 : unresolvedCount,
});

export const convertFixtureSessionToFlowState = (
  session: AssumptionSessionFixture
): AssumptionFlowState => {
  const prompts = session.questions.map((question, index) =>
    mapFixtureQuestionToPrompt(question, index, session.unresolvedCount)
  );

  const promptsRemaining = prompts.filter(prompt => prompt.status !== 'answered').length;
  const summaryMarkdown = session.transcript
    .map(message => `**${message.speaker}:** ${message.content}`)
    .join('\n');
  const proposalHistory = session.proposals.map(proposal => ({
    proposalId: proposal.proposalId,
    proposalIndex: proposal.proposalIndex,
  }));

  return {
    sessionId: session.sessionId,
    prompts,
    promptsRemaining,
    overridesOpen: session.unresolvedCount,
    summaryMarkdown: summaryMarkdown.length > 0 ? summaryMarkdown : null,
    proposalHistory,
  };
};

function resolveQualityGateStatus(section: SectionFixture): SectionView['qualityGateStatus'] {
  if (section.lifecycleState === 'ready') {
    return 'passed';
  }
  if (section.lifecycleState === 'review') {
    return 'pending';
  }
  return null;
}

export function buildSectionViewFromFixture(
  documentId: string,
  section: SectionFixture,
  orderIndex: number
): SectionView {
  const hasContent = section.content.trim().length > 0;
  const status = lifecycleStateToSectionStatus[section.lifecycleState];
  const approvedVersion = section.approval?.approvedVersion ?? (status === 'ready' ? 3 : null);
  const approvedAt =
    section.approval?.approvedAt ?? (approvedVersion ? section.lastUpdatedAt : null);
  const approvedBy =
    section.approval?.approvedBy ?? (approvedVersion ? section.lastAuthoredBy : null);

  const draftMetadata = section.draft ?? null;
  const draftId = draftMetadata?.draftId ?? null;
  const draftVersion = draftMetadata?.draftVersion ?? (approvedVersion ? approvedVersion + 1 : 1);
  const draftBaseVersion = draftMetadata?.draftBaseVersion ?? approvedVersion ?? 0;
  const latestApprovedVersion = draftMetadata?.latestApprovedVersion ?? approvedVersion ?? null;
  const conflictState = draftMetadata?.conflictState ?? 'clean';
  const conflictReason = draftMetadata?.conflictReason ?? null;
  const summaryNote = draftMetadata?.summaryNote ?? section.approval?.reviewerSummary ?? null;
  const lastSavedAt = draftMetadata?.lastSavedAt ?? section.lastUpdatedAt;
  const lastSavedBy = draftMetadata?.lastSavedBy ?? section.lastAuthoredBy;
  const lastManualSaveAt = draftMetadata?.lastManualSaveAt ?? null;

  return {
    id: section.id,
    docId: documentId,
    parentSectionId: null,
    key: section.id,
    title: section.title,
    depth: 0,
    orderIndex,
    contentMarkdown: section.content,
    placeholderText: 'Content forthcoming for this section.',
    hasContent,
    viewState: 'read_mode',
    editingUser: null,
    lastModified: section.lastUpdatedAt,
    status,
    assumptionsResolved: (section.assumptionSession?.unresolvedCount ?? 0) === 0,
    qualityGateStatus: resolveQualityGateStatus(section),
    approvedVersion,
    approvedAt,
    approvedBy,
    lastSummary:
      section.approval?.reviewerSummary ??
      (approvedVersion ? 'Fixture-approved summary available for deterministic assertions.' : null),
    draftId,
    draftVersion,
    draftBaseVersion,
    latestApprovedVersion,
    conflictState,
    conflictReason,
    summaryNote,
    lastSavedAt,
    lastSavedBy,
    lastManualSaveAt,
  };
}

function buildTocNode(
  reference: SectionReference,
  section: SectionView,
  orderIndex: number
): TocNode {
  return {
    sectionId: reference.id,
    title: reference.title,
    depth: section.depth,
    orderIndex,
    hasContent: section.hasContent,
    status: section.status,
    isExpanded: false,
    isActive: false,
    isVisible: false,
    hasUnsavedChanges: false,
    children: [],
    parentId: null,
  };
}

export function buildFixtureDocumentView(document: DocumentFixture): FixtureDocumentView {
  const documentStatus = sectionStatusToStoreStatus[document.lifecycleStatus];
  const sections: SectionView[] = [];
  const assumptionSessions: Record<string, AssumptionFlowState | null> = {};
  const tocNodes: TocNode[] = [];

  document.tableOfContents.forEach((reference, index) => {
    const sectionFixture = document.sections[reference.id];
    if (!sectionFixture) {
      return;
    }
    const sectionView = buildSectionViewFromFixture(document.id, sectionFixture, index);
    sections.push(sectionView);
    tocNodes.push(buildTocNode(reference, sectionView, index));
    assumptionSessions[reference.id] = sectionFixture.assumptionSession
      ? convertFixtureSessionToFlowState(sectionFixture.assumptionSession)
      : null;
  });

  const toc: TableOfContents = {
    documentId: document.id,
    sections: tocNodes,
    lastUpdated: document.updatedAt,
  };

  return {
    documentId: document.id,
    title: document.title,
    summary: document.summary,
    lifecycleStatus: documentStatus,
    updatedAt: document.updatedAt,
    projectId: document.projectId ?? document.projectSlug ?? 'project-test',
    projectSlug: document.projectSlug ?? 'project-test',
    sections,
    toc,
    assumptionSessions,
    retentionPolicy: document.retentionPolicy ?? null,
  };
}

export type { FixtureDocumentView };
