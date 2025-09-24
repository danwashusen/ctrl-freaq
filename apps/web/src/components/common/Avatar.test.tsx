import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar', () => {
  it('renders image when imageUrl provided', () => {
    render(<Avatar name="Jane Doe" imageUrl="https://example.com/jane.jpg" />);
    const img = screen.getByRole('img', { name: 'Jane Doe' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/jane.jpg');
  });

  it('renders initials when no imageUrl', () => {
    render(<Avatar name="John Smith" />);
    const fallback = screen.getByLabelText('John Smith');
    expect(fallback).toBeInTheDocument();
    expect(fallback.textContent).toBe('JS');
  });
});
