import { render, screen } from '@testing-library/react';

import type { ProjectStatus } from '@/lib/api';

import { ProjectStatusBadge } from './ProjectStatusBadge';

describe('ProjectStatusBadge', () => {
  const statusTokens: Record<ProjectStatus, { bg: string; text: string }> = {
    draft: {
      bg: 'bg-[hsl(var(--dashboard-status-draft-bg))]',
      text: 'text-[hsl(var(--dashboard-status-draft-text))]',
    },
    active: {
      bg: 'bg-[hsl(var(--dashboard-status-active-bg))]',
      text: 'text-[hsl(var(--dashboard-status-active-text))]',
    },
    paused: {
      bg: 'bg-[hsl(var(--dashboard-status-paused-bg))]',
      text: 'text-[hsl(var(--dashboard-status-paused-text))]',
    },
    completed: {
      bg: 'bg-[hsl(var(--dashboard-status-completed-bg))]',
      text: 'text-[hsl(var(--dashboard-status-completed-text))]',
    },
    archived: {
      bg: 'bg-[hsl(var(--dashboard-status-archived-bg))]',
      text: 'text-[hsl(var(--dashboard-status-archived-text))]',
    },
  };

  it('renders label and icon by default', () => {
    render(<ProjectStatusBadge status="active" />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveTextContent('Active');
    expect(screen.getByTestId('project-status-badge-icon')).toBeInTheDocument();
  });

  it('omits the label when label is set to false but retains accessible name', () => {
    render(<ProjectStatusBadge status="paused" label={false} />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveAttribute('aria-label', 'Paused');
    expect(badge).toHaveAttribute('title', 'Paused');
    expect(badge).not.toHaveTextContent(/Paused/i);
  });

  it('omits the icon when icon is set to false', () => {
    render(<ProjectStatusBadge status="completed" icon={false} />);

    expect(screen.queryByTestId('project-status-badge-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-status-badge')).toHaveTextContent('Completed');
  });

  it('applies the small size styles when size is sm', () => {
    render(<ProjectStatusBadge status="draft" size="sm" />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge.className).toContain('text-[0.6875rem]');
    expect(badge).toHaveAttribute('title', 'Draft');
  });

  it('sets an accessible label when both icon and label are disabled', () => {
    render(<ProjectStatusBadge status="archived" icon={false} label={false} />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveAttribute('aria-label', 'Archived');
    expect(badge).toHaveAttribute('title', 'Archived');
  });

  it('falls back gracefully when the status is missing or unknown', () => {
    render(<ProjectStatusBadge status={undefined as unknown as ProjectStatus} />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveAttribute('data-status', 'unknown');
    expect(badge).toHaveTextContent('Unknown status');
  });

  it.each(Object.entries(statusTokens))('applies status tokens for %s badges', (status, tokens) => {
    render(<ProjectStatusBadge status={status as ProjectStatus} />);

    const badge = screen.getByTestId('project-status-badge');
    expect(badge).toHaveAttribute('data-status', status);
    expect(badge.className).toContain(tokens.bg);
    expect(badge.className).toContain(tokens.text);
  });

  it('uses draft token colors as fallback styling when status is unknown', () => {
    render(<ProjectStatusBadge status={undefined as unknown as ProjectStatus} />);

    const badge = screen.getByTestId('project-status-badge');
    const draftTokens = statusTokens.draft;
    expect(badge.className).toContain(draftTokens.bg);
    expect(badge.className).toContain(draftTokens.text);
  });
});
