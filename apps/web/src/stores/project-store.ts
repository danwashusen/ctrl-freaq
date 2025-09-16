import { create } from 'zustand';

export type ViewMode = 'list' | 'grid';

export interface ProjectSummary {
  id: string;
  name: string;
}

interface ProjectState {
  sidebarOpen: boolean;
  activeProjectId: string | null;
  viewMode: ViewMode;
  setActiveProject: (id: string | null) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useProjectStore = create<ProjectState>(set => ({
  sidebarOpen: true,
  activeProjectId: null,
  viewMode: 'list',
  setActiveProject: id => set(state => ({ ...state, activeProjectId: id })),
  toggleSidebar: () => set(state => ({ ...state, sidebarOpen: !state.sidebarOpen })),
  setViewMode: mode => set(state => ({ ...state, viewMode: mode })),
}));
