import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ApprovalPanelGate } from './approval-panel-gate';
import type { SectionStatus } from '../types/section-view';

const renderGate = (isEditing: boolean, status: SectionStatus | null | undefined) =>
  render(
    <ApprovalPanelGate isEditing={isEditing} sectionStatus={status}>
      <div data-testid="gated-panel">approval</div>
    </ApprovalPanelGate>
  );

describe('ApprovalPanelGate', () => {
  it('renders children while editing even if section is still drafting', () => {
    renderGate(true, 'drafting');

    expect(screen.getByTestId('gated-panel')).toBeInTheDocument();
  });

  it('renders children when not editing but section is in review', () => {
    renderGate(false, 'review');

    expect(screen.getByTestId('gated-panel')).toBeInTheDocument();
  });

  it('hides children when section status is idle and not editing', () => {
    renderGate(false, 'idle');

    expect(screen.queryByTestId('gated-panel')).not.toBeInTheDocument();
  });

  it('hides children when no section status is available', () => {
    renderGate(false, undefined);

    expect(screen.queryByTestId('gated-panel')).not.toBeInTheDocument();
  });
});
