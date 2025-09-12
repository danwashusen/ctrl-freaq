# Research: Development Environment Bootstrap

## Monorepo Management

**Decision**: pnpm workspaces + Turborepo  
**Rationale**: 
- pnpm provides efficient disk space usage through content-addressable storage
- Turborepo offers intelligent build caching and parallel execution
- Both are production-proven at scale (used by Vercel, Microsoft, etc.)
**Alternatives considered**:
- npm workspaces: Less efficient, no built-in task orchestration
- Yarn workspaces: Good but pnpm is faster with better disk usage
- Lerna: Being deprecated in favor of native workspace solutions
- Nx: More complex than needed for MVP scope

## Frontend Framework

**Decision**: React 18.3 with Vite  
**Rationale**:
- Existing lovable.ai prototype already uses React
- Vite provides fastest HMR and build times
- React ecosystem mature for WYSIWYG editors (Milkdown)
- Wide AI agent familiarity
**Alternatives considered**:
- Next.js: Overkill for local-first MVP, adds complexity
- SvelteKit: Would require full rewrite of existing UI
- Vue: Less ecosystem support for our specific needs

## Backend Framework  

**Decision**: Express.js 5.1.0  
**Rationale**:
- Mature, stable, minimal abstraction
- Excellent middleware ecosystem
- Direct control over request/response cycle
- Aligns with simplicity principle
**Alternatives considered**:
- Fastify: Marginal performance gains not worth ecosystem trade-off
- Koa: Too minimal, would need to rebuild standard middleware
- NestJS: Violates simplicity principle with heavy abstractions

## Component Library

**Decision**: shadcn/ui  
**Rationale**:
- Already integrated in lovable.ai prototype
- Copy-paste model aligns with simplicity (no black box)
- Full TypeScript support
- Accessible by default (WCAG compliant)
**Alternatives considered**:
- MUI: Too opinionated, large bundle size
- Ant Design: Style conflicts with existing design
- Chakra UI: Runtime overhead, less control

## State Management

**Decision**: TanStack Query + Zustand  
**Rationale**:
- TanStack Query: Best-in-class server state management
- Zustand: Minimal boilerplate for client state
- Both already in lovable.ai prototype
- No complex abstractions
**Alternatives considered**:
- Redux Toolkit: Overkill for MVP scope
- MobX: Too much magic, harder to debug
- Jotai: Less mature, smaller ecosystem

## Testing Framework

**Decision**: Vitest  
**Rationale**:
- Vite-native for frontend consistency
- Jest-compatible API for easy migration
- Fast execution with native ESM support
- Works across all packages
**Alternatives considered**:
- Jest: Slower, requires more configuration for ESM
- Mocha/Chai: Less integrated tooling
- Playwright: For E2E only, not unit/integration

## Database

**Decision**: SQLite with better-sqlite3  
**Rationale**:
- Zero configuration for local development
- Synchronous API simplifies code
- Migration path to DynamoDB clear (key-value patterns)
- No external dependencies
**Alternatives considered**:
- PostgreSQL: Overkill for local MVP
- DynamoDB Local: Requires Docker, adds complexity
- LevelDB: Less SQL familiarity for team

## Authentication

**Decision**: Clerk  
**Rationale**:
- Already integrated in lovable.ai prototype
- Hosted solution reduces implementation time
- Excellent DX with React SDK
- JWT-based, works with Express.js
**Alternatives considered**:
- Auth0: More expensive, complex setup
- Supabase Auth: Requires additional infrastructure
- Roll-your-own: Violates focus on core features

## Logging

**Decision**: Pino  
**Rationale**:
- Fastest Node.js logger (benchmarked)
- Structured JSON logging for observability
- Browser version available for frontend
- Minimal overhead
**Alternatives considered**:
- Winston: Slower, more complex configuration
- Bunyan: Less maintained, fewer features
- console.log: Insufficient for production readiness

## Build Tools

**Decision**: TypeScript 5.4 strict mode  
**Rationale**:
- Catches errors at compile time
- Improves AI agent code generation
- Required for enterprise adoption
- Self-documenting code
**Alternatives considered**:
- JavaScript only: Too error-prone at scale
- TypeScript loose mode: Defeats purpose of type safety
- Flow: Less ecosystem support

## Package Manager

**Decision**: pnpm 9.x  
**Rationale**:
- 3x faster than npm for monorepos
- Strict dependency resolution prevents phantom dependencies
- Disk efficient with content-addressable storage
- Native workspace support
**Alternatives considered**:
- npm: Slower, less efficient for monorepos
- Yarn Berry: More complex configuration
- Bun: Too new, ecosystem compatibility issues

## CI/CD

**Decision**: GitHub Actions  
**Rationale**:
- Native GitHub integration
- Free for public repos
- Extensive marketplace of actions
- Matrix builds for testing
**Alternatives considered**:
- CircleCI: Additional service to manage
- Jenkins: Self-hosted complexity
- GitLab CI: Would require platform migration

## Development Patterns

**Decision**: Library-first architecture  
**Rationale**:
- Constitutional requirement
- Enforces separation of concerns
- Enables independent testing
- Promotes reusability
**Alternatives considered**:
- Monolithic app: Violates constitution
- Microservices: Premature for MVP
- Plugin architecture: Too complex for current scope

## Directory Structure

**Decision**: Feature-based organization  
**Rationale**:
- Scales better than type-based
- Colocates related code
- Easier to navigate
- Aligns with library boundaries
**Alternatives considered**:
- Type-based (components/, services/): Scattered features
- Domain-driven: Overkill for MVP
- Atomic design: Too granular

## Error Handling

**Decision**: Structured error envelopes  
**Rationale**:
- Consistent API responses
- Easier debugging with request IDs
- Security (no stack traces to client)
- Machine-readable error codes
**Alternatives considered**:
- Throw raw errors: Security risk
- GraphQL errors: Not using GraphQL
- Problem Details RFC: Too verbose for needs

## Performance Targets

**Decision**: Explicit metrics from PRD  
**Rationale**:
- TTFMP ≤ 2s: User experience requirement
- Server P95 ≤ 300ms: Responsiveness
- Based on PRD NFRs
**Alternatives considered**:
- No targets: Can't optimize what you don't measure
- Stricter targets: Premature optimization
- Looser targets: Poor user experience

---

All technical decisions align with Constitutional requirements and PRD specifications. No unresolved questions remain.