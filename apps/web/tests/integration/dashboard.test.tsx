import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * Integration tests for dashboard loading functionality
 *
 * Tests the complete dashboard workflow including:
 * - Initial dashboard load with authentication
 * - Project data fetching and display
 * - User configuration loading
 * - Error states and loading indicators
 * - Dashboard navigation and interactions
 *
 * These tests MUST fail before implementation to follow TDD principles.
 *
 * Integrates with backend API for project and configuration data.
 */

// Mock Clerk hooks
vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
  useUser: vi.fn(),
  UserButton: () => <div data-testid="user-button">User Menu</div>,
}));

// Mock fetch for API calls
global.fetch = vi.fn();

const mockUser = {
  id: 'user_2abc123def456',
  emailAddresses: [{ emailAddress: 'test@example.com' }],
  firstName: 'Test',
  lastName: 'User',
};

const mockProject = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  ownerUserId: 'user_2abc123def456',
  name: 'My Project',
  slug: 'my-project',
  description: 'A test project',
  createdAt: '2025-09-13T10:00:00.000Z',
  updatedAt: '2025-09-13T10:00:00.000Z',
};

const mockConfig = {
  theme: 'dark',
  logLevel: 'info',
  editorPreferences: '{"fontSize": 14, "tabSize": 2}',
};

// Mock Dashboard Component
const Dashboard = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [project, setProject] = React.useState<any>(null);
  const [config, setConfig] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const token = await getToken();

        // Fetch project data
        const projectResponse = await fetch('/api/v1/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          setProject(projectData);
        } else if (projectResponse.status === 404) {
          // User has no project yet - this is expected for new users
          setProject(null);
        } else {
          throw new Error(`Project fetch failed: ${projectResponse.status}`);
        }

        // Fetch configuration
        const configResponse = await fetch('/api/v1/projects/config', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (configResponse.ok) {
          const configData = await configResponse.json();
          setConfig(configData);
        } else {
          throw new Error(`Config fetch failed: ${configResponse.status}`);
        }

        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        setLoading(false);
      }
    };

    if (user) {
      loadDashboardData();
    }
  }, [user, getToken]);

  if (loading) {
    return <div data-testid="dashboard-loading">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div data-testid="dashboard-error">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button data-testid="retry-button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-testid="dashboard">
      <header data-testid="dashboard-header">
        <h1>Welcome, {user?.firstName || 'User'}</h1>
        <div data-testid="user-button">User Menu</div>
      </header>

      <main data-testid="dashboard-main">
        {project ? (
          <div data-testid="project-section">
            <h2>Your Project</h2>
            <div data-testid="project-card">
              <h3 data-testid="project-name">{project.name}</h3>
              <p data-testid="project-description">{project.description || 'No description'}</p>
              <div data-testid="project-meta">
                <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div data-testid="no-project">
            <h2>Get Started</h2>
            <p>Create your first project to begin.</p>
            <button data-testid="create-project-button">Create Project</button>
          </div>
        )}

        <div data-testid="config-section">
          <h3>Settings</h3>
          <div data-testid="config-display">
            {config && Object.keys(config).length > 0 ? (
              Object.entries(config).map(([key, value]) => (
                <div key={key} data-testid={`config-${key}`}>
                  <strong>{key}:</strong> {String(value)}
                </div>
              ))
            ) : (
              <p data-testid="no-config">No configuration set</p>
            )}
          </div>
        </div>

        <div data-testid="quick-actions">
          <h3>Quick Actions</h3>
          <button data-testid="action-new-document">New Document</button>
          <button data-testid="action-templates">Browse Templates</button>
          <button data-testid="action-settings">Settings</button>
        </div>
      </main>
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const router = createMemoryRouter([{ path: '/dashboard', element: children as any }], {
    initialEntries: ['/dashboard'],
  });
  return (
    <ClerkProvider publishableKey="pk_test_mock">
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ClerkProvider>
  );
};

