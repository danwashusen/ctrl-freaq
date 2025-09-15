import { logger } from './logger';

interface ApiClientOptions {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

// Client-facing normalized project shape
interface ProjectData {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Server DTOs (as returned by API)
interface ServerProjectDTO {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  memberAvatars?: Array<Record<string, unknown>>;
  lastModified?: string | null;
}

interface ProjectsListResponseDTO {
  projects: ServerProjectDTO[];
  total: number;
}

interface CreateProjectRequest {
  name: string;
  description: string;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

interface ConfigurationData {
  theme: string;
  notifications: boolean;
  language: string;
  timezone: string;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  uptime?: number;
  database?: boolean;
}

// Dashboard/Activities DTOs
interface DashboardProjectListItemDTO extends ServerProjectDTO {}

type ActivityType =
  | 'document_created'
  | 'document_updated'
  | 'document_published'
  | 'member_added'
  | 'member_removed';

interface ActivityDTO {
  id: string;
  projectId: string;
  projectName: string;
  userId: string;
  userAvatar: string;
  userName: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface DashboardResponseDTO {
  projects: DashboardProjectListItemDTO[];
  activities: ActivityDTO[];
  stats: {
    totalProjects: number;
    recentActivityCount?: number;
  };
}

interface ActivitiesListResponseDTO {
  activities: ActivityDTO[];
  total: number;
}

interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;
  private requestId: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';
    this.getAuthToken = options.getAuthToken;
    this.requestId = this.generateRequestId();
  }

  private generateRequestId(): string {
    return `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.requestId,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.getAuthToken) {
      try {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        logger.error(
          'Failed to get auth token in API client',
          {},
          error instanceof Error ? error : undefined
        );
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = new Error(
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.code = errorData.error?.code;
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error;
      }

      const apiError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      ) as ApiError;
      throw apiError;
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.makeRequest<HealthStatus>('/health');
  }

  async getProjects(): Promise<ProjectData[]> {
    const raw = await this.makeRequest<ProjectsListResponseDTO | ApiResponse<ProjectData[]>>(
      '/projects'
    );
    // New API: { projects, total }
    if (raw && (raw as ProjectsListResponseDTO).projects) {
      const list = (raw as ProjectsListResponseDTO).projects || [];
      return list.map((p: ServerProjectDTO) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        user_id: p.ownerUserId,
      }));
    }
    // Legacy shape: ApiResponse<ProjectData[]>
    const legacy = raw as ApiResponse<ProjectData[]>;
    return legacy?.data || [];
  }

  async getProject(id: string): Promise<ProjectData> {
    const response = await this.makeRequest<ProjectData | ApiResponse<ProjectData>>(
      `/projects/${id}`
    );
    if ('data' in (response as ApiResponse<ProjectData>)) {
      const resp = response as ApiResponse<ProjectData>;
      if (!resp.data) throw new Error('Project not found');
      return resp.data;
    }
    return response as ProjectData;
  }

  async createProject(project: CreateProjectRequest): Promise<ProjectData> {
    const response = await this.makeRequest<ProjectData | ApiResponse<ProjectData>>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    if ('data' in (response as ApiResponse<ProjectData>)) {
      const resp = response as ApiResponse<ProjectData>;
      if (!resp.data) throw new Error('Failed to create project');
      return resp.data;
    }
    return response as ProjectData;
  }

  async updateProject(id: string, updates: UpdateProjectRequest): Promise<ProjectData> {
    const response = await this.makeRequest<ProjectData | ApiResponse<ProjectData>>(
      `/projects/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    );
    if ('data' in (response as ApiResponse<ProjectData>)) {
      const resp = response as ApiResponse<ProjectData>;
      if (!resp.data) throw new Error('Failed to update project');
      return resp.data;
    }
    return response as ProjectData;
  }

  async deleteProject(id: string): Promise<void> {
    await this.makeRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async getConfiguration(): Promise<ConfigurationData> {
    const response = await this.makeRequest<ConfigurationData | ApiResponse<ConfigurationData>>(
      '/projects/config'
    );
    if ('data' in (response as ApiResponse<ConfigurationData>)) {
      const resp = response as ApiResponse<ConfigurationData>;
      if (!resp.data) throw new Error('Configuration not found');
      return resp.data;
    }
    return response as ConfigurationData;
  }

  async updateConfiguration(config: Partial<ConfigurationData>): Promise<ConfigurationData> {
    const response = await this.makeRequest<ConfigurationData | ApiResponse<ConfigurationData>>(
      '/projects/config',
      {
        method: 'PATCH',
        body: JSON.stringify(config),
      }
    );
    if ('data' in (response as ApiResponse<ConfigurationData>)) {
      const resp = response as ApiResponse<ConfigurationData>;
      if (!resp.data) throw new Error('Failed to update configuration');
      return resp.data;
    }
    return response as ConfigurationData;
  }

  // Public API methods for dashboard feature
  async listProjects(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ProjectsListResponseDTO> {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    const url = `/projects${query.toString() ? `?${query.toString()}` : ''}`;
    return this.makeRequest<ProjectsListResponseDTO>(url);
  }

  async getDashboard(): Promise<DashboardResponseDTO> {
    return this.makeRequest<DashboardResponseDTO>('/dashboard');
  }

  async listActivities(params?: { limit?: number }): Promise<ActivitiesListResponseDTO> {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set('limit', String(params.limit));
    const url = `/activities${query.toString() ? `?${query.toString()}` : ''}`;
    return this.makeRequest<ActivitiesListResponseDTO>(url);
  }
}

export const createApiClient = (options?: ApiClientOptions) => new ApiClient(options);

export default ApiClient;

export type {
  ApiClientOptions,
  ApiError,
  ProjectData,
  ServerProjectDTO,
  ProjectsListResponseDTO,
  CreateProjectRequest,
  UpdateProjectRequest,
  ConfigurationData,
  HealthStatus,
  ApiResponse,
  DashboardResponseDTO,
  DashboardProjectListItemDTO,
  ActivityDTO,
  ActivitiesListResponseDTO,
};
