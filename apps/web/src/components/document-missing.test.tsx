import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';

import { DocumentMissing } from './document-missing';

const renderWithRouter = (ui: ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DocumentMissing', () => {
  it('falls back to dashboard navigation when no project is available', () => {
    renderWithRouter(<DocumentMissing documentId="doc-123" sectionId="sec-888" />);

    expect(screen.getByTestId('fixture-missing-view')).toBeInTheDocument();
    const primaryCta = screen.getByRole('link', { name: /back to dashboard/i });
    expect(primaryCta).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /provision new document/i })).not.toBeInTheDocument();
  });

  it('renders return/provision actions when a projectId is provided', () => {
    renderWithRouter(<DocumentMissing projectId="project-123" />);

    const returnLink = screen.getByRole('link', { name: /return to project/i });
    expect(returnLink).toHaveAttribute('href', '/projects/project-123');

    const provisionLink = screen.getByRole('link', { name: /provision new document/i });
    expect(provisionLink).toHaveAttribute('href', '/projects/project-123?workflow=create-document');
  });

  it('can hide the provision action even when projectId exists', () => {
    renderWithRouter(<DocumentMissing projectId="project-123" showProvisionAction={false} />);

    expect(screen.getByRole('link', { name: /return to project/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /provision new document/i })).not.toBeInTheDocument();
  });
});
