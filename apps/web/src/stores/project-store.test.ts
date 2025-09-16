import { describe, it, expect } from 'vitest';
import { useProjectStore } from './project-store';

describe('project-store', () => {
  it('has sensible initial state', () => {
    const state = useProjectStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.activeProjectId).toBeNull();
    expect(state.viewMode).toBe('list');
  });

  it('sets active project and preserves immutability', () => {
    const before = useProjectStore.getState();
    useProjectStore.getState().setActiveProject('p1');
    const after = useProjectStore.getState();
    expect(after.activeProjectId).toBe('p1');
    // Zustand replaces state object; reference should differ
    expect(after).not.toBe(before);
  });

  it('toggles sidebar', () => {
    const initial = useProjectStore.getState().sidebarOpen;
    useProjectStore.getState().toggleSidebar();
    const toggled = useProjectStore.getState().sidebarOpen;
    expect(toggled).toBe(!initial);
  });

  it('sets view mode', () => {
    useProjectStore.getState().setViewMode('grid');
    expect(useProjectStore.getState().viewMode).toBe('grid');
  });
});
