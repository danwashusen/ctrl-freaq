import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDocumentBootstrap } from './use-document-bootstrap';
import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import type { SectionView } from '../types/section-view';

const mockApi = {
  client: {
    getDocument: vi.fn(),
    getDocumentSections: vi.fn(),
  },
  projects: {
    getById: vi.fn(),
  },
};

vi.mock('@/lib/api-context', () => ({
  useApi: () => mockApi,
}));

const buildSection = (overrides: Partial<SectionView> = {}): SectionView => {
  const now = new Date().toISOString();
  return {
    id: 'sec-1',
    docId: 'doc-123',
    parentSectionId: null,
    key: 'introduction',
    title: 'Introduction',
    depth: 0,
    orderIndex: 0,
    contentMarkdown: '# Intro',
    placeholderText: '',
    hasContent: true,
    viewState: 'read_mode',
    editingUser: null,
    lastModified: now,
    status: 'drafting',
    assumptionsResolved: false,
    qualityGateStatus: null,
    approvedVersion: 1,
    approvedAt: now,
    approvedBy: 'user-1',
    lastSummary: null,
    draftId: 'draft-1',
    draftVersion: 1,
    draftBaseVersion: 1,
    latestApprovedVersion: 1,
    conflictState: 'clean',
    conflictReason: null,
    summaryNote: null,
    lastSavedAt: now,
    lastSavedBy: 'user-1',
    lastManualSaveAt: Date.now(),
    ...overrides,
  };
};

describe('useDocumentBootstrap', () => {
  beforeEach(() => {
    if (typeof globalThis.structuredClone !== 'function') {
      globalThis.structuredClone = (input: unknown) => JSON.parse(JSON.stringify(input ?? null));
    }

    vi.clearAllMocks();

    act(() => {
      useDocumentStore.getState().reset();
      useEditorStore.getState().reset();
    });
  });

  it('populates editor and document stores with live section data', async () => {
    const section = buildSection();
    const now = new Date().toISOString();

    mockApi.client.getDocument.mockResolvedValue({
      document: {
        id: 'doc-123',
        projectId: 'proj-456',
        title: 'Architecture Overview',
        content: { introduction: 'Hello' },
        templateId: 'architecture-reference',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-hash',
        lastModifiedAt: now,
      },
      migration: null,
      templateDecision: {
        action: 'noop',
        reason: 'up_to_date',
        currentVersion: {
          templateId: 'architecture-reference',
          version: '2.1.0',
          schemaHash: 'tmpl-hash',
          status: 'active',
        },
      },
    });

    mockApi.client.getDocumentSections.mockResolvedValue({
      sections: [section],
      toc: {
        documentId: 'doc-123',
        lastUpdated: now,
        sections: [
          {
            sectionId: section.id,
            title: section.title,
            depth: section.depth,
            orderIndex: section.orderIndex,
            hasContent: section.hasContent,
            status: section.status,
            isExpanded: true,
            isActive: false,
            isVisible: true,
            hasUnsavedChanges: false,
            children: [],
            parentId: null,
          },
        ],
      },
    });

    mockApi.projects.getById.mockResolvedValue({
      id: 'proj-456',
      slug: 'architecture-reference',
      name: 'Architecture Reference',
    });

    const { result } = renderHook(() =>
      useDocumentBootstrap({ documentId: 'doc-123', initialSectionId: section.id })
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    const documentState = useDocumentStore.getState();
    expect(documentState.document).toMatchObject({
      id: 'doc-123',
      projectSlug: 'architecture-reference',
      title: 'Architecture Overview',
    });
    expect(documentState.rootSections).toHaveLength(1);
    expect(documentState.sectionHierarchy['root']).toEqual([section.id]);
    expect(documentState.assumptionSessions).toEqual({});
    expect(documentState.isLoading).toBe(false);

    const editorState = useEditorStore.getState();
    expect(Object.keys(editorState.sections)).toContain(section.id);
    expect(editorState.activeSectionId).toBe(section.id);

    expect(mockApi.projects.getById).toHaveBeenCalledWith('proj-456');
    expect(mockApi.client.getDocument).toHaveBeenCalledWith('doc-123');
    expect(mockApi.client.getDocumentSections).toHaveBeenCalledWith('doc-123');
  });

  it('falls back to the first available section when the initial id is missing', async () => {
    const firstSection = buildSection({ id: 'sec-first', orderIndex: 0 });
    const secondSection = buildSection({ id: 'sec-second', orderIndex: 1 });
    const now = new Date().toISOString();

    mockApi.client.getDocument.mockResolvedValue({
      document: {
        id: 'doc-123',
        projectId: 'proj-456',
        title: 'Architecture Overview',
        content: { introduction: 'Hello' },
        templateId: 'architecture-reference',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-hash',
        lastModifiedAt: now,
      },
      migration: null,
      templateDecision: null,
    });

    mockApi.client.getDocumentSections.mockResolvedValue({
      sections: [firstSection, secondSection],
      toc: {
        documentId: 'doc-123',
        lastUpdated: now,
        sections: [firstSection, secondSection].map(section => ({
          sectionId: section.id,
          title: section.title,
          depth: section.depth,
          orderIndex: section.orderIndex,
          hasContent: section.hasContent,
          status: section.status,
          isExpanded: true,
          isActive: false,
          isVisible: true,
          hasUnsavedChanges: false,
          children: [],
          parentId: null,
        })),
      },
    });

    mockApi.projects.getById.mockResolvedValue({
      id: 'proj-456',
      slug: 'architecture-reference',
      name: 'Architecture Reference',
    });

    const { result } = renderHook(() =>
      useDocumentBootstrap({ documentId: 'doc-123', initialSectionId: 'missing-section' })
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));

    const editorState = useEditorStore.getState();
    expect(editorState.activeSectionId).toBe(firstSection.id);
  });

  it('captures errors when live document fetch fails', async () => {
    mockApi.client.getDocument.mockRejectedValue(new Error('Document unavailable'));
    mockApi.client.getDocumentSections.mockResolvedValue({
      sections: [],
      toc: { documentId: 'doc-123', lastUpdated: new Date().toISOString(), sections: [] },
    });

    const { result } = renderHook(() => useDocumentBootstrap({ documentId: 'doc-123' }));

    await waitFor(() => expect(result.current.status).toBe('error'));

    const documentState = useDocumentStore.getState();
    expect(documentState.error).toBe('Document unavailable');
    expect(documentState.isLoading).toBe(false);
    expect(mockApi.projects.getById).not.toHaveBeenCalled();
  });
});
