import { describe, expect, it } from 'vitest';

import { buildCoAuthorContext } from './context-builder';

describe('buildCoAuthorContext', () => {
  const documentSnapshot = {
    documentId: 'doc-architecture-demo',
    title: 'Architecture Overview',
    sections: [
      {
        sectionId: 'introduction',
        path: '/architecture/introduction.md',
        status: 'completed' as const,
        content: '# Intro\nApproved summary',
      },
      {
        sectionId: 'architecture-overview',
        path: '/architecture/overview.md',
        status: 'completed' as const,
        content: '# Overview\nApproved copy',
      },
      {
        sectionId: 'future-work',
        path: '/architecture/future-work.md',
        status: 'draft' as const,
        content: '# Future work\nDraft content',
      },
    ],
  };

  const clarifications = [
    'Always include the entire document in provider payloads.',
    'Conversation transcripts must remain ephemeral.',
  ];

  const baseDeps = {
    fetchDocumentSnapshot: async (documentId: string) => {
      if (documentId !== documentSnapshot.documentId) {
        throw new Error('document not found');
      }
      return documentSnapshot;
    },
    fetchActiveSectionDraft: async (input: { documentId: string; sectionId: string }) => {
      if (input.sectionId !== 'architecture-overview') {
        return null;
      }
      return {
        content: '## Draft\nPending improvements',
        baselineVersion: 'rev-7',
      };
    },
    fetchDecisionSummaries: async ({ decisionIds }: { decisionIds: string[] }) => [
      {
        id: 'decision:telemetry',
        summary: `Telemetry stays console-only. (${decisionIds.join(',') || 'all'})`,
      },
    ],
    fetchKnowledgeItems: async ({ knowledgeItemIds }: { knowledgeItemIds: string[] }) => [
      {
        id: 'knowledge:wcag',
        excerpt: `Announce streaming state via ARIA live regions. (${knowledgeItemIds.join(',') || 'all'})`,
      },
    ],
    clarifications,
  } satisfies Parameters<typeof buildCoAuthorContext>[0];

  it('assembles provider payload with all completed sections and current draft content', async () => {
    const payload = await buildCoAuthorContext(baseDeps, {
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      authorId: 'user_staff_eng',
      knowledgeItemIds: ['knowledge:wcag'],
      decisionIds: ['decision:telemetry'],
    });

    expect(payload).toMatchObject({
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      documentTitle: documentSnapshot.title,
      completedSections: [
        { path: '/architecture/introduction.md', content: '# Intro\nApproved summary' },
        { path: '/architecture/overview.md', content: '# Overview\nApproved copy' },
      ],
      currentDraft: '## Draft\nPending improvements',
      clarifications,
    });
    expect(payload.completedSections).toHaveLength(2);
    expect(payload.knowledgeItems[0]).toMatchObject({ id: 'knowledge:wcag' });
    expect(payload.knowledgeItems[0]?.excerpt).toContain(
      'Announce streaming state via ARIA live regions'
    );
    expect(payload.decisionSummaries[0]).toMatchObject({ id: 'decision:telemetry' });
    expect(payload.decisionSummaries[0]?.summary).toContain('Telemetry stays console-only');
  });

  it('throws a scope violation when the requested section is not in the document', async () => {
    await expect(
      buildCoAuthorContext(baseDeps, {
        documentId: 'doc-architecture-demo',
        sectionId: 'rogue-section',
        authorId: 'user_staff_eng',
        knowledgeItemIds: [],
        decisionIds: [],
      })
    ).rejects.toMatchObject({ code: 'SCOPE_VIOLATION' });
  });
});
