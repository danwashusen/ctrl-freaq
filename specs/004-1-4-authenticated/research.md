# Research Document: Authenticated App Layout + Dashboard

**Feature**: Authenticated App Layout + Dashboard **Date**: 2025-09-15
**Status**: Complete

## Standards Digest

**Backend Standards (from Architecture Document):**

- Service Locator: Resolve per-request services from req.services
  - Bad: `import logger from '../logger-singleton'`
  - Good: `const logger = req.services.get<Logger>('logger')`
- Auth Validation: Check JWT on all /api/v1/\* routes
  - Return 401 for invalid/expired, log auth events
- Repository Pattern: All data access through typed repositories
  - Bad: `db.exec('SELECT * FROM projects')`
  - Good:
    `const repo = new ProjectRepository(db); await repo.findByUserId(userId)`
- Structured Logging: Pino with request context
  - Bad: `console.log('Dashboard accessed')`
  - Good: `logger.info({ requestId, userId }, 'Dashboard accessed')`
- Input Validation: Zod schemas at API boundaries
  - Return structured errors with requestId
- Additional Standards:
  - Log all authentication events: timestamp, user_id, ip_address, action
  - Log data access: timestamp, user_id, resource_type, fields_accessed
  - Audit fields in tables: created_by, updated_by, updated_at
  - Rate limiting with memory cleanup to prevent leaks
  - CORS allowlist validation for production

## UI Standards Digest

**Frontend Standards (from UI Architecture Document):**

- Component Composition: Hooks and composition over inheritance
  - Bad: `class Dashboard extends BasePage`
  - Good: `const Dashboard: FC = () => { const { projects } = useProjects(); }`
- State Management: Immutable updates with Zustand/Immer
  - Never mutate directly, use TanStack Query for server state
- Protected Routes: Wrap with ProtectedRoute checking isSignedIn
- Error Boundaries: Wrap features for graceful failures
- Accessibility: Semantic HTML, ARIA labels, keyboard nav
- Loading States: Spinners/skeletons for all async ops
- Type Safety: No any types, Zod validation for API responses
- Testing: RTL focus on user interactions, test loading/error states
- Browser Logging: Pino with backend transmission for errors

- Loading States and Errors
  - Bad: Render null while fetching; show generic "Error" with no retry
  - Good: Show accessible spinner/skeleton with aria-labels; render specific
    error with retry action and requestId when available

## Technical Decisions

### 1. Authentication Flow with Clerk

**Decision**: Use Clerk's React SDK with JWT validation middleware
**Rationale**:

- Already integrated in the codebase
  (`apps/web/src/app/router/protected-route.tsx`)
- Provides seamless JWT token management
- Supports session validation on backend via `@clerk/clerk-sdk-node`
  **Alternatives considered**:
- Auth0: More complex setup, overkill for MVP
- Custom JWT: Would require building session management from scratch
- NextAuth: Not applicable since using Express.js backend

### 2. Project Data Access Pattern

**Decision**: Use existing ProjectRepository with findByUserId method
**Rationale**:

- Repository pattern already established in `packages/shared-data`
- Provides abstraction for future DynamoDB migration
- Consistent with constitutional requirements **Alternatives considered**:
- Direct SQLite queries: Would break abstraction layer
- GraphQL: Unnecessary complexity for simple list queries
- REST with ORM: Repository pattern already provides this abstraction

### 3. Dashboard Layout Implementation

**Decision**: Two-column layout using CSS Grid with shadcn/ui components
**Rationale**:

- CSS Grid provides responsive layout capabilities
- shadcn/ui components are already integrated
- Follows existing UI patterns in the codebase **Alternatives considered**:
- Flexbox: Less semantic for grid layouts
- Custom component library: Would duplicate existing shadcn/ui
- Material-UI: Would introduce new dependency

### 4. State Management for Dashboard

**Decision**: Zustand for client state + TanStack Query for server state
**Rationale**:

- Already configured in the project
- TanStack Query handles caching, refetching, and loading states
- Zustand manages active project selection and UI state **Alternatives
  considered**:
- Redux: Overkill for this feature's state needs
- Context API only: Lacks caching and server state features
- SWR: TanStack Query already integrated

### 5. Empty State Handling

**Decision**: Dedicated EmptyState component with contextual messages
**Rationale**:

- Consistent UX pattern across the application
- Clear user guidance when no data exists
- Reusable component for projects and activities **Alternatives considered**:
- Inline conditionals: Less maintainable
- Default data: Would be misleading to users
- Hide sections: Poor UX, doesn't guide users