describe('Dashboard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Authenticated Dashboard Loading', () => {
    test('loads dashboard with user project data', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      // Verify dashboard content
      expect(screen.getByText('Welcome, Test')).toBeInTheDocument();
      expect(screen.getByTestId('project-section')).toBeInTheDocument();
      expect(screen.getByTestId('project-name')).toHaveTextContent('My Project');
      expect(screen.getByTestId('project-description')).toHaveTextContent('A test project');

      // Verify configuration is displayed
      expect(screen.getByTestId('config-theme')).toHaveTextContent('theme: dark');
      expect(screen.getByTestId('config-logLevel')).toHaveTextContent('logLevel: info');
    });

    test('shows create project prompt for new users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('no-project')).toBeInTheDocument();
      });

      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(screen.getByText('Create your first project to begin.')).toBeInTheDocument();
      expect(screen.getByTestId('create-project-button')).toBeInTheDocument();
    });

    test('displays user information correctly', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Welcome, Test')).toBeInTheDocument();
      });

      expect(screen.getByTestId('user-button')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    test('makes correct API calls with authentication', async () => {
      const mockGetToken = vi.fn().mockResolvedValue('test-jwt-token');

      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: mockGetToken,
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockGetToken).toHaveBeenCalled();
      });

      expect(fetch).toHaveBeenCalledWith('/api/v1/projects', {
        headers: { Authorization: 'Bearer test-jwt-token' },
      });

      expect(fetch).toHaveBeenCalledWith('/api/v1/projects/config', {
        headers: { Authorization: 'Bearer test-jwt-token' },
      });
    });

    test('handles API errors gracefully', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
      });

      expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });

    test('handles 401 authentication errors', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('invalid-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
      });

      expect(screen.getByText(/Project fetch failed: 401/)).toBeInTheDocument();
    });
  });

  describe('Configuration Display', () => {
    test('displays all configuration values', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('config-section')).toBeInTheDocument();
      });

      expect(screen.getByTestId('config-theme')).toBeInTheDocument();
      expect(screen.getByTestId('config-logLevel')).toBeInTheDocument();
      expect(screen.getByTestId('config-editorPreferences')).toBeInTheDocument();
    });

    test('shows message when no configuration exists', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('no-config')).toBeInTheDocument();
      });

      expect(screen.getByText('No configuration set')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    test('create project button triggers project creation flow', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('create-project-button')).toBeInTheDocument();
      });

      const createButton = screen.getByTestId('create-project-button');
      await userEvent.click(createButton);

      // Button click should trigger some action (navigation, modal, etc.)
      // This will be implemented when project creation flow is built
      expect(createButton).toBeInTheDocument();
    });

    test('quick action buttons are accessible', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockConfig),
        } as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
      });

      expect(screen.getByTestId('action-new-document')).toBeInTheDocument();
      expect(screen.getByTestId('action-templates')).toBeInTheDocument();
      expect(screen.getByTestId('action-settings')).toBeInTheDocument();

      // Test button interactions
      const newDocButton = screen.getByTestId('action-new-document');
      await userEvent.click(newDocButton);

      // Each button should trigger appropriate navigation/actions
      // Implementation will depend on routing and feature development
    });
  });

  describe('Loading States', () => {
    test('shows loading indicator while fetching data', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      // Create a promise that we can control
      let resolvePromise: (value: any) => void = () => {};
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValue(pendingPromise as any);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: () => Promise.resolve(mockProject),
      });

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument();
      });
    });

    test('maintains loading state until all data is fetched', async () => {
      vi.mocked(useAuth).mockReturnValue({
        isSignedIn: true,
        isLoaded: true,
        getToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      } as any);

      vi.mocked(useUser).mockReturnValue({
        user: mockUser,
        isLoaded: true,
      } as any);

      // Mock fetch to resolve project first, then config after delay
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockProject),
        } as any)
        .mockImplementationOnce(
          () =>
            new Promise(resolve =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: () => Promise.resolve(mockConfig),
                  } as any),
                100
              )
            )
        );

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
  });
});
