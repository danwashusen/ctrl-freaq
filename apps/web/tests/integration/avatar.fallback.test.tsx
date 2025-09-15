import { render, screen } from '@testing-library/react';
import { describe, test } from 'vitest';

// Placeholder import path per tasks; component to be implemented
import Avatar from '../../src/components/common/Avatar';

describe('Avatar rendering with fallback initials', () => {
  test('uses Clerk image when provided', () => {
    render(<Avatar name="Ada Lovelace" imageUrl="https://example.com/avatar.png" />);

    const img = screen.getByRole('img', { name: /Ada Lovelace/i });
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  test('falls back to initials when no image', () => {
    render(<Avatar name="Grace Hopper" />);

    // Expect initials GH rendered as text
    expect(screen.getByText('GH')).toBeInTheDocument();
  });
});
