import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionRemediationList } from './SectionRemediationList';

describe('SectionRemediationList', () => {
  it('renders remediation cards with severity badges and guidance steps', () => {
    render(
      <SectionRemediationList
        items={[
          {
            ruleId: 'qa.rule.blocker',
            severity: 'Blocker',
            summary: 'Add risk mitigation summary',
            steps: ['Document mitigation steps', 'Link to policy appendix'],
            docLink: { label: 'View policy', href: 'https://ctrl-freaq.dev/policy' },
          },
          {
            ruleId: 'qa.rule.warning',
            severity: 'Warning',
            summary: 'Include telemetry copy',
            steps: ['Reference `requestId` propagation.'],
            docLink: null,
          },
        ]}
      />
    );

    const cards = screen.getAllByTestId('remediation-card');
    expect(cards).toHaveLength(2);

    const firstCard = cards[0]!;
    const secondCard = cards[1]!;

    expect(firstCard).toHaveTextContent('Blocker');
    expect(firstCard).toHaveTextContent('Add risk mitigation summary');
    expect(firstCard).toHaveTextContent('Document mitigation steps');
    expect(firstCard).toHaveTextContent('Link to policy appendix');
    const linkElement = firstCard.querySelector<HTMLAnchorElement>('a');
    expect(linkElement).not.toBeNull();
    if (!linkElement) {
      throw new Error('Expected remediation card link to render');
    }
    expect(linkElement).toHaveTextContent('View policy');

    expect(secondCard).toHaveTextContent('Warning');
    expect(secondCard).toHaveTextContent('Include telemetry copy');
  });
});
