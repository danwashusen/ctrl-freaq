import { useEffect, useRef } from 'react';

import type { DocumentFixture } from '@/lib/fixtures/e2e';
import { buildFixtureDocumentView } from '@/lib/fixtures/e2e/transformers';
import { useEditorStore } from '../stores/editor-store';
import { useDocumentStore } from '../stores/document-store';

interface UseDocumentFixtureOptions {
  documentId: string;
  fixtureDocument?: DocumentFixture;
  initialSectionId?: string;
}

export function useDocumentFixtureBootstrap({
  documentId,
  fixtureDocument,
  initialSectionId,
}: UseDocumentFixtureOptions) {
  const hydratedDocumentRef = useRef<string | null>(null);
  const loadSections = useEditorStore(state => state.loadSections);
  const setActiveSection = useEditorStore(state => state.setActiveSection);
  const setDocument = useDocumentStore(state => state.setDocument);
  const setTableOfContents = useDocumentStore(state => state.setTableOfContents);
  const setLoading = useDocumentStore(state => state.setLoading);
  const setError = useDocumentStore(state => state.setError);
  const setAssumptionSessions = useDocumentStore(state => state.setAssumptionSessions);

  useEffect(() => {
    if (!fixtureDocument) {
      return;
    }

    if (hydratedDocumentRef.current === fixtureDocument.id) {
      return;
    }

    const view = buildFixtureDocumentView(fixtureDocument);

    loadSections(view.sections);
    setDocument({
      id: view.documentId,
      title: view.title,
      lastModified: view.updatedAt,
      status: view.lifecycleStatus,
    });
    setTableOfContents(view.toc);
    setAssumptionSessions(view.assumptionSessions);
    setLoading(false);
    setError(null);

    if (initialSectionId) {
      setActiveSection(initialSectionId);
    } else {
      const firstSectionId = view.sections[0]?.id;
      if (firstSectionId) {
        setActiveSection(firstSectionId);
      }
    }

    hydratedDocumentRef.current = fixtureDocument.id;
  }, [
    documentId,
    fixtureDocument,
    initialSectionId,
    loadSections,
    setActiveSection,
    setDocument,
    setError,
    setLoading,
    setTableOfContents,
    setAssumptionSessions,
  ]);
}
