import { describe, expect, it, beforeEach } from 'vitest';

import { useTemplateStore } from './template-store';
import type { ApiError } from '../lib/api';

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
    expect(state.errorCode).toBeNull();
    expect(state.upgradeFailure).toBeNull();
  });

  it('records removed version information when upgrade service blocks document', async () => {
    const removedVersionError = new Error(
      'The referenced template version is no longer available.'
    ) as ApiError;
    removedVersionError.status = 409;
    removedVersionError.code = 'TEMPLATE_VERSION_REMOVED';
    removedVersionError.body = {
      error: 'TEMPLATE_VERSION_REMOVED',
      message: 'The referenced template version is no longer available.',
      templateId: 'architecture',
      missingVersion: '1.0.0',
    };

    const api = {
      getDocument: async () => {
        throw removedVersionError;
      },
      getTemplate: async () => {
        throw new Error('should not load template when removed');
      },
      getTemplateVersion: async () => {
        throw new Error('should not load version when removed');
      },
    };

    await useTemplateStore.getState().loadDocument({
      apiClient: api,
      documentId: 'doc-2',
    });

    const state = useTemplateStore.getState();
    expect(state.status).toBe('blocked');
    expect(state.removedVersion?.templateId).toBe('architecture');
    expect(state.removedVersion?.version).toBe('1.0.0');
    expect(state.errorCode).toBe('TEMPLATE_VERSION_REMOVED');
    expect(state.error).toContain('referenced template version');
    expect(state.upgradeFailure).toBeNull();
  });

  it('captures validation issues when auto-upgrade fails', async () => {
    const failureError = new Error(
      'Document content does not satisfy the target template schema'
    ) as ApiError;
    failureError.status = 422;
    failureError.code = 'TEMPLATE_VALIDATION_FAILED';
    failureError.body = {
      error: 'TEMPLATE_VALIDATION_FAILED',
      message: 'Document content does not satisfy the target template schema',
      requestId: 'req_test',
      details: {
        issues: [
          {
            path: ['introduction'],
            message: 'Executive Summary is required',
            code: 'required',
          },
        ],
      },
    };
    failureError.details = (failureError.body as { details: unknown }).details;

    const api = {
      getDocument: async () => {
        throw failureError;
      },
      getTemplate: async () => {
        throw new Error('should not load template when auto-upgrade fails');
      },
      getTemplateVersion: async () => {
        throw new Error('should not load version when auto-upgrade fails');
      },
    };

    await useTemplateStore.getState().loadDocument({
      apiClient: api,
      documentId: 'doc-3',
    });

    const state = useTemplateStore.getState();
    expect(state.status).toBe('upgrade_failed');
    expect(state.upgradeFailure).not.toBeNull();
    expect(state.upgradeFailure?.issues).toHaveLength(1);
    expect(state.upgradeFailure?.issues?.[0]?.message).toContain('Executive Summary');
    expect(state.errorCode).toBe('TEMPLATE_VALIDATION_FAILED');
    expect(state.removedVersion).toBeNull();
  });
});
