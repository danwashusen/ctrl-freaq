import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

// Contract schemas based on OpenAPI spec
const DashboardDataSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string().uuid(),
      ownerUserId: z.string(),
      name: z.string().min(1).max(255),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      description: z.string().max(500).nullable(),
      memberAvatars: z
        .array(
          z.object({
            userId: z.string(),
            imageUrl: z.string().url(),
            name: z.string(),
          })
        )
        .optional(),
      lastModified: z.string().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    })
  ),
  activities: z.array(
    z.object({
      id: z.string().uuid(),
      projectId: z.string().uuid(),
      projectName: z.string(),
      userId: z.string(),
      userAvatar: z.string().url(),
      userName: z.string(),
      type: z.enum([
        'document_created',
        'document_updated',
        'document_published',
        'member_added',
        'member_removed',
      ]),
      description: z.string().max(255),
      metadata: z.object({}).optional(),
      createdAt: z.string().datetime(),
    })
  ),
  stats: z.object({
    totalProjects: z.number().int().min(0),
    recentActivityCount: z.number().int().min(0),
  }),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
  details: z.object({}).optional(),
});

describe('GET /api/v1/dashboard Contract Tests', () => {
  let apiClient: any; // Will be replaced with actual client

  beforeAll(() => {
    // Setup will be done during implementation
    // apiClient = createTestClient();
  });

  it('should require authentication', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
    });

    expect(response.status).toBe(401);
    const error = await response.json();
    expect(() => ErrorResponseSchema.parse(error)).not.toThrow();
    expect(error.error).toBe('UNAUTHORIZED');
  });

  it('should return dashboard data with valid JWT', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_token_here',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(() => DashboardDataSchema.parse(data)).not.toThrow();
  });

  it('should include projects sorted alphabetically', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_token_here',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify projects are sorted
    const names = data.projects.map((p: any) => p.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });

  it('should return empty activities array for MVP', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_token_here',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activities).toEqual([]);
    expect(data.stats.recentActivityCount).toBe(0);
  });

  it('should include correct stats', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_token_here',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stats).toBeDefined();
    expect(data.stats.totalProjects).toBe(data.projects.length);
    expect(data.stats.recentActivityCount).toBe(0); // MVP
  });

  it('should handle user with no projects', async () => {
    // This test MUST fail initially (RED phase)
    // Test with a new user token that has no projects
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer new_user_jwt_token',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(() => DashboardDataSchema.parse(data)).not.toThrow();
    expect(data.projects).toEqual([]);
    expect(data.activities).toEqual([]);
    expect(data.stats.totalProjects).toBe(0);
  });

  it('should include request ID in response headers', async () => {
    // This test MUST fail initially (RED phase)
    const response = await fetch('http://localhost:5173/api/v1/dashboard', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid_jwt_token_here',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
