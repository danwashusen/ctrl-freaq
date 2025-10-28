import { describe, it, expect, vi } from 'vitest';
import { listProjects } from './project-service';

describe('project-service', () => {
  it('calls apiClient.listProjects with params', async () => {
    const listProjectsMock = vi
      .fn()
      .mockResolvedValue({ projects: [], total: 0, limit: 10, offset: 1 });
    const api: any = { listProjects: listProjectsMock };

    const params = { limit: 10, offset: 1 };
    const res = await listProjects(api, params);
    expect(listProjectsMock).toHaveBeenCalledWith(params);
    expect(res).toEqual({ projects: [], total: 0, limit: 10, offset: 1 });
  });
});
