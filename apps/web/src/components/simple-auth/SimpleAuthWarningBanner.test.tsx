import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SimpleAuthWarningBanner } from './SimpleAuthWarningBanner';

describe('SimpleAuthWarningBanner', () => {
  it('renders warning content when provider is simple', () => {
    render(<SimpleAuthWarningBanner provider="simple" />);

    const banner = screen.getByTestId('simple-auth-warning');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/simple auth mode is active/i);
    expect(banner).toHaveTextContent(/simple:<userId>/i);
  });

  it('renders nothing when provider is clerk', () => {
    const { container } = render(<SimpleAuthWarningBanner provider="clerk" />);
    expect(container).toBeEmptyDOMElement();
  });
});
