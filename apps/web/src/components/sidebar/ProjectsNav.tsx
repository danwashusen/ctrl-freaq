import { useMemo } from 'react';
import { Loader2, Folder, LayoutDashboard } from 'lucide-react';

import type { ProjectData } from '@/lib/api';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';
import { ProjectStatusBadge } from '@/components/status/ProjectStatusBadge';

type GlyphSize = 'sm' | 'md';

interface SidebarAccount {
  name: string;
  email?: string;
  avatarUrl?: string;
  onSwitchAccount?: () => void;
}

interface ProjectsNavProps {
  projects?: ProjectData[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  hasFiltersApplied?: boolean;
  searchTerm?: string;
  onProjectSelect?: (projectId: string) => void;
  onCreateProject?: () => void;
  onResetFilters?: () => void;
  onRetry?: () => void;
  activeProjectIdOverride?: string | null;
  isCollapsed?: boolean;
  currentUser?: SidebarAccount;
  onDashboardSelect?: () => void;
}

const glyphSizeMap: Record<GlyphSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
};

const glyphIconSizeMap: Record<GlyphSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

const buildInitials = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'PR';
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const single = parts[0] ?? trimmed;
    return single.slice(0, 2).toUpperCase();
  }
  const [firstPart] = parts;
  const lastPart = parts[parts.length - 1];
  const first = firstPart?.[0] ?? '';
  const last = lastPart?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
};

