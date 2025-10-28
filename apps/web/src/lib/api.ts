import { logger } from './logger';

interface ApiClientOptions {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
  body?: unknown;
  details?: unknown;
}

type ProjectVisibility = 'private' | 'workspace';
type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

// Client-facing normalized project shape
interface ProjectData {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  archivedStatusBefore: Exclude<ProjectStatus, 'archived'> | null;
  goalTargetDate: string | null;
  goalSummary: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

// Server DTOs (as returned by API)
interface ServerProjectDTO {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  archivedStatusBefore?: ProjectStatus | null;
  goalTargetDate?: string | null;
  goalSummary?: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  memberAvatars?: Array<Record<string, unknown>>;
  lastModified?: string | null;
}

interface ProjectsListResponseDTO {
  projects: ServerProjectDTO[];
  total: number;
  limit: number;
  offset: number;
}

interface ProjectsListResponse {
  projects: ProjectData[];
  total: number;
  limit: number;
  offset: number;
}

interface ProjectsListQueryParams {
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

interface CreateProjectRequest {
  name: string;
  description?: string | null;
  visibility?: ProjectVisibility;
  goalTargetDate?: string | null;
  goalSummary?: string | null;
}

interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  visibility?: ProjectVisibility;
  status?: Exclude<ProjectStatus, 'archived'>;
  goalTargetDate?: string | null;
  goalSummary?: string | null;
}

interface UpdateProjectOptions {
  ifUnmodifiedSince: string;
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

interface DocumentResponse {
  document: {
    id: string;
    projectId: string;
    title: string;
    content: unknown;
    templateId: string;
    templateVersion: string;
    templateSchemaHash: string;
  };
  migration: Record<string, unknown> | null;
  templateDecision: Record<string, unknown>;
}

interface TemplateSummaryResponse {
  template: Record<string, unknown>;
}

interface TemplateVersionResponse {
  version: Record<string, unknown>;
}

type QualityGateStatusDTO = 'Pass' | 'Warning' | 'Blocker' | 'Neutral';
type QualityGateRunSourceDTO = 'auto' | 'manual' | 'dashboard';

interface RequirementGapDTO {
  requirementId: string;
  reason: 'no-link' | 'blocker' | 'warning-override';
  linkedSections: string[];
}

interface TraceabilityAuditEventDTO {
  eventId: string;
  type: 'link-created' | 'link-updated' | 'link-orphaned' | 'link-reassigned';
  timestamp: string;
  actorId: string;
  details?: Record<string, unknown>;
}

interface TraceabilityRequirementDTO {
  requirementId: string;
  sectionId: string;
  title: string;
  preview: string;
  gateStatus: QualityGateStatusDTO;
  coverageStatus: 'covered' | 'warning' | 'blocker' | 'orphaned';
  lastValidatedAt: string | null;
  validatedBy: string | null;
  notes: string[];
  revisionId: string;
  auditTrail: TraceabilityAuditEventDTO[];
}

interface TraceabilityMatrixResponseDTO {
  documentId: string;
  requirements: TraceabilityRequirementDTO[];
}

interface TraceabilityOrphanResponseDTO {
  requirementId: string;
  sectionId: string;
  coverageStatus: 'covered' | 'warning' | 'blocker' | 'orphaned';
  reason: 'no-link' | 'blocker' | 'warning-override';
  lastValidatedAt: string;
  validatedBy: string | null;
}

interface DocumentQualitySummaryDTO {
  documentId: string;
  statusCounts: {
    pass: number;
    warning: number;
    blocker: number;
    neutral: number;
  };
  blockerSections: string[];
  warningSections: string[];
  lastRunAt: string | null;
  triggeredBy: string;
  requestId: string;
  publishBlocked: boolean;
  coverageGaps: RequirementGapDTO[];
}

interface SectionQualityRuleResultDTO {
  ruleId: string;
  title: string;
  severity: QualityGateStatusDTO;
  guidance: string[];
  docLink?: string | null;
  location?: {
    path: string;
    start: number;
    end: number;
  };
}

interface SectionQualityGateResultDTO {
  sectionId: string;
  documentId: string;
  runId: string;
  status: QualityGateStatusDTO;
  rules: SectionQualityRuleResultDTO[];
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  triggeredBy: string;
  source: QualityGateRunSourceDTO;
  durationMs: number;
  remediationState: 'pending' | 'in-progress' | 'resolved';
  incidentId?: string | null;
  createdAt: string;
  updatedAt: string;
  requestId?: string | null;
}

interface QualityGateRunAcknowledgementDTO {
  requestId: string;
  status: 'queued' | 'running';
  runId: string;
  sectionId?: string;
  documentId: string;
  triggeredBy: string;
  receivedAt?: string;
}

class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;
  private requestId: string;
  private fixtureProjects: ProjectData[] | null = null;
  private lastAuthToken: string | null = null;
  private lastResponseMetadata: { lastModified?: string } = {};

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';
    this.getAuthToken = options.getAuthToken;
    this.requestId = this.generateRequestId();
  }

