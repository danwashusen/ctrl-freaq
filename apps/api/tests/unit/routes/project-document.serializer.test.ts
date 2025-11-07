import { describe, expect, it } from 'vitest';

import {
  ProjectDocumentSnapshotSchema,
  TemplateValidationDecisionSchema,
  type ProjectDocumentSnapshot,
} from '@ctrl-freaq/shared-data';

import {
  serializePrimaryDocumentSnapshot,
  serializeTemplateValidationDecision,
} from '../../../src/routes/serializers/project-document.serializer';

describe('project-document serializer', () => {
  const baseSnapshot: ProjectDocumentSnapshot = ProjectDocumentSnapshotSchema.parse({
    projectId: '11111111-2222-4333-8444-555555555555',
    status: 'ready',
    document: {
      documentId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      firstSectionId: 'ffffffff-1111-4222-8333-444444444444',
      title: 'Architecture Overview',
      lifecycleStatus: 'review',
      lastModifiedAt: '2025-05-10T12:30:00.000Z',
      template: {
        templateId: 'architecture',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-hash-210',
      },
    },
    templateDecision: TemplateValidationDecisionSchema.parse({
      decisionId: 'dddddddd-eeee-4fff-9000-111111111111',
      action: 'pending',
      templateId: 'architecture',
      currentVersion: '2.0.0',
      requestedVersion: '2.1.0',
      submittedAt: '2025-05-09T18:45:00.000Z',
      submittedBy: 'user-template-admin',
      notes: 'Awaiting security sign-off',
    }),
    lastUpdatedAt: '2025-05-10T12:30:00.000Z',
  });

  it('serializes ready snapshots using API contract structure', () => {
    const serialized = serializePrimaryDocumentSnapshot(baseSnapshot);

    expect(serialized).toEqual({
      projectId: '11111111-2222-4333-8444-555555555555',
      status: 'ready',
      document: {
        documentId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        firstSectionId: 'ffffffff-1111-4222-8333-444444444444',
        title: 'Architecture Overview',
        lifecycleStatus: 'review',
        lastModifiedAt: '2025-05-10T12:30:00.000Z',
        template: {
          templateId: 'architecture',
          templateVersion: '2.1.0',
          templateSchemaHash: 'tmpl-hash-210',
        },
      },
      templateDecision: {
        decisionId: 'dddddddd-eeee-4fff-9000-111111111111',
        action: 'pending',
        templateId: 'architecture',
        currentVersion: '2.0.0',
        requestedVersion: '2.1.0',
        submittedAt: '2025-05-09T18:45:00.000Z',
        submittedBy: 'user-template-admin',
        notes: 'Awaiting security sign-off',
      },
      lastUpdatedAt: '2025-05-10T12:30:00.000Z',
    });
  });

  it('serializes snapshot without document/template decision using null placeholders', () => {
    const missingSnapshot = ProjectDocumentSnapshotSchema.parse({
      projectId: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
      status: 'missing',
      document: null,
      templateDecision: null,
      lastUpdatedAt: '2025-05-11T09:15:00.000Z',
    });

    const serialized = serializePrimaryDocumentSnapshot(missingSnapshot);

    expect(serialized).toEqual({
      projectId: '99999999-aaaa-4bbb-8ccc-dddddddddddd',
      status: 'missing',
      document: null,
      templateDecision: null,
      lastUpdatedAt: '2025-05-11T09:15:00.000Z',
    });
  });

  it('serializes template validation decisions consistently', () => {
    const decision = TemplateValidationDecisionSchema.parse({
      decisionId: 'aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      action: 'approved',
      templateId: 'architecture',
      currentVersion: '2.0.0',
      requestedVersion: '2.0.1',
      submittedAt: '2025-05-01T10:00:00.000Z',
      submittedBy: 'user-template-admin',
      notes: null,
    });

    expect(serializeTemplateValidationDecision(decision)).toEqual({
      decisionId: 'aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      action: 'approved',
      templateId: 'architecture',
      currentVersion: '2.0.0',
      requestedVersion: '2.0.1',
      submittedAt: '2025-05-01T10:00:00.000Z',
      submittedBy: 'user-template-admin',
      notes: null,
    });

    expect(serializeTemplateValidationDecision(null)).toBeNull();
  });
});
