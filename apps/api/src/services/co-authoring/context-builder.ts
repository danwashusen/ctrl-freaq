export interface BuildCoAuthorContextDependencies {
  fetchDocumentSnapshot: (documentId: string) => Promise<{
    documentId: string;
    title: string;
    sections: Array<{
      sectionId: string;
      path: string;
      status: 'completed' | 'draft' | string;
      content: string;
    }>;
  }>;
  fetchActiveSectionDraft: (input: { documentId: string; sectionId: string }) => Promise<{
    content: string;
    baselineVersion?: string;
    draftVersion?: number;
  } | null>;
  fetchDecisionSummaries: (input: {
    decisionIds: string[];
  }) => Promise<Array<{ id: string; summary: string }>>;
  fetchKnowledgeItems: (input: {
    knowledgeItemIds: string[];
  }) => Promise<Array<{ id: string; excerpt: string }>>;
  clarifications: string[];
}

export interface BuildCoAuthorContextInput {
  documentId: string;
  sectionId: string;
  authorId: string;
  knowledgeItemIds: string[];
  decisionIds: string[];
}

export interface ProviderContextPayload {
  documentId: string;
  sectionId: string;
  documentTitle: string;
  completedSections: Array<{ path: string; content: string }>;
  currentDraft: string;
  decisionSummaries: Array<{ id: string; summary: string }>;
  knowledgeItems: Array<{ id: string; excerpt: string }>;
  clarifications: string[];
}

import { createProviderContextPayload } from '@ctrl-freaq/shared-data';

export async function buildCoAuthorContext(
  dependencies: BuildCoAuthorContextDependencies,
  input: BuildCoAuthorContextInput
): Promise<ProviderContextPayload> {
  const {
    fetchDocumentSnapshot,
    fetchActiveSectionDraft,
    fetchDecisionSummaries,
    fetchKnowledgeItems,
    clarifications,
  } = dependencies;

  const { documentId, sectionId, knowledgeItemIds, decisionIds } = input;

  const documentSnapshot = await fetchDocumentSnapshot(documentId);

  const targetSection = documentSnapshot.sections.find(section => section.sectionId === sectionId);
  if (!targetSection) {
    throw Object.assign(new Error(`Section ${sectionId} is outside the allowed document scope`), {
      code: 'SCOPE_VIOLATION',
    });
  }

  const completedSections = documentSnapshot.sections
    .filter(section => section.status === 'completed')
    .map(section => ({ path: section.path, content: section.content }));

  const [draft, decisionSummaries, knowledgeItems] = await Promise.all([
    fetchActiveSectionDraft({ documentId, sectionId }),
    fetchDecisionSummaries({ decisionIds }),
    fetchKnowledgeItems({ knowledgeItemIds }),
  ]);

  const activeContent = draft?.content ?? targetSection.content ?? '';

  if (!completedSections.some(section => section.path === targetSection.path)) {
    completedSections.push({
      path: targetSection.path,
      content: activeContent,
    });
  }

  return createProviderContextPayload({
    documentId: documentSnapshot.documentId,
    sectionId,
    documentTitle: documentSnapshot.title,
    completedSections,
    currentDraft: activeContent,
    decisionSummaries,
    knowledgeItems,
    clarifications,
  });
}
