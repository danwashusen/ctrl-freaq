import type { Project, ProjectRepositoryImpl } from '@ctrl-freaq/shared-data';
import type { Logger } from 'pino';

export class ProjectAccessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'UNAUTHORIZED' | 'PROJECT_NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR',
    message: string
  ) {
    super(message);
    this.name = 'ProjectAccessError';
  }
}

interface RequireProjectAccessOptions {
  projectRepository: ProjectRepositoryImpl;
  projectId: string;
  userId: string | null | undefined;
  requestId?: string;
  logger?: Logger;
}

export async function requireProjectAccess({
  projectRepository,
  projectId,
  userId,
  requestId,
  logger,
}: RequireProjectAccessOptions): Promise<Project> {
  if (!userId) {
    throw new ProjectAccessError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  let project: Project | null = null;
  try {
    project = await projectRepository.findById(projectId);
  } catch (error) {
    logger?.error(
      {
        requestId,
        projectId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to load project for access check'
    );
    throw new ProjectAccessError(
      500,
      'INTERNAL_ERROR',
      'Failed to load project metadata for authorization'
    );
  }

  if (!project) {
    throw new ProjectAccessError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  if (project.ownerUserId !== userId) {
    throw new ProjectAccessError(
      403,
      'FORBIDDEN',
      'You do not have permission to access this project'
    );
  }

  return project;
}
