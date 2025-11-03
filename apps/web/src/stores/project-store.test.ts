import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './project-store';

describe('project-store', () => {
  const storageKey = 'ctrl-freaq:dashboard:project-store';

  beforeEach(async () => {
    useProjectStore.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      activeProjectId: null,
      viewMode: 'list',
      lastFocusedTrigger: null,
    });
    await useProjectStore.persist.clearStorage();
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    await useProjectStore.persist.clearStorage();
    window.sessionStorage.clear();
    useProjectStore.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      activeProjectId: null,
      viewMode: 'list',
      lastFocusedTrigger: null,
    });
  });

  it('has sensible initial state', () => {
    const state = useProjectStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.activeProjectId).toBeNull();
    expect(state.viewMode).toBe('list');
    expect(state.lastFocusedTrigger).toBeNull();
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
    useProjectStore.getState().setSidebarOpen(true);
    expect(useProjectStore.getState().sidebarOpen).toBe(true);
  });

  it('toggles collapsed sidebar rail and persists the new value', () => {
    expect(useProjectStore.getState().sidebarCollapsed).toBe(false);

    useProjectStore.getState().toggleSidebarCollapsed();
    expect(useProjectStore.getState().sidebarCollapsed).toBe(true);

    useProjectStore.getState().setSidebarCollapsed(false);
    expect(useProjectStore.getState().sidebarCollapsed).toBe(false);

    useProjectStore.getState().setSidebarCollapsed(true);
    const stored = window.sessionStorage.getItem(storageKey);
    expect(stored).toContain('"sidebarCollapsed":true');
  });

  it('sets view mode', () => {
    useProjectStore.getState().setViewMode('grid');
    expect(useProjectStore.getState().viewMode).toBe('grid');
  });

  it('tracks last focused trigger', () => {
    const button = document.createElement('button');
    useProjectStore.getState().setLastFocusedTrigger(button);
    expect(useProjectStore.getState().lastFocusedTrigger).toBe(button);
    useProjectStore.getState().clearLastFocusedTrigger();
    expect(useProjectStore.getState().lastFocusedTrigger).toBeNull();
  });

  it('persists active project id to session storage', () => {
    useProjectStore.getState().setActiveProject('project-123');
    const stored = window.sessionStorage.getItem(storageKey);
    expect(stored).toBeTruthy();
    expect(stored).toContain('"activeProjectId":"project-123"');
  });
});
