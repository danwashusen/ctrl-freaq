import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ViewMode = 'list' | 'grid';

export interface ProjectSummary {
  id: string;
  name: string;
}

interface ProjectState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeProjectId: string | null;
  viewMode: ViewMode;
  lastFocusedTrigger: HTMLElement | null;
  setActiveProject: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setViewMode: (mode: ViewMode) => void;
  setLastFocusedTrigger: (element: HTMLElement | null) => void;
  clearLastFocusedTrigger: () => void;
}

const storageKey = 'ctrl-freaq:dashboard:project-store';

const createSessionStorage = (): Storage => {
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage) {
        return window.sessionStorage;
      }
    } catch {
      // fall through to memory storage fallback
    }
  }
  const memoryStore: Record<string, string> = {};
  return {
    getItem: (name: string) => memoryStore[name] ?? null,
    setItem: (name: string, value: string) => {
      memoryStore[name] = value;
    },
    removeItem: (name: string) => {
      delete memoryStore[name];
    },
    clear: () => {
      for (const key of Object.keys(memoryStore)) {
        delete memoryStore[key];
      }
    },
    key: (index: number) => Object.keys(memoryStore)[index] ?? null,
    get length() {
      return Object.keys(memoryStore).length;
    },
  };
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      activeProjectId: null,
      viewMode: 'list',
      lastFocusedTrigger: null,
      setActiveProject: id => {
        set({ activeProjectId: id });
      },
      setSidebarOpen: open => {
        set({ sidebarOpen: open });
      },
      toggleSidebar: () => {
        const current = get().sidebarOpen;
        set({ sidebarOpen: !current });
      },
      setSidebarCollapsed: collapsed => {
        set({ sidebarCollapsed: collapsed });
      },
      toggleSidebarCollapsed: () => {
        const current = get().sidebarCollapsed;
        set({ sidebarCollapsed: !current });
      },
      setViewMode: mode => set({ viewMode: mode }),
      setLastFocusedTrigger: element => {
        set({ lastFocusedTrigger: element });
      },
      clearLastFocusedTrigger: () => {
        set({ lastFocusedTrigger: null });
      },
    }),
    {
      name: storageKey,
      storage: createJSONStorage(createSessionStorage),
      partialize: state => ({
        activeProjectId: state.activeProjectId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
