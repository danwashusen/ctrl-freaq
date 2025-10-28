import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  getDocumentFixture,
  getSectionFixture,
  listDocumentIds,
  listSectionIds,
  fixtureErrors,
} from './index';
import type { DocumentFixture, SectionFixture } from './types';
import { resetFixtureProjectsStore } from '@/lib/api';

export class FixtureNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FixtureNotFoundError';
  }
}

interface E2EFixtureContextValue {
  fetchDocument: (documentId: string) => Promise<DocumentFixture>;
  fetchSection: (documentId: string, sectionId: string) => Promise<SectionFixture>;
  listDocumentIds: () => string[];
  listSectionIds: (documentId: string) => string[];
}

const E2EFixtureContext = createContext<E2EFixtureContextValue | null>(null);

export interface E2EFixtureProviderProps {
  children: ReactNode;
}

export function E2EFixtureProvider({ children }: E2EFixtureProviderProps) {
  useEffect(() => {
    resetFixtureProjectsStore();
    // eslint-disable-next-line no-console -- Fixture banner is intentional for QA visibility.
    console.info(
      '[CTRL FreaQ] E2E fixtures enabled — serving deterministic document data for Playwright flows.'
    );
  }, []);

  const value = useMemo<E2EFixtureContextValue>(
    () => ({
      fetchDocument: async (documentId: string) => {
        try {
          return getDocumentFixture(documentId);
        } catch {
          throw new FixtureNotFoundError(
            `Document fixture missing for id "${documentId}". ${fixtureErrors.notFound.message}`
          );
        }
      },
      fetchSection: async (documentId: string, sectionId: string) => {
        try {
          return getSectionFixture(documentId, sectionId);
        } catch {
          throw new FixtureNotFoundError(
            `Section fixture missing for path "${documentId}/${sectionId}". ${fixtureErrors.notFound.message}`
          );
        }
      },
      listDocumentIds,
      listSectionIds,
    }),
    []
  );

  return <E2EFixtureContext.Provider value={value}>{children}</E2EFixtureContext.Provider>;
}

export function useOptionalE2EFixtures(): E2EFixtureContextValue | null {
  return useContext(E2EFixtureContext);
}

export function useE2EFixtures(): E2EFixtureContextValue {
  const context = useContext(E2EFixtureContext);
  if (!context) {
    throw new Error('useE2EFixtures must be used within an E2EFixtureProvider');
  }
  return context;
}

export function isE2EModeEnabled(): boolean {
  const env = import.meta.env ?? {};
  if (env?.VITE_E2E === 'true') {
    return true;
  }

  if (env?.MODE === 'e2e') {
    return true;
  }

  const apiBaseUrl = env?.VITE_API_BASE_URL;
  if (typeof apiBaseUrl === 'string' && apiBaseUrl.includes('__fixtures')) {
    return true;
  }

  return false;
}
