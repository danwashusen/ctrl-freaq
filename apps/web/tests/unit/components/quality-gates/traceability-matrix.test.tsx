import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  TraceabilityMatrix,
  type TraceabilityMatrixProps,
} from '@/features/document-editor/quality-gates/components/TraceabilityMatrix';
import {
  TraceabilityAlerts,
  type TraceabilityAlertsProps,
} from '@/features/document-editor/quality-gates/components/TraceabilityAlerts';

const buildMatrixProps = (
  overrides: Partial<TraceabilityMatrixProps> = {}
): TraceabilityMatrixProps => ({
  requirements: [
    {
      requirementId: 'req-governance-escalation',
      sectionId: 'sec-overview',
      title: 'Escalation policy documented',
      preview: 'Document escalation paths for outages with executive contacts.',
      gateStatus: 'Blocker',
      coverageStatus: 'blocker',
      lastValidatedAt: '2025-10-13T11:30:00.000Z',
      validatedBy: 'user-nova',
      notes: ['Escalation summary missing for L3 incidents.'],
      revisionId: 'rev-sec-overview-test',
      auditTrail: [],
    },
    {
      requirementId: 'req-authentication-policy',
      sectionId: 'sec-security',
      title: 'Authentication policy recorded',
      preview: 'Summarize authentication providers and MFA enforcement.',
      gateStatus: 'Pass',
      coverageStatus: 'covered',
      lastValidatedAt: '2025-10-12T08:15:00.000Z',
      validatedBy: 'user-morgan',
      notes: [],
      revisionId: 'rev-sec-security-test',
      auditTrail: [],
    },
  ],
  onFilterChange: overrides.onFilterChange ?? vi.fn(),
  initialFilter: overrides.initialFilter ?? 'all',
});

describe('TraceabilityMatrix', () => {
  it('renders requirements and filters by status', () => {
    const props = buildMatrixProps();
    render(<TraceabilityMatrix {...props} />);

    expect(screen.getByRole('heading', { name: /Traceability matrix/i })).toBeVisible();
    expect(screen.getByText(/Escalation policy documented/i)).toBeVisible();
    expect(screen.getByText(/Authentication policy recorded/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Blockers/i }));

    expect(screen.getByText(/Escalation policy documented/i)).toBeVisible();
    expect(screen.queryByText(/Authentication policy recorded/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Covered/i }));

    expect(screen.queryByText(/Escalation policy documented/i)).toBeNull();
    expect(screen.getByText(/Authentication policy recorded/i)).toBeVisible();
  });

  it('announces when no requirements match the selected filter', () => {
    const props = buildMatrixProps({
      initialFilter: 'warnings',
    });
    render(<TraceabilityMatrix {...props} />);

    expect(screen.getByText(/No traceability entries match the selected filter/i)).toBeVisible();
  });
});

const buildAlertsProps = (
  overrides: Partial<TraceabilityAlertsProps> = {}
): TraceabilityAlertsProps => ({
  orphanedCount: overrides.orphanedCount ?? 2,
  slowRunIncidentId: overrides.slowRunIncidentId ?? 'incident-trace-123',
  lastRunAt: overrides.lastRunAt ?? '2025-10-14T08:30:00.000Z',
  onResolveGaps: overrides.onResolveGaps ?? vi.fn(),
});

describe('TraceabilityAlerts', () => {
  it('renders orphan banner with action', () => {
    const props = buildAlertsProps();
    render(<TraceabilityAlerts {...props} />);

    expect(
      screen.getByText(/Traceability gap detected: 2 requirements need reassignment/i)
    ).toBeVisible();
    expect(screen.getByText(/Last validation run completed on 14 Oct/i)).toBeVisible();
    expect(screen.getByText(/Reference incident incident-trace-123 in follow-ups/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /Resolve now/i }));
    expect(props.onResolveGaps).toHaveBeenCalledTimes(1);
  });

  it('suppresses banner when there are no orphaned requirements', () => {
    const props = buildAlertsProps({ orphanedCount: 0, slowRunIncidentId: null });
    render(<TraceabilityAlerts {...props} />);

    expect(screen.queryByText(/Traceability gap detected/i)).toBeNull();
  });
});
