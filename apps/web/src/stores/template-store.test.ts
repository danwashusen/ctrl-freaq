import { describe, expect, it, beforeEach } from 'vitest';

import { useTemplateStore } from './template-store';

describe('template-store', () => {
  beforeEach(() => {
    useTemplateStore.getState().reset();
  });

  it('loads document metadata and constructs validator from template version schema', async () => {
    const api = {
      getDocument: async () => ({
        document: {
          id: 'doc-1',
          projectId: 'proj-1',
          title: 'Architecture Doc',
          content: { introduction: 'Hi', system_overview: { tech_stack: 'React' } },
          templateId: 'architecture',
          templateVersion: '1.1.0',
          templateSchemaHash: 'hash-1',
        },
        migration: null,
        templateDecision: {
          action: 'noop',
          reason: 'up_to_date',
          currentVersion: {
            templateId: 'architecture',
            version: '1.1.0',
            schemaHash: 'hash-1',
            status: 'active',
          },
        },
      }),
      getTemplate: async () => ({
        template: {
          id: 'architecture',
          name: 'Architecture',
          description: 'Architecture doc template',
          documentType: 'architecture',
          status: 'active',
          activeVersion: '1.1.0',
          activeVersionMetadata: {
            version: '1.1.0',
            schemaHash: 'hash-1',
            status: 'active',
            changelog: null,
            sections: [
              {
                id: 'introduction',
                title: 'Introduction',
                orderIndex: 0,
                required: true,
                type: 'markdown',
                guidance: null,
                fields: [],
                children: [],
              },
              {
                id: 'system_overview',
                title: 'System Overview',
                orderIndex: 1,
                required: true,
                type: 'object',
                guidance: null,
                fields: [],
                children: [],
              },
            ],
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      getTemplateVersion: async () => ({
        version: {
          templateId: 'architecture',
          version: '1.1.0',
          schemaHash: 'hash-1',
          schema: {
            type: 'object',
            properties: {
              introduction: { type: 'string' },
              system_overview: {
                type: 'object',
                properties: {
                  tech_stack: { type: 'string' },
                },
                required: ['tech_stack'],
              },
            },
            required: ['introduction', 'system_overview'],
          },
          sections: [
            {
              id: 'introduction',
              title: 'Introduction',
              orderIndex: 0,
              required: true,
              type: 'markdown',
              guidance: null,
              fields: [],
              children: [],
            },
            {
              id: 'system_overview',
              title: 'System Overview',
              orderIndex: 1,
              required: true,
              type: 'object',
              guidance: null,
              fields: [],
              children: [
                {
                  id: 'tech_stack',
                  title: 'Tech Stack',
                  orderIndex: 0,
                  required: true,
                  type: 'markdown',
                  guidance: null,
                  fields: [],
                  children: [],
                },
              ],
            },
          ],
        },
      }),
    };

    await useTemplateStore.getState().loadDocument({
      apiClient: api,
      documentId: 'doc-1',
    });

    const state = useTemplateStore.getState();
    expect(state.status).toBe('ready');
    expect(state.document?.id).toBe('doc-1');
    expect(state.sections).toHaveLength(2);
    expect(typeof state.validator?.safeParse).toBe('function');
  });

  it('records removed version information when upgrade service blocks document', async () => {
    const api = {
      getDocument: async () => ({
        document: {
          id: 'doc-2',
          projectId: 'proj-1',
          title: 'Legacy Doc',
          content: { introduction: 'Legacy' },
          templateId: 'architecture',
          templateVersion: '1.0.0',
          templateSchemaHash: 'hash-old',
        },
        migration: null,
        templateDecision: {
          action: 'blocked',
          reason: 'removed_version',
          requestedVersion: {
            templateId: 'architecture',
            version: '1.0.0',
            schemaHash: 'hash-old',
          },
        },
      }),
      getTemplate: async () => ({
        template: {
          id: 'architecture',
          name: 'Architecture',
          description: 'Architecture doc template',
          documentType: 'architecture',
          status: 'active',
          activeVersion: '1.1.0',
          activeVersionMetadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      getTemplateVersion: async () => ({
        version: {
          templateId: 'architecture',
          version: '1.1.0',
          schemaHash: 'hash-1',
          schema: { type: 'object', properties: {} },
          sections: [],
        },
      }),
    };

    await useTemplateStore.getState().loadDocument({
      apiClient: api,
      documentId: 'doc-2',
    });

    const state = useTemplateStore.getState();
    expect(state.status).toBe('blocked');
    expect(state.removedVersion?.templateId).toBe('architecture');
    expect(state.removedVersion?.version).toBe('1.0.0');
  });
});
