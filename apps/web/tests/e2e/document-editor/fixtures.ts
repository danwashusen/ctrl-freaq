import type { Page } from '@playwright/test';

import {
  documentQualitySummaryFixture,
  qualityGateRequestIds,
  sectionQualityFixtures,
  traceabilityGapFixtures,
} from '../fixtures/document-quality';

export {
  documentQualitySummaryFixture,
  sectionQualityFixtures,
  traceabilityGapFixtures,
} from '../fixtures/document-quality';

const sectionRequestIdMap: Record<string, string | undefined> = {
  'sec-overview': qualityGateRequestIds.sectionOverview,
  'sec-api': qualityGateRequestIds.sectionApiGateway,
  'sec-assumptions': qualityGateRequestIds.sectionAssumptions,
  'sec-deployment': qualityGateRequestIds.sectionDeployment,
};

function buildSectionResult(sectionId: string) {
  const fixture = sectionQualityFixtures.find(item => item.sectionId === sectionId);
  if (!fixture) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    sectionId: fixture.sectionId,
    documentId: documentQualitySummaryFixture.documentId,
    runId: fixture.runId,
    status: fixture.status,
    rules: fixture.rules,
    lastRunAt: fixture.lastRunAt,
    lastSuccessAt: fixture.lastSuccessAt,
    triggeredBy: fixture.triggeredBy,
    source: fixture.source,
    durationMs: fixture.durationMs,
    remediationState: fixture.remediationState,
    incidentId: null,
    createdAt: fixture.lastRunAt ?? now,
    updatedAt: now,
  };
}

function buildRunAcknowledgement(sectionId: string) {
  const fixture = sectionQualityFixtures.find(item => item.sectionId === sectionId);
  const requestId = sectionRequestIdMap[sectionId] ?? `req-${sectionId}`;

  return {
    status: 'running',
    requestId,
    runId: fixture?.runId ?? `run-${sectionId}`,
    sectionId,
    documentId: documentQualitySummaryFixture.documentId,
    triggeredBy: fixture?.triggeredBy ?? 'user-fixture',
    receivedAt: new Date().toISOString(),
  };
}

type PlaywrightRoute = Parameters<Parameters<Page['route']>[1]>[0];

export async function registerDocumentQualityFixtures(page: Page): Promise<void> {
  const apiPrefixes = ['/api/v1', '/__fixtures/api', '/__fixtures/api/v1'];

  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore storage reset failures in test fixtures
    }

    try {
      if ('indexedDB' in window) {
        const request = window.indexedDB.deleteDatabase('ctrl-freaq-editor');
        request.onerror = () => {
          // intentionally swallow errors; stale drafts should not block tests
        };
      }
    } catch {
      // ignore indexedDB reset failures in test fixtures
    }
  });

  const handleSectionRoute = async (route: PlaywrightRoute) => {
    const url = new URL(route.request().url());
    const sectionMatch = url.pathname.match(
      /\/documents\/([^/]+)\/sections\/([^/]+)\/quality-gates/
    );
    const documentId = sectionMatch?.[1];
    const sectionId = sectionMatch?.[2];

    if (!sectionId || !documentId) {
      await route.continue();
      return;
    }

    const result = buildSectionResult(sectionId);
    if (!result) {
      await route.continue();
      return;
    }

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      const acknowledgement = buildRunAcknowledgement(sectionId);
      acknowledgement.documentId = documentId;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(acknowledgement),
      });
      return;
    }

    await route.continue();
  };

  const handleDocumentSummary = async (route: PlaywrightRoute) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(documentQualitySummaryFixture),
    });
  };

  const handleDocumentRun = async (route: PlaywrightRoute) => {
    const url = new URL(route.request().url());
    const documentId = url.pathname.split('/')[3];

    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'running',
        requestId: qualityGateRequestIds.documentSummary,
        runId: `run-${documentId}`,
        documentId,
        triggeredBy: 'user-fixture',
        receivedAt: new Date().toISOString(),
      }),
    });
  };

  const handleTraceability = async (route: PlaywrightRoute) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const documentId = url.pathname.split('/')[3];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        documentId,
        requirements: traceabilityGapFixtures.map(fixture => ({
          requirementId: fixture.requirementId,
          sectionId: fixture.sectionId,
          title: fixture.title,
          preview: fixture.preview,
          gateStatus: fixture.gateStatus,
          coverageStatus: fixture.coverageStatus,
          lastValidatedAt: fixture.lastValidatedAt,
          validatedBy: fixture.validatedBy,
          notes: fixture.notes ?? [],
          revisionId: fixture.revisionId ?? 'rev-fixture',
          auditTrail: fixture.auditTrail ?? [],
        })),
      }),
    });
  };

  for (const prefix of apiPrefixes) {
    await page.route(`**${prefix}/documents/*/sections/*/quality-gates/run*`, handleSectionRoute);
    await page.route(
      `**${prefix}/documents/*/sections/*/quality-gates/result*`,
      handleSectionRoute
    );
    await page.route(`**${prefix}/documents/*/quality-gates/run*`, handleDocumentRun);
    await page.route(`**${prefix}/documents/*/quality-gates/summary*`, handleDocumentSummary);
    await page.route(`**${prefix}/documents/*/traceability/orphans*`, async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const url = new URL(route.request().url());
      const documentId = url.pathname.split('/')[3];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documentId,
          requirementId: 'req-traceability-coverage',
          sectionId: 'sec-overview',
          coverageStatus: 'orphaned',
          reason: 'no-link',
          lastValidatedAt: new Date().toISOString(),
          validatedBy: 'user-morgan',
        }),
      });
    });
    await page.route(`**${prefix}/documents/*/traceability*`, handleTraceability);
  }
}
