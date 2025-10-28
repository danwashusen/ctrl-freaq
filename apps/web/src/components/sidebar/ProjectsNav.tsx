import { useMemo } from 'react';

import type { ProjectData } from '@/lib/api';
import { useProjectStore } from '@/stores/project-store';

interface ProjectsNavProps {
  projects?: ProjectData[];
  isLoading?: boolean;
}

const STATUS_STYLES: Record<ProjectData['status'], string> = {
  draft: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  completed: 'bg-purple-100 text-purple-800',
  archived: 'bg-slate-200 text-slate-700',
};

const formatStatusLabel = (status: ProjectData['status']): string =>
  status.charAt(0).toUpperCase() + status.slice(1);

export default function ProjectsNav({ projects, isLoading = false }: ProjectsNavProps = {}) {
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const setActiveProject = useProjectStore(state => state.setActiveProject);

  const projectOptions = useMemo(() => {
    return (projects ?? [])
      .map(project => ({ id: project.id, name: project.name, status: project.status }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  return (
    <nav aria-label="Projects">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Projects</h2>
      <ul className="space-y-1">
        {isLoading ? (
          <li className="text-sm text-gray-500">Loading…</li>
        ) : projectOptions.length === 0 ? (
          <li className="text-sm text-gray-500">No projects yet</li>
        ) : (
          projectOptions.map(project => (
            <li key={project.id}>
              <button
                type="button"
                className={`w-full rounded px-2 py-2 text-left hover:bg-gray-100 ${
                  activeProjectId === project.id ? 'bg-gray-200 font-semibold' : ''
                }`}
                aria-current={activeProjectId === project.id ? 'true' : undefined}
                onClick={() => setActiveProject(project.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{project.name}</span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[project.status]
                    }`}
                  >
                    {formatStatusLabel(project.status)}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </nav>
  );
}