### 6. API Endpoint Structure

**Decision**: RESTful endpoints under /api/v1/\* namespace **Rationale**:

- Consistent with existing API patterns
- Version namespace allows future changes
- Standard REST semantics for CRUD operations **Alternatives considered**:
- GraphQL: Overkill for simple queries
- RPC-style: Less semantic than REST
- No versioning: Would complicate future migrations

### 7. Testing Strategy

**Decision**: Contract tests → Integration tests → E2E tests → Unit tests
**Rationale**:

- Follows constitutional TDD requirements
- Contract tests ensure API compatibility
- Integration tests validate feature flows
- E2E tests with Playwright verify user journeys **Alternatives considered**:
- Unit tests first: Violates constitutional order
- Skip contract tests: Would miss API regressions
- Manual testing only: Not sustainable

## Implementation Patterns

### Protected Route Pattern

```typescript
// Use existing ProtectedRoute wrapper
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```

### API Client Pattern

```typescript
// Use existing apiClient with automatic token injection
const projects = await apiClient.get<Project[]>('/api/v1/projects');
```

### Repository Access Pattern

```typescript
// Backend: Use Service Locator for repository access
const projectRepo = req.services.get<ProjectRepository>('projectRepository');
const projects = await projectRepo.findByUserId(req.auth.userId);
```

### State Management Pattern

```typescript
// Frontend: Combine server and client state
const { data: projects, isLoading } = useQuery({
  queryKey: ['projects', userId],
  queryFn: () => projectService.getUserProjects(),
});

const { activeProjectId, setActiveProject } = useProjectStore();
```

### Empty State Pattern

```typescript
// Reusable empty state component
<EmptyState
  icon={<FolderIcon />}
  title="No projects yet"
  description="Create your first project to get started"
  action={{ label: "Create Project", onClick: handleCreate }}
/>
```

## API Contract Specifications

### GET /api/v1/projects

- **Purpose**: List authenticated user's projects
- **Auth**: Required (JWT)
- **Response**: Array of Project objects sorted alphabetically
- **Status codes**: 200 (success), 401 (unauthorized)

### GET /api/v1/dashboard

- **Purpose**: Aggregate dashboard data
- **Auth**: Required (JWT)
- **Response**: { projects: Project[], activities: Activity[] }
- **Status codes**: 200 (success), 401 (unauthorized)

### GET /api/v1/activities

- **Purpose**: List recent activities (empty for MVP)
- **Auth**: Required (JWT)
- **Response**: Empty array for MVP
- **Status codes**: 200 (success), 401 (unauthorized)

## Performance Considerations

1. **Data Loading**:
   - Use TanStack Query for automatic caching
   - Implement stale-while-revalidate pattern
   - Prefetch dashboard data on auth success

2. **Bundle Size**:
   - Lazy load dashboard route component
   - Tree-shake unused shadcn/ui components
   - Use dynamic imports for heavy features

3. **Rendering**:
   - Memoize project list items
   - Virtual scrolling for large project lists (future)
   - Debounce search/filter operations

## Security Considerations

1. **Authentication**:
   - Validate JWT on every API request
   - Check token expiration
   - Log authentication events per SOC 2

2. **Authorization**:
   - Verify user owns requested projects
   - Implement row-level security in repositories
   - Return 403 for unauthorized resource access

3. **Data Protection**:
   - No sensitive data in localStorage
   - Use httpOnly cookies for session
   - Sanitize user-generated content

## Accessibility Requirements

1. **Keyboard Navigation**:
   - Tab order through sidebar projects
   - Enter/Space to select project
   - Escape to close modals

2. **Screen Readers**:
   - Semantic HTML structure
   - ARIA labels for interactive elements
   - Announce state changes

3. **Visual Design**:
   - WCAG AA contrast ratios
   - Focus indicators on all interactive elements
   - Responsive text sizing

## Migration Path Considerations

1. **SQLite → DynamoDB**:
   - Repository pattern abstracts database
   - No JOINs in queries (already enforced)
   - Cursor-based pagination ready

2. **Local → AWS**:
   - Environment variables for API URLs
   - CDN-ready static assets
   - Lambda-compatible Express routes

## Open Questions Resolved

All technical decisions have been researched and resolved. No NEEDS
CLARIFICATION items remain.

## Next Steps

1. Generate data model documentation
2. Create OpenAPI contracts
3. Write contract tests (must fail initially)
4. Extract test scenarios from user stories
5. Update CLAUDE.md with new context

---

_Research completed for Phase 0 of implementation plan_
