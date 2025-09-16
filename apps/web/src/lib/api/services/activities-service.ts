import type ApiClient from '../../api';
import type { ActivitiesListResponseDTO } from '../../api';

export async function listActivities(
  apiClient: ApiClient,
  params?: { limit?: number }
): Promise<ActivitiesListResponseDTO> {
  return apiClient.listActivities(params);
}
