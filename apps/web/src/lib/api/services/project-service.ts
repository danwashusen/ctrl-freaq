import type ApiClient from '../../api';
import type { ProjectsListResponseDTO } from '../../api';

export type MemberAvatar = {
  userId?: string;
  imageUrl?: string;
  name?: string;
};

export type ProjectListItem = {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description?: string | null;
  memberAvatars: MemberAvatar[];
  lastModified: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listProjects(
  apiClient: ApiClient,
  params?: { limit?: number; offset?: number }
): Promise<ProjectsListResponseDTO> {
  return apiClient.listProjects(params);
}
