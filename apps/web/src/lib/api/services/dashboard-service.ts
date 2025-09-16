import type ApiClient from '../../api';
import type { DashboardResponseDTO } from '../../api';

export async function getDashboard(apiClient: ApiClient): Promise<DashboardResponseDTO> {
  return apiClient.getDashboard();
}
