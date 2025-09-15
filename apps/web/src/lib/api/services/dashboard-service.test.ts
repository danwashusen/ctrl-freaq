import { describe, it, expect, vi } from 'vitest';
import { getDashboard } from './dashboard-service';

describe('dashboard-service', () => {
  it('calls apiClient.getDashboard', async () => {
    const getDashboardMock = vi
      .fn()
      .mockResolvedValue({ projects: [], activities: [], stats: { totalProjects: 0 } });
    const api: any = { getDashboard: getDashboardMock };

    const res = await getDashboard(api);
    expect(getDashboardMock).toHaveBeenCalled();
    expect(res.stats.totalProjects).toBe(0);
  });
});
