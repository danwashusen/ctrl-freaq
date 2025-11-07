import { useEffect, useState } from 'react';

import { useApi } from '@/lib/api-context';
import { logger } from '@/lib/logger';
import type { DocumentResponse, DocumentSectionsResponse } from '@/lib/api';

import { useDocumentStore } from '../stores/document-store';
import { useEditorStore } from '../stores/editor-store';
import type { SectionView } from '../types/section-view';
import { isSectionView } from '../types/section-view';
import type { TableOfContents, TocNode } from '../types/table-of-contents';

interface UseDocumentBootstrapOptions {
  documentId: string;
  initialSectionId?: string;
  enabled?: boolean;
  initialDocument?: DocumentResponse | null;
  initialSections?: DocumentSectionsResponse | null;
}

type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DocumentBootstrapState {
  status: BootstrapStatus;
  error?: string;
  initialSectionId: string | null;
  projectId: string | null;
  projectSlug: string | null;
  projectName: string | null;
}

function normalizeTocNode(node: Record<string, unknown>): TocNode {
  return {
    sectionId: String(node.sectionId ?? ''),
    title: String(node.title ?? ''),
    depth: Number(node.depth ?? 0),
    orderIndex: Number(node.orderIndex ?? 0),
    hasContent: Boolean(node.hasContent),
    status: (node.status as TocNode['status']) ?? 'idle',
    isExpanded: Boolean(node.isExpanded),
    isActive: Boolean(node.isActive),
    isVisible: Boolean(node.isVisible),
    hasUnsavedChanges: Boolean(node.hasUnsavedChanges),
    children: Array.isArray(node.children)
      ? node.children.map(child => normalizeTocNode(child as Record<string, unknown>))
      : [],
    parentId: typeof node.parentId === 'string' || node.parentId === null ? node.parentId : null,
  };
}

function normalizeSections(sections: DocumentSectionsResponse['sections']): SectionView[] {
  const normalized: SectionView[] = [];
  for (const section of sections) {
    const candidate = section as unknown;
    if (isSectionView(candidate)) {
      normalized.push(candidate);
    }
  }
  return normalized;
}

function normalizeTableOfContents(toc: DocumentSectionsResponse['toc']): TableOfContents {
  return {
    documentId: String(toc.documentId ?? ''),
    sections: Array.isArray(toc.sections)
      ? toc.sections.map(section => normalizeTocNode(section as Record<string, unknown>))
      : [],
    lastUpdated: typeof toc.lastUpdated === 'string' ? toc.lastUpdated : new Date().toISOString(),
  };
}

function deriveDocumentStatus(sections: SectionView[]): 'draft' | 'review' | 'published' {
  if (!sections.length) {
    return 'draft';
  }

  if (sections.every(section => section.status === 'ready')) {
    return 'published';
  }

  if (sections.some(section => section.status === 'review')) {
    return 'review';
  }

  return 'draft';
}

export function useDocumentBootstrap({
  documentId,
  initialSectionId,
  enabled = true,
  initialDocument = null,
  initialSections = null,
}: UseDocumentBootstrapOptions): DocumentBootstrapState {
  const { client, projects } = useApi();
  const loadSections = useEditorStore(state => state.loadSections);
  const setEditorActiveSection = useEditorStore(state => state.setActiveSection);
  const setDocument = useDocumentStore(state => state.setDocument);
  const setLoading = useDocumentStore(state => state.setLoading);
  const setError = useDocumentStore(state => state.setError);
  const setTableOfContents = useDocumentStore(state => state.setTableOfContents);
  const setAssumptionSessions = useDocumentStore(state => state.setAssumptionSessions);
  const loadSectionHierarchy = useDocumentStore(state => state.loadSectionHierarchy);

  const [state, setState] = useState<DocumentBootstrapState>({
    status: 'idle',
    error: undefined,
    initialSectionId: null,
    projectId: null,
    projectSlug: null,
    projectName: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDocument() {
      if (!enabled || !documentId) {
        setState(prev => ({
          ...prev,
          status: enabled ? prev.status : 'idle',
        }));
        return;
      }

      setLoading(true);
      setError(null);
      setState(prev => ({
        ...prev,
        status: 'loading',
        error: undefined,
      }));

      try {
        const [documentResponse, sectionsResponse] = await Promise.all([
          initialDocument ? Promise.resolve(initialDocument) : client.getDocument(documentId),
          initialSections
            ? Promise.resolve(initialSections)
            : client.getDocumentSections(documentId),
        ]);

        if (cancelled) {
          return;
        }

        const sections = normalizeSections(sectionsResponse.sections);
        loadSections(sections);
        loadSectionHierarchy(sections);

        const toc = normalizeTableOfContents(sectionsResponse.toc);
        setTableOfContents(toc);
        setAssumptionSessions({});

        const projectId =
          typeof documentResponse.document.projectId === 'string'
            ? documentResponse.document.projectId
            : null;

        let projectSlug: string | null = projectId ?? null;
        let projectName: string | null = null;

        if (projectId) {
          try {
            const project = await projects.getById(projectId);
            if (!cancelled && project) {
              projectSlug = project.slug ?? projectSlug;
              projectName = project.name ?? projectName;
            }
          } catch (projectError) {
            logger.warn('document.bootstrap.project_fetch_failed', {
              projectId,
              error:
                projectError instanceof Error
                  ? projectError.message
                  : String(projectError ?? 'unknown'),
            });
          }
        }

        const lastModifiedAt =
          (documentResponse.document as { lastModifiedAt?: string }).lastModifiedAt ??
          (documentResponse.document as { updatedAt?: string }).updatedAt ??
          new Date().toISOString();
        const lifecycleStatus = deriveDocumentStatus(sections);

        setDocument({
          id: documentResponse.document.id,
          title: documentResponse.document.title,
          lastModified: lastModifiedAt,
          status: lifecycleStatus,
          projectSlug: projectSlug ?? projectId ?? 'project',
        });

        const matchingInitialSectionId =
          initialSectionId && sections.some(section => section.id === initialSectionId)
            ? initialSectionId
            : null;

        const resolvedInitialSectionId = matchingInitialSectionId ?? sections[0]?.id ?? null;

        if (resolvedInitialSectionId) {
          setEditorActiveSection(resolvedInitialSectionId);
        }

        setState({
          status: 'ready',
          error: undefined,
          initialSectionId: resolvedInitialSectionId,
          projectId,
          projectSlug,
          projectName,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load document data. Please try again.';

        setError(message);

        setState({
          status: 'error',
          error: message,
          initialSectionId: null,
          projectId: null,
          projectSlug: null,
          projectName: null,
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrapDocument();

    return () => {
      cancelled = true;
    };
  }, [
    client,
    documentId,
    initialSectionId,
    enabled,
    initialDocument,
    initialSections,
    loadSections,
    loadSectionHierarchy,
    setEditorActiveSection,
    projects,
    setAssumptionSessions,
    setDocument,
    setError,
    setLoading,
    setTableOfContents,
  ]);

  return state;
}
