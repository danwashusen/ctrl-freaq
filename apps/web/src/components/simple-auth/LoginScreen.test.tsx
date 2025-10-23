import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  const users = [
    {
      id: 'user_alpha',
      email: 'alpha@example.com',
      firstName: 'Alpha',
      lastName: 'Tester',
      orgRole: 'qa_lead',
    },
    {
      id: 'user_beta',
      email: 'beta@example.com',
      firstName: 'Beta',
      lastName: 'Analyst',
    },
  ];

  it('renders provided users and invokes onSelect when a user is chosen', async () => {
    const onSelect = vi.fn();
    render(
      <LoginScreen
        users={users}
        onSelect={onSelect}
        isLoading={false}
        selectedUserId={null}
        onResetSelection={vi.fn()}
      />
    );

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(users.length);
    const testIds = screen.getAllByTestId('simple-auth-user-card');
    expect(testIds).toHaveLength(users.length);

    const alphaCard = screen.getByRole('button', { name: /alpha tester/i });
    await userEvent.click(alphaCard);

    expect(onSelect).toHaveBeenCalledWith('user_alpha');
  });

  it('requests reselection when the saved user is no longer available', () => {
    const onResetSelection = vi.fn();

    render(
      <LoginScreen
        users={users}
        selectedUserId="stale_user"
        onSelect={vi.fn()}
        isLoading={false}
        onResetSelection={onResetSelection}
      />
    );

    expect(onResetSelection).toHaveBeenCalledTimes(1);
  });

  it('renders an error message when provided', () => {
    render(
      <LoginScreen
        users={[]}
        selectedUserId={null}
        onSelect={vi.fn()}
        isLoading={false}
        onResetSelection={vi.fn()}
        errorMessage="Failed to load users"
      />
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts.some(alert => alert.textContent?.includes('Failed to load users'))).toBe(true);
  });
});
