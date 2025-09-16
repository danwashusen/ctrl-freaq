import React from 'react';
import { useApi } from '../../lib/api-context';
import { useProjectStore } from '../../stores/project-store';
import type { ProjectData } from '../../lib/api';

export default function ProjectsNav() {
  const api = useApi();
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActiveProject = useProjectStore(s => s.setActiveProject);
  const [projects, setProjects] = React.useState<Array<Pick<ProjectData, 'id' | 'name'>>>([]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await api.projects.getAll();
        if (!cancelled) {
          // Map to minimal fields and sort alpha
          const minimal = list
            .map(p => ({ id: p.id, name: p.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setProjects(minimal);
        }
      } catch {
        // Silently ignore for MVP nav placeholder
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [api.projects]);

  return (
    <nav aria-label="Projects">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Projects</h2>
      <ul className="space-y-1">
        {projects.map(p => (
          <li key={p.id}>
            <button
              type="button"
              className={`w-full rounded px-2 py-1 text-left hover:bg-gray-100 ${
                activeProjectId === p.id ? 'bg-gray-200 font-semibold' : ''
              }`}
              aria-current={activeProjectId === p.id ? 'true' : undefined}
              onClick={() => setActiveProject(p.id)}
            >
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
