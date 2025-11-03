import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dashboard palette tokens', () => {
  const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');

  it('includes Story 2.2 palette values for shell surfaces', () => {
    expect(css).toContain('--dashboard-shell-bg: 256 32% 9%;');
    expect(css).toContain('--dashboard-header-bg: 260 37% 13%;');
    expect(css).toContain('--dashboard-sidebar-bg: 265 61% 10%;');
    expect(css).toContain('--dashboard-shell-border: 261 29% 19%;');
    expect(css).toContain('--dashboard-header-gradient-start: 267 74% 18%;');
    expect(css).toContain('--dashboard-header-gradient-end: 264 70% 10%;');
    expect(css).toContain('--dashboard-sidebar-gradient-start: 263 69% 15%;');
    expect(css).toContain('--dashboard-sidebar-gradient-end: 260 60% 8%;');
  });

  it('defines lifecycle badge tokens for every project status', () => {
    ['draft', 'active', 'paused', 'completed', 'archived'].forEach(status => {
      expect(css).toContain(`--dashboard-status-${status}-bg`);
      expect(css).toContain(`--dashboard-status-${status}-text`);
    });
  });
});
