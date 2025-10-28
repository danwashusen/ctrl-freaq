import type ApiClient from '../../api';
import type { ProjectsListQueryParams, ProjectsListResponse } from '../../api';

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
  params?: ProjectsListQueryParams
): Promise<ProjectsListResponse> {
  return apiClient.listProjects(params);
}