export default function ProjectsNav({
  projects,
  isLoading = false,
  isError = false,
  errorMessage,
  hasFiltersApplied = false,
  searchTerm,
  onProjectSelect,
  onCreateProject,
  onResetFilters,
  onRetry,
  activeProjectIdOverride,
  isCollapsed = false,
  currentUser,
  onDashboardSelect,
}: ProjectsNavProps = {}) {
  const storeActiveProjectId = useProjectStore(state => state.activeProjectId);
  const activeProjectId = activeProjectIdOverride ?? storeActiveProjectId;
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const dashboardActive = activeProjectId === null;

  const projectOptions = useMemo(() => {
    return (projects ?? [])
      .map(project => {
        const name = project.name.trim();
        return {
          id: project.id,
          name,
          status: project.status,
          initials: buildInitials(name || project.slug || project.id),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [projects]);

  const hasProjects = projectOptions.length > 0;
  const trimmedSearch = searchTerm?.trim() ?? '';
  const showLoading = isLoading;
  const showError = isError && !showLoading;
  const showEmpty = !showLoading && !showError && !hasProjects;
  const emptyMessage = hasFiltersApplied
    ? trimmedSearch.length > 0
      ? `No projects match "${trimmedSearch}"`
      : 'No projects match your filters'
    : 'No projects yet';
  const collapsed = Boolean(isCollapsed);
  const itemLabelClasses = cn('truncate', collapsed && 'sr-only');

  return (
    <nav
      aria-label="Dashboard navigation"
      data-testid="projects-nav"
      data-collapsed={collapsed ? 'true' : 'false'}
      className={cn('flex h-full flex-col gap-4', collapsed && 'items-center')}
    >
      <div
        data-testid="projects-nav-dashboard"
        data-active={dashboardActive ? 'true' : 'false'}
        className={cn('w-full', collapsed && 'flex justify-center')}
      >
        <button
          type="button"
          className={cn(
            'group flex w-full items-center gap-3 rounded-md border-l-2 px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
            collapsed && 'justify-center px-1.5 py-1.5',
            dashboardActive
              ? 'border-[hsl(var(--dashboard-sidebar-active-border))] bg-[hsla(var(--dashboard-sidebar-active-border),0.18)] font-semibold text-[hsl(var(--dashboard-sidebar-active-text))] shadow-sm'
              : 'border-transparent text-[hsl(var(--dashboard-sidebar-text))] hover:bg-[hsl(var(--dashboard-shell-hover-bg))]'
          )}
          aria-current={dashboardActive ? 'true' : undefined}
          aria-label={collapsed ? 'Dashboard' : undefined}
          onClick={() => {
            setActiveProject(null);
            onDashboardSelect?.();
          }}
        >
          <span className={cn('flex flex-1 items-center gap-3', collapsed && 'justify-center')}>
            <SidebarGlyph
              label="Dashboard"
              size={collapsed ? 'sm' : 'md'}
              testId="projects-nav-dashboard-glyph"
              initials="DB"
              fallback="dashboard"
            />
            <span
              className={cn(
                'flex flex-1 items-center justify-between gap-3 overflow-hidden',
                collapsed && 'w-0'
              )}
            >
              <span className={itemLabelClasses} data-testid="projects-nav-dashboard-label">
                Dashboard
              </span>
            </span>
          </span>
        </button>
      </div>
      <div className={cn('flex w-full flex-1 flex-col gap-3', collapsed && 'items-center')}>
        <h2
          className={cn(
            'mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-sidebar-muted))]',
            collapsed && 'sr-only'
          )}
        >
          Projects
        </h2>
        <ul className={cn('flex w-full flex-1 flex-col gap-2', collapsed && 'gap-1')}>
          {showLoading && (
            <li
              className="flex items-center gap-2 rounded-md bg-[hsl(var(--dashboard-shell-hover-bg))] px-3 py-2 text-sm text-[hsl(var(--dashboard-sidebar-muted))]"
              data-testid="projects-nav-loading"
            >
              <Loader2
                className="h-4 w-4 animate-spin text-[hsl(var(--dashboard-sidebar-muted))]"
                aria-hidden="true"
              />
              <span>Loading projects…</span>
            </li>
          )}
          {showError && (
            <li
              className="flex flex-col gap-2 rounded-md border border-[hsla(0,84%,57%,0.35)] bg-[hsla(0,84%,57%,0.12)] px-3 py-2 text-sm text-[hsl(var(--dashboard-sidebar-active-text))]"
              data-testid="projects-nav-error"
              role="status"
            >
              <span className="font-semibold">Failed to load projects</span>
              <span>{errorMessage ?? 'Please try again.'}</span>
              {onRetry && (
                <button
                  type="button"
                  className="w-max rounded-md border border-[hsla(0,84%,57%,0.45)] px-3 py-1 text-xs font-semibold text-[hsl(var(--dashboard-sidebar-active-text))] transition hover:bg-[hsla(0,84%,57%,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
                  onClick={onRetry}
                >
                  Try Again
                </button>
              )}
            </li>
          )}
          {showEmpty && (
            <li
              className="flex flex-col gap-3 rounded-md border border-dashed border-[hsl(var(--dashboard-shell-border))] px-3 py-4 text-sm text-[hsl(var(--dashboard-sidebar-text))]"
              data-testid="projects-nav-empty"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[hsl(var(--dashboard-sidebar-text))]">
                  {emptyMessage}
                </span>
                {hasFiltersApplied ? (
                  <span className="text-xs text-[hsl(var(--dashboard-sidebar-muted))]">
                    Adjust your filters or start a new workspace to continue.
                  </span>
                ) : (
                  <span className="text-xs text-[hsl(var(--dashboard-sidebar-muted))]">
                    Start your first workspace to unlock dashboard insights.
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {hasFiltersApplied && onResetFilters && (
                  <button
                    type="button"
                    className="w-max rounded-md border border-[hsl(var(--dashboard-shell-border))] px-3 py-1 text-xs font-medium text-[hsl(var(--dashboard-sidebar-text))] transition hover:bg-[hsl(var(--dashboard-shell-hover-bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
                    onClick={onResetFilters}
                  >
                    Reset filters
                  </button>
                )}
                {onCreateProject && (
                  <button
                    type="button"
                    className="w-max rounded-md border border-transparent bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:bg-[hsla(var(--primary),0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--dashboard-sidebar-bg))]"
                    onClick={onCreateProject}
                  >
                    Start a project
                  </button>
                )}
              </div>
            </li>
          )}
          {projectOptions.map(project => {
            const isActive = activeProjectId === project.id;
            const nameClasses = cn(itemLabelClasses, 'min-w-0', 'flex-1');
            return (
              <li
                key={project.id}
                data-testid="projects-nav-item"
                data-project-id={project.id}
                data-active={isActive ? 'true' : 'false'}
              >
                <button
                  type="button"
                  data-testid="projects-nav-button"
                  className={cn(
                    'group flex w-full items-center gap-2 rounded-md border-l-2 px-2.5 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
                    collapsed && 'justify-center px-1.5 py-1.5',
                    isActive
                      ? 'border-[hsl(var(--dashboard-sidebar-active-border))] bg-[hsla(var(--dashboard-sidebar-active-border),0.18)] font-semibold text-[hsl(var(--dashboard-sidebar-active-text))] shadow-sm'
                      : 'border-transparent text-[hsl(var(--dashboard-sidebar-text))] hover:bg-[hsl(var(--dashboard-shell-hover-bg))]'
                  )}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={collapsed ? project.name : undefined}
                  onClick={() => {
                    setActiveProject(project.id);
                    onProjectSelect?.(project.id);
                  }}
                >
                  <span
                    className={cn('flex flex-1 items-center gap-2', collapsed && 'justify-center')}
                  >
                    <SidebarGlyph
                      label={project.name}
                      size={collapsed ? 'sm' : 'md'}
                      testId="projects-nav-glyph"
                      initials={project.initials}
                      fallback="folder"
                    />
                    <span
                      className={cn(
                        'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2',
                        collapsed && 'w-0 overflow-hidden'
                      )}
                    >
                      <span
                        className={nameClasses}
                        data-testid="projects-nav-name"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      <span className="shrink-0 justify-self-end pl-2">
                        <ProjectStatusBadge
                          status={project.status}
                          size={collapsed ? 'sm' : 'md'}
                          label={false}
                          data-status={project.status}
                          data-testid="projects-nav-status"
                        />
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {currentUser ? (
        <div
          data-testid="projects-nav-account"
          className={cn(
            'mt-auto w-full rounded-lg border border-[hsl(var(--dashboard-shell-border))] bg-[hsl(var(--dashboard-account-bg))] p-3 text-sm text-[hsl(var(--dashboard-sidebar-text))] shadow-sm transition',
            collapsed && 'flex flex-col items-center gap-2 p-2 text-xs'
          )}
        >
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col gap-2 text-center')}>
            <SidebarGlyph
              label={currentUser.name}
              avatarUrl={currentUser.avatarUrl}
              size={collapsed ? 'sm' : 'md'}
              testId="projects-nav-account-glyph"
              initials={buildInitials(currentUser.name)}
            />
            <div className={cn('flex flex-col', collapsed && 'items-center')}>
              <span className="font-semibold">{currentUser.name}</span>
              {currentUser.email ? (
                <span className="text-xs text-[hsl(var(--dashboard-sidebar-muted))]">
                  {currentUser.email}
                </span>
              ) : null}
            </div>
          </div>
          {currentUser.onSwitchAccount ? (
            <button
              type="button"
              className={cn(
                'mt-3 inline-flex w-full items-center justify-center rounded-md border border-[hsl(var(--dashboard-shell-border))] px-3 py-1 text-xs font-semibold text-[hsl(var(--dashboard-sidebar-active-text))] transition hover:bg-[hsl(var(--dashboard-shell-hover-bg))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
                collapsed && 'mt-2'
              )}
              onClick={() => {
                currentUser.onSwitchAccount?.();
              }}
            >
              Switch user
            </button>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

function SidebarGlyph({
  label,
  avatarUrl,
  size = 'md',
  testId,
  initials,
  fallback = 'initials',
}: {
  label: string;
  avatarUrl?: string;
  size?: GlyphSize;
  testId?: string;
  initials: string;
  fallback?: 'initials' | 'folder' | 'dashboard';
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label}
        className={cn(
          'shrink-0 rounded-xl border border-[hsl(var(--dashboard-product-mark-border))] object-cover',
          glyphSizeMap[size]
        )}
        data-testid={testId}
      />
    );
  }

  if (fallback === 'folder') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--dashboard-product-mark-border))] bg-[hsl(var(--dashboard-sidebar-glyph-bg))] font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-sidebar-glyph-text))]',
          glyphSizeMap[size]
        )}
        data-testid={testId}
      >
        <Folder
          aria-hidden="true"
          className={cn(glyphIconSizeMap[size])}
          data-testid={testId ? `${testId}-icon` : undefined}
        />
      </span>
    );
  }

  if (fallback === 'dashboard') {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--dashboard-product-mark-border))] bg-[hsl(var(--dashboard-sidebar-glyph-bg))] font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-sidebar-glyph-text))]',
          glyphSizeMap[size]
        )}
        data-testid={testId}
      >
        <LayoutDashboard
          aria-hidden="true"
          className={cn(glyphIconSizeMap[size])}
          data-testid={testId ? `${testId}-icon` : undefined}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--dashboard-product-mark-border))] bg-[hsl(var(--dashboard-sidebar-glyph-bg))] font-semibold uppercase tracking-wide text-[hsl(var(--dashboard-sidebar-glyph-text))]',
        glyphSizeMap[size]
      )}
      data-testid={testId}
    >
      {initials}
    </span>
  );
}
