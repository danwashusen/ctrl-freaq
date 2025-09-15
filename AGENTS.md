# Claude Code Context - CTRL FreaQ

## Project Overview

CTRL FreaQ is an AI-optimized documentation system built as a monorepo with
React frontend and Express.js backend. The project follows Constitutional
principles including library-first architecture, mandatory TDD, and CLI
interfaces for all libraries.

## Current Development

**Branch**: 002-1-1-development **Status**: ✅ COMPLETE - Development
Environment Bootstrap **Focus**: All 62 tasks completed including monorepo
infrastructure, security fixes, and frontend integration

## Technical Stack

- **Languages**: TypeScript 5.4.x, Node.js 22.x
- **Frontend**: React 18.3.x, Vite 5.x, shadcn/ui, Tailwind CSS
- **Backend**: Express.js 5.1.0, SQLite with better-sqlite3
- **Testing**: Vitest 1.x, React Testing Library
- **Monorepo**: pnpm workspaces + Turborepo
- **Logging**: Pino 9.5.0 (structured JSON)
- **Auth**: Clerk (JWT-based)

## Project Structure

```
ctrl-freaq/
├── apps/
│   ├── web/          # React frontend (adapted from lovable.ai prototype)
│   └── api/          # Express.js backend
├── packages/         # Library packages (all with CLI interfaces)
│   ├── shared-data/  # Repository pattern data access
│   ├── templates/    # YAML template engine
│   ├── ai/          # LLM integration (Vercel AI SDK)
│   ├── qa/          # Quality gates
│   ├── exporter/    # Document export
│   ├── editor-core/ # WYSIWYG editor
│   ├── editor-persistence/ # Client persistence
│   └── template-resolver/  # Template resolution
└── docs/            # Architecture documentation
```

## Core Architectural Patterns

### Service Locator Pattern

Per-request dependency injection container attached to Express middleware:

```typescript
req.services.get<Logger>('logger');
req.services.get<Database>('database');
```

### Repository Pattern

Abstract data access for SQLite → DynamoDB migration path:

```typescript
class BaseRepository<T> {
  findById(id: string): T | undefined;
  create(entity: T): T;
  update(id: string, updates: Partial<T>): T;
}
```

### Structured Logging

Pino with correlation IDs and service context:

```typescript
logger.info({ requestId, userId }, 'Operation completed');
```

## Development Commands

```bash
pnpm dev        # Start frontend + backend
pnpm test       # Run all tests
pnpm build      # Build all packages
pnpm typecheck  # TypeScript checking
pnpm lint       # ESLint checking

# Package-specific CLI
pnpm --filter @ctrl-freaq/shared-data cli --help
```

## Constitutional Requirements

1. **Library-First**: Every feature as standalone library with CLI
2. **TDD Mandatory**: RED-GREEN-Refactor cycle enforced
3. **No Singletons**: Use Service Locator pattern
4. **Structured Logging**: JSON format with Pino
5. **Repository Pattern**: All database access abstracted

## Implementation Status

### Complete Features ✅

- **Monorepo Structure**: pnpm workspaces + Turborepo pipeline
- **Core Infrastructure**: Service Locator, Pino logging, Error handling
- **Library Packages**: 8 packages with CLI interfaces
- **Frontend Application**: React 18.3.x with Clerk auth, shadcn/ui components
- **Backend API**: Express.js 5.1.0 with full CRUD operations
- **Authentication**: Clerk integration with JWT middleware
- **Database**: SQLite with repository pattern and SOC 2 audit fields
- **Testing**: Contract tests, integration tests, and unit test setup
- **Security**: Cryptographic request IDs, input validation, audit logging

### Architecture Highlights

- **Request-scoped DI**: Service containers per Express request
- **Transaction Support**: Database operations with transaction wrapper
- **Browser Logging**: Client-side structured logging transmits to backend
- **API Integration**: Type-safe client with error handling and retry logic
- **SOC 2 Compliance**: Audit fields, structured logging, security requirements

### Available Commands

```bash
pnpm dev        # Start frontend (5173) + backend (5001)
pnpm test       # Run all tests
pnpm build      # Build all packages
pnpm typecheck  # TypeScript checking
pnpm lint       # ESLint checking

yamllint        # Validate YAML files

# Library CLIs
pnpm --filter @ctrl-freaq/shared-data cli --help
pnpm --filter @ctrl-freaq/templates cli --help
pnpm --filter @ctrl-freaq/ai cli --help
```

### Testing Strategy

- **Contract Tests**: API endpoint validation (health, projects)
- **Integration Tests**: Authentication flows, dashboard loading
- **Unit Tests**: Vitest with colocated \*.test.ts files
- **Repository Tests**: In-memory SQLite for data layer
- **Frontend Tests**: React Testing Library with jsdom

### Recent Implementation

- [2025-09-14] ✅ COMPLETE - Development Environment Bootstrap (62/62 tasks)
  - All original implementation tasks (T001-T051)
  - Critical security fixes (T052-T062) including:
    - Memory leak prevention in rate limiting
    - SOC 2 audit fields in database schema
    - Secure CORS origin validation
    - Prepared statement caching for performance
    - TypeScript import resolution fixes
- [2025-09-14] Frontend fully adapted with API integration and structured
  logging
- [2025-09-14] All constitutional requirements implemented and verified

---

@CONSTITUTION.md
