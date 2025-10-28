import { describe, expect, it } from 'vitest';

import {
  PROJECT_CONSTANTS,
  ProjectUtils,
  validateProject,
  validateCreateProject,
  type Project,
  type CreateProjectInput,
} from '../src/models/project';

const baseProject: Project = {
  id: '00000000-0000-4000-8000-000000000001',
  ownerUserId: 'user_123',
  name: 'Lifecycle Demo',
  slug: 'lifecycle-demo',
  description: 'Project with lifecycle fields',
  visibility: 'workspace',
  status: 'draft',
  goalTargetDate: new Date('2025-12-01T00:00:00.000Z'),
  goalSummary: 'Ship dashboard enhancements',
  createdAt: new Date('2025-10-20T12:00:00.000Z'),
  createdBy: 'user_123',
  updatedAt: new Date('2025-10-20T12:00:00.000Z'),
  updatedBy: 'user_123',
  deletedAt: null,
  deletedBy: null,
  archivedStatusBefore: null,
};

describe('Project lifecycle schema', () => {
  it('accepts lifecycle metadata for status, visibility, and goals', () => {
    const result = validateProject(baseProject);
    expect(result.status).toBe('draft');
    expect(result.visibility).toBe('workspace');
    expect(result.goalTargetDate?.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(result.goalSummary).toBe('Ship dashboard enhancements');
  });

  it('rejects projects with unknown lifecycle status', () => {
    expect(() =>
      validateProject({
        ...baseProject,
        status: 'invalid-status' as Project['status'],
      })
    ).toThrow(/status/i);
  });

  it('applies defaults for lifecycle fields when creating a project', () => {
    const createInput: Omit<CreateProjectInput, 'createdBy' | 'updatedBy'> & {
      createdBy: string;
      updatedBy: string;
    } = {
      ownerUserId: 'user_456',
      name: 'Lifecycle Defaults',
      slug: 'lifecycle-defaults',
      description: null,
      createdBy: 'user_456',
      updatedBy: 'user_456',
    };

    const result = validateCreateProject(createInput);
    expect(result.status).toBe('draft');
    expect(result.visibility).toBe('workspace');
    expect(result.goalTargetDate).toBeNull();
    expect(result.goalSummary).toBeNull();
  });

  it('requires archived projects to provide deleted metadata and archive status', () => {
    expect(() =>
      validateProject({
        ...baseProject,
        status: 'archived',
        deletedAt: new Date('2025-10-21T10:00:00.000Z'),
        deletedBy: null,
        archivedStatusBefore: 'active',
      })
    ).toThrow(/deletedBy/i);

    expect(() =>
      validateProject({
        ...baseProject,
        status: 'draft',
        deletedAt: new Date('2025-10-21T10:00:00.000Z'),
        deletedBy: 'user_123',
        archivedStatusBefore: null,
      })
    ).toThrow(/archived/i);
  });

  it('allows goal summaries up to 280 characters and rejects longer inputs', () => {
    const allowedSummary = 'a'.repeat(280);
    const tooLongSummary = 'b'.repeat(281);

    expect(
      validateProject({
        ...baseProject,
        goalSummary: allowedSummary,
      }).goalSummary
    ).toBe(allowedSummary);

    expect(() =>
      validateProject({
        ...baseProject,
        goalSummary: tooLongSummary,
      })
    ).toThrow(/Goal summary too long/);
  });

  it('allows project names up to the maximum length and rejects longer inputs', () => {
    expect(PROJECT_CONSTANTS.MAX_NAME_LENGTH).toBe(120);

    const allowedName = 'a'.repeat(PROJECT_CONSTANTS.MAX_NAME_LENGTH);
    const tooLongName = 'b'.repeat(PROJECT_CONSTANTS.MAX_NAME_LENGTH + 1);

    expect(
      validateProject({
        ...baseProject,
        name: allowedName,
      }).name
    ).toBe(allowedName);

    expect(() =>
      validateProject({
        ...baseProject,
        name: tooLongName,
      })
    ).toThrow(/Project name too long/);

    const createInput: CreateProjectInput = {
      ownerUserId: 'user_789',
      name: allowedName,
      slug: 'allowed-name',
      createdBy: 'user_789',
      updatedBy: 'user_789',
      visibility: 'workspace',
      status: 'draft',
    };

    expect(validateCreateProject(createInput).name).toBe(allowedName);

    expect(() =>
      validateCreateProject({
        ...createInput,
        name: tooLongName,
      })
    ).toThrow(/Project name too long/);
  });

  it('truncates generated slugs to the maximum length', () => {
    const longName =
      'Lifecycle Project with an extraordinarily descriptive and verbose identifier that exceeds the slug limit';
    const slug = ProjectUtils.generateSlug(longName);

    expect(slug.length).toBeLessThanOrEqual(PROJECT_CONSTANTS.MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});