  private generateRequestId(): string {
    return `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  protected async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.buildRequestUrl(endpoint);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.requestId,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!('X-Client-Timezone-Offset' in headers)) {
      headers['X-Client-Timezone-Offset'] = String(new Date().getTimezoneOffset());
    }

    if (this.getAuthToken) {
      try {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          this.lastAuthToken = token;
        } else {
          this.lastAuthToken = null;
        }
      } catch (error) {
        logger.error(
          'Failed to get auth token in API client',
          {},
          error instanceof Error ? error : undefined
        );
        this.lastAuthToken = null;
      }
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      logger.debug?.('api.request', { endpoint, url });
      let response = await fetch(url, config);

      const fallbackUrl = !response.ok && response.status === 404
        ? this.buildFixtureFallbackUrl(endpoint)
        : null;

      if (fallbackUrl && fallbackUrl !== url) {
        logger.warn('Fixture fallback triggered for request', { endpoint, url, fallbackUrl });
        response = await fetch(fallbackUrl, config);
      }

      this.applyCorrelationFromResponse(response);

      if (!response.ok) {
        if (response.status === 404 && this.isFixtureMode() && endpoint.startsWith('/projects')) {
          const method = (config.method ?? 'GET').toUpperCase();
          const fixtureResult = this.handleFixtureProjectsRequest(endpoint, method, config);
          if (fixtureResult !== undefined) {
            return fixtureResult as T;
          }
        }
        const errorData = await response.json().catch(() => ({}));
        const normalizedMessage =
          (typeof errorData.message === 'string' && errorData.message.length > 0
            ? errorData.message
            : typeof errorData.error?.message === 'string' && errorData.error.message.length > 0
              ? errorData.error.message
              : undefined) ?? `HTTP ${response.status}: ${response.statusText}`;
        const error: ApiError = new Error(normalizedMessage);
        error.status = response.status;
        error.code =
          typeof errorData.error === 'string'
            ? errorData.error
            : typeof errorData.error?.code === 'string'
              ? errorData.error.code
              : undefined;
        error.body = errorData;
        if (errorData && typeof errorData === 'object' && 'details' in errorData) {
          error.details = (errorData as { details?: unknown }).details;
        }
        throw error;
      }

      const rawBody = await response.text();
      if (!rawBody || rawBody.trim().length === 0) {
        return undefined as T;
      }

      try {
        return JSON.parse(rawBody) as T;
      } catch {
        return rawBody as unknown as T;
      }
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

  private buildRequestUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  private isFixtureMode(): boolean {
    return this.baseUrl.includes('/__fixtures/api');
  }

  private resolveFixtureProjectsStore(): ProjectData[] {
    if (!this.fixtureProjects) {
      this.fixtureProjects = [];
    }
    return this.fixtureProjects;
  }

  private resolveFixtureUserId(): string {
    const token = this.lastAuthToken;
    if (typeof token === 'string' && token.includes(':')) {
      const [, rawUserId] = token.split(':');
      if (rawUserId && rawUserId.trim().length > 0) {
        return rawUserId.trim();
      }
    }
    return 'user_local';
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private handleFixtureProjectsRequest(
    endpoint: string,
    method: string,
    requestConfig: RequestInit
  ): ProjectsListResponse | ProjectData | void {
    const store = this.resolveFixtureProjectsStore();
    const [path = endpoint] = endpoint.split('?');

    if (method === 'GET') {
      if (path === '/projects' || path === '/projects/') {
        const query = endpoint.includes('?') ? endpoint.split('?')[1] : '';
        const params = new URLSearchParams(query);
        const limit = Number(params.get('limit') ?? store.length) || store.length;
        const offset = Number(params.get('offset') ?? 0) || 0;
        const includeArchived = params.get('includeArchived') === 'true';
        const filtered = includeArchived
          ? store
          : store.filter(project => project.status !== 'archived' && project.deletedAt === null);
        const slice = filtered.slice(offset, offset + limit);
        return {
          projects: slice,
          total: filtered.length,
          limit,
          offset,
        };
      }

      const projectMatch = path.match(/^\/projects\/([^/]+)$/);
      if (!projectMatch) {
        return undefined;
      }
      const projectId = projectMatch[1];
      const project = store.find(item => item.id === projectId);
      if (!project) {
        const error = new Error('Fixture project not found');
        (error as ApiError).status = 404;
        throw error;
      }
      return project;
    }

    if (method === 'POST' && path === '/projects') {
      const rawBody = requestConfig.body;
      const parsed = typeof rawBody === 'string' ? rawBody : rawBody ? rawBody.toString() : '{}';
      let payload: CreateProjectRequest;
      try {
        payload = JSON.parse(parsed) as CreateProjectRequest;
      } catch (error) {
        logger.error('Failed to parse project create payload for fixtures', { endpoint }, error instanceof Error ? error : undefined);
        payload = { name: 'Untitled Project' };
      }

      const now = new Date().toISOString();
      const ownerUserId = this.resolveFixtureUserId();
      const visibility = payload.visibility ?? 'workspace';
      const normalizedName = payload.name?.trim() ?? 'Untitled Project';
      const description = payload.description?.trim();
      const goalSummary = payload.goalSummary?.trim();

      const project: ProjectData = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `proj_${Math.random().toString(36).slice(2, 10)}`,
        ownerUserId,
        name: normalizedName,
        slug: this.generateSlug(normalizedName) || `project-${Date.now().toString(36)}`,
        description: description && description.length > 0 ? description : null,
        visibility,
        status: 'draft',
        goalTargetDate:
          payload.goalTargetDate && payload.goalTargetDate.length > 0
            ? payload.goalTargetDate
            : null,
        goalSummary: goalSummary && goalSummary.length > 0 ? goalSummary : null,
        createdAt: now,
        createdBy: ownerUserId,
        updatedAt: now,
        updatedBy: ownerUserId,
        deletedAt: null,
        deletedBy: null,
        archivedStatusBefore: null,
      };

      store.unshift(project);
      return project;
    }

    if (method === 'PATCH' && path.startsWith('/projects/')) {
      const rawBody = requestConfig.body;
      const parsed = typeof rawBody === 'string' ? rawBody : rawBody ? rawBody.toString() : '{}';
      let payload: UpdateProjectRequest;
      try {
        payload = JSON.parse(parsed) as UpdateProjectRequest;
      } catch (error) {
        logger.error('Failed to parse project update payload for fixtures', { endpoint }, error instanceof Error ? error : undefined);
        return;
      }

      const idMatch = path.match(/^\/projects\/([^/]+)$/);
      if (!idMatch) {
        return;
      }
      const projectId = idMatch[1];

      const storeRef = this.resolveFixtureProjectsStore();
      const existingIndex = storeRef.findIndex(project => project.id === projectId);
      if (existingIndex === -1) {
        return;
      }

      const existing = storeRef[existingIndex];
      if (!existing) {
        return;
      }

      const existingStatus = existing.status;
      const updated: ProjectData = {
        ...existing,
        name: payload.name ? payload.name.trim() : existing.name,
        description:
          payload.description && payload.description.trim().length > 0
            ? payload.description.trim()
            : payload.description === ''
              ? null
              : existing.description,
        visibility: payload.visibility ?? existing.visibility,
        status: payload.status ?? existingStatus,
        goalTargetDate:
          payload.goalTargetDate === null
            ? null
            : payload.goalTargetDate ?? existing.goalTargetDate,
        goalSummary:
          payload.goalSummary && payload.goalSummary.trim().length > 0
            ? payload.goalSummary.trim()
            : payload.goalSummary === ''
              ? null
              : existing.goalSummary,
        updatedAt: new Date().toISOString(),
        updatedBy: this.resolveFixtureUserId(),
      };

      storeRef[existingIndex] = updated;
      return updated;
    }

    if (method === 'DELETE' && path.startsWith('/projects/')) {
      const projectId = path.replace('/projects/', '');
      const storeRef = this.resolveFixtureProjectsStore();
      const existingIndex = storeRef.findIndex(project => project.id === projectId);
      if (existingIndex === -1) {
        const error = new Error('Fixture project not found');
        (error as ApiError).status = 404;
        throw error;
      }
      const existing = storeRef[existingIndex];
      if (!existing) {
        return;
      }

      const existingStatus = existing.status;
      if (existingStatus === 'archived') {
        return;
      }

      storeRef[existingIndex] = {
        ...existing,
        status: 'archived',
        archivedStatusBefore: existingStatus,
        deletedAt: new Date().toISOString(),
        deletedBy: this.resolveFixtureUserId(),
        updatedAt: new Date().toISOString(),
        updatedBy: this.resolveFixtureUserId(),
      };
      return;
    }

    if (method === 'POST' && path.endsWith('/restore')) {
      const projectId = path.replace('/projects/', '').replace('/restore', '');
      const storeRef = this.resolveFixtureProjectsStore();
      const existingIndex = storeRef.findIndex(project => project.id === projectId);
      if (existingIndex === -1) {
        const error = new Error('Fixture project not found');
        (error as ApiError).status = 404;
        throw error;
      }
      const existing = storeRef[existingIndex];
      if (!existing) {
        return;
      }

      const existingStatus = existing.status;
      if (existingStatus !== 'archived') {
        const conflict = new Error('Project is not archived');
        (conflict as ApiError).status = 409;
        throw conflict;
      }
      const restoredStatus = existing.archivedStatusBefore ?? 'paused';
      const updated: ProjectData = {
        ...existing,
        status: restoredStatus,
        archivedStatusBefore: null,
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date().toISOString(),
        updatedBy: this.resolveFixtureUserId(),
      };
      storeRef[existingIndex] = updated;
      return updated;
    }

    return;
  }

  private buildFixtureFallbackUrl(endpoint: string): string | null {
    if (!this.baseUrl.includes('/__fixtures/api')) {
      return null;
    }

    try {
      const fixtureUrl = new URL(this.baseUrl);
      const needsVersionedPath = endpoint.startsWith('/projects');
      const fallbackBase = `${fixtureUrl.protocol}//${fixtureUrl.host}${needsVersionedPath ? '/__fixtures/api/v1' : '/__fixtures/api'}`;
      const fallbackUrl = `${fallbackBase}${endpoint}`;
      const currentUrl = `${this.baseUrl}${endpoint}`;
      if (fallbackUrl === currentUrl) {
        return null;
      }
      return fallbackUrl;
    } catch (error) {
      logger.error(
        'Failed to compute fixture fallback URL',
        { baseUrl: this.baseUrl, endpoint },
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  private applyCorrelationFromResponse(response: Response): void {
    if (!response || typeof response.headers?.get !== 'function') {
      return;
    }

    const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
    const sessionId = response.headers.get('x-session-id') || response.headers.get('X-Session-ID');
    const lastModified =
      response.headers.get('last-modified') || response.headers.get('Last-Modified') || undefined;

    this.lastResponseMetadata = {
      lastModified: lastModified ?? undefined,
    };

    if (requestId || sessionId) {
      logger.setCorrelation({
        requestId: requestId ?? undefined,
        sessionId: sessionId ?? undefined,
      });
    }
  }

  private consumeLastModifiedHeader(): string | undefined {
    const value = this.lastResponseMetadata.lastModified;
    this.lastResponseMetadata = {};
    return value ?? undefined;
  }

  private normalizeProject(dto: ServerProjectDTO): ProjectData {
    return {
      id: dto.id,
      ownerUserId: dto.ownerUserId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      visibility: dto.visibility,
      status: dto.status,
      archivedStatusBefore:
        dto.archivedStatusBefore && dto.archivedStatusBefore !== 'archived'
          ? dto.archivedStatusBefore
          : null,
      goalTargetDate: dto.goalTargetDate ?? null,
      goalSummary: dto.goalSummary ?? null,
      createdAt: dto.createdAt,
      createdBy: dto.createdBy,
      updatedAt: dto.updatedAt,
      updatedBy: dto.updatedBy,
      deletedAt: dto.deletedAt ?? null,
      deletedBy: dto.deletedBy ?? null,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.makeRequest<HealthStatus>('/health');
  }

  async getProjects(params: ProjectsListQueryParams = {}): Promise<ProjectsListResponse> {
    const searchParams = new URLSearchParams();
    if (typeof params.limit === 'number') {
      searchParams.set('limit', String(params.limit));
    }
    if (typeof params.offset === 'number') {
      searchParams.set('offset', String(params.offset));
    }
    if (typeof params.includeArchived === 'boolean') {
      searchParams.set('includeArchived', params.includeArchived ? 'true' : 'false');
    }
    if (typeof params.search === 'string' && params.search.trim().length > 0) {
      searchParams.set('search', params.search.trim());
    }

    const query = searchParams.toString();
    const endpoint = `/projects${query ? `?${query}` : ''}`;
    const raw = await this.makeRequest<ProjectsListResponseDTO>(endpoint);
    const projects = (raw.projects ?? []).map(dto => this.normalizeProject(dto));

    return {
      projects,
      total: raw.total ?? projects.length,
      limit: raw.limit ?? projects.length,
      offset: raw.offset ?? 0,
    };
  }

  async getProject(id: string): Promise<ProjectData> {
    const response = await this.makeRequest<ServerProjectDTO>(`/projects/${id}`);
    return this.normalizeProject(response);
  }

  async createProject(project: CreateProjectRequest): Promise<ProjectData> {
    const response = await this.makeRequest<ServerProjectDTO>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return this.normalizeProject(response);
  }

  async updateProject(
    id: string,
    updates: UpdateProjectRequest,
    options: UpdateProjectOptions
  ): Promise<ProjectData> {
    const ifUnmodifiedSince = options?.ifUnmodifiedSince;
    if (!ifUnmodifiedSince || ifUnmodifiedSince.trim().length === 0) {
      throw new Error('updateProject requires an ifUnmodifiedSince concurrency token');
    }
    const response = await this.makeRequest<ServerProjectDTO>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      headers: {
        'If-Unmodified-Since': ifUnmodifiedSince,
      },
    });
    const lastModified = this.consumeLastModifiedHeader();
    const normalized = this.normalizeProject(response);
    if (lastModified) {
      return {
        ...normalized,
        updatedAt: lastModified,
      };
    }
    return normalized;
  }

  async deleteProject(id: string): Promise<void> {
    await this.makeRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async archiveProject(id: string): Promise<void> {
    await this.makeRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreProject(id: string): Promise<ProjectData> {
    const response = await this.makeRequest<ServerProjectDTO>(`/projects/${id}/restore`, {
      method: 'POST',
    });
    const lastModified = this.consumeLastModifiedHeader();
    const normalized = this.normalizeProject(response);
    if (lastModified) {
      normalized.updatedAt = lastModified;
    }
    return normalized;
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

  async getDocument(id: string): Promise<DocumentResponse> {
    return this.makeRequest<DocumentResponse>(`/documents/${id}`);
  }

  async getTemplate(id: string): Promise<TemplateSummaryResponse> {
    return this.makeRequest<TemplateSummaryResponse>(`/templates/${id}`);
  }

  async getTemplateVersion(templateId: string, version: string): Promise<TemplateVersionResponse> {
    return this.makeRequest<TemplateVersionResponse>(
      `/templates/${templateId}/versions/${version}`
    );
  }

  // Public API methods for dashboard feature
  async listProjects(params?: ProjectsListQueryParams): Promise<ProjectsListResponse> {
    return this.getProjects(params);
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

  async runSectionQualityGate(
    documentId: string,
    sectionId: string,
    payload?: { reason?: QualityGateRunSourceDTO }
  ): Promise<QualityGateRunAcknowledgementDTO> {
    return this.makeRequest<QualityGateRunAcknowledgementDTO>(
      `/documents/${documentId}/sections/${sectionId}/quality-gates/run`,
      {
        method: 'POST',
        body: payload?.reason ? JSON.stringify({ reason: payload.reason }) : undefined,
      }
    );
  }

  async getSectionQualityGate(
    documentId: string,
    sectionId: string
  ): Promise<SectionQualityGateResultDTO> {
    return this.makeRequest<SectionQualityGateResultDTO>(
      `/documents/${documentId}/sections/${sectionId}/quality-gates/result`
    );
  }

  async runDocumentQualityGate(
    documentId: string,
    payload?: { reason?: QualityGateRunSourceDTO }
  ): Promise<QualityGateRunAcknowledgementDTO> {
    return this.makeRequest<QualityGateRunAcknowledgementDTO>(
      `/documents/${documentId}/quality-gates/run`,
      {
        method: 'POST',
        body: payload?.reason ? JSON.stringify({ reason: payload.reason }) : undefined,
      }
    );
  }

  async getDocumentQualityGateSummary(documentId: string): Promise<DocumentQualitySummaryDTO> {
    return this.makeRequest<DocumentQualitySummaryDTO>(
      `/documents/${documentId}/quality-gates/summary`
    );
  }

  async getDocumentTraceability(documentId: string): Promise<TraceabilityMatrixResponseDTO> {
    return this.makeRequest<TraceabilityMatrixResponseDTO>(`/documents/${documentId}/traceability`);
  }

  async markTraceabilityRequirementOrphaned(
    documentId: string,
    payload: {
      requirementId: string;
      sectionId: string;
      reason?: 'no-link' | 'blocker' | 'warning-override';
    }
  ): Promise<TraceabilityOrphanResponseDTO> {
    return this.makeRequest<TraceabilityOrphanResponseDTO>(
      `/documents/${documentId}/traceability/orphans`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }
}

export const createApiClient = (options?: ApiClientOptions) => new ApiClient(options);

export default ApiClient;

export type {
  ApiClientOptions,
  ApiError,
  ProjectVisibility,
  ProjectStatus,
  ProjectData,
  ServerProjectDTO,
  ProjectsListResponseDTO,
  ProjectsListResponse,
  ProjectsListQueryParams,
  CreateProjectRequest,
  UpdateProjectRequest,
  UpdateProjectOptions,
  ConfigurationData,
  HealthStatus,
  ApiResponse,
  DashboardResponseDTO,
  DashboardProjectListItemDTO,
  ActivityDTO,
  ActivitiesListResponseDTO,
  SectionQualityGateResultDTO,
  SectionQualityRuleResultDTO,
  QualityGateRunAcknowledgementDTO,
  QualityGateRunSourceDTO,
  QualityGateStatusDTO,
  DocumentQualitySummaryDTO,
  TraceabilityMatrixResponseDTO,
  TraceabilityRequirementDTO,
  TraceabilityOrphanResponseDTO,
  TraceabilityAuditEventDTO,
};
