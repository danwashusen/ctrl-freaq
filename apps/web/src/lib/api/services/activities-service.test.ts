import { describe, it, expect, vi } from 'vitest';
import { listActivities } from './activities-service';

describe('activities-service', () => {
  it('calls apiClient.listActivities with params', async () => {
    const listActivitiesMock = vi.fn().mockResolvedValue({ activities: [], total: 0 });
    const api: any = { listActivities: listActivitiesMock };

    const params = { limit: 5 };
    const res = await listActivities(api, params);
    expect(listActivitiesMock).toHaveBeenCalledWith(params);
    expect(res.total).toBe(0);
  });
});
