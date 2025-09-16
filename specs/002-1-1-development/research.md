# Research: Development Environment Bootstrap

## Executive Summary

This document consolidates research findings for implementing the Development
Environment Bootstrap feature, focusing on core architectural patterns, tool
selection, and integration strategies for the CTRL FreaQ MVP.

## Research Findings

### 1. Service Locator Pattern Implementation

**Decision**: Request-scoped container pattern using Express.js middleware

**Rationale**:

- Provides dependency injection without global singletons
- Enables per-request configuration and context
- Maintains testability with mock service locators
- Aligns with Constitutional no-singleton requirement

**Implementation Approach**:

```typescript
// Per-request service container attached to req.services
interface ServiceLocator {
  get<T>(token: ServiceToken<T>): T;
  register<T>(token: ServiceToken<T>, factory: () => T): void;
}
```

**Alternatives Considered**:

- InversifyJS: Too heavy, requires decorators
- TSyringe: Global container violates no-singleton rule
- Manual DI: Lacks type safety and becomes unwieldy

### 2. Pino Logging Configuration

**Decision**: Pino 9.5.0 with structured JSON logging

**Rationale**:

- Fastest Node.js logger (10x faster than Winston)
- Native JSON output for structured logging
- Browser bundle available for frontend
- Supports child loggers for component context

**Configuration Strategy**:

```typescript
// Backend configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: label => ({ level: label }),
    bindings: () => ({
      pid: process.pid,
      hostname: os.hostname(),
      service: 'ctrl-freaq-api',
      version: process.env.npm_package_version,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['req.headers.authorization', '*.password', '*.apiKey'],
});

// Frontend configuration with backend transmission
const browserLogger = pino({
  browser: {
    transmit: {
      level: 'error',
      send: (level, logEvent) => {
        fetch('/api/v1/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEvent),
        });
      },
    },
  },
});
```

**Alternatives Considered**:

- Winston: Slower, more complex configuration
- Bunyan: Discontinued, lacks browser support
- Debug: Too simple, no structured logging

### 3. Repository Pattern with SQLite

**Decision**: Abstract base repository with better-sqlite3

**Rationale**:

- Synchronous API simplifies code (no async/await needed)
- 5x faster than node-sqlite3
- Type-safe with TypeScript
- Easy migration path to DynamoDB

**Base Repository Pattern**:

```typescript
abstract class BaseRepository<T> {
  constructor(
    protected db: Database,
    protected tableName: string
  ) {}

  findById(id: string): T | undefined {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE id = ?`
    );
    return stmt.get(id) as T;
  }

  create(entity: Omit<T, 'id'>): T {
    // Implementation with auto-generated UUID
  }

  update(id: string, updates: Partial<T>): T {
    // Implementation with optimistic locking
  }
}
```

**Migration Strategy to DynamoDB**:

- Repository interface remains unchanged
- Implementation swapped at service locator level
- No JOIN operations in repository methods
- Cursor-based pagination ready

**Alternatives Considered**:

- TypeORM: Too heavy for MVP, complex migrations
- Prisma: Requires build step, adds complexity
- Raw SQL: No abstraction for future migration

### 4. Monorepo Architecture

**Decision**: pnpm workspaces + Turborepo

**Rationale**:

- pnpm: 3x faster installations, strict dependency isolation
- Turborepo: Intelligent build caching, parallel execution
- Native TypeScript project references support
- Simple configuration compared to alternatives

**Workspace Configuration**:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Turborepo Pipeline**:

```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "typecheck": {},
    "dev": { "cache": false }
  }
}
```

**Alternatives Considered**:

- Nx: More complex, requires learning curve
- Lerna: Maintenance mode, less performant
- Rush: Enterprise-focused, overkill for MVP
- Yarn workspaces: Slower than pnpm, less strict

### 5. Adapting Lovable.ai Prototype

**Decision**: Move and enhance existing code to apps/web

**Rationale**:

- Preserves working authentication (Clerk)
- Maintains existing routing structure
- Reuses component library setup (shadcn/ui)
- Faster than rewriting from scratch

**Enhancement Strategy**:

1. Move files preserving structure
2. Update package.json for monorepo
3. Add missing architectural components:
   - Pino browser logging
   - Path aliases (@/features, @/stores)
   - Streaming utilities for SSE
   - Service locator integration
4. Refactor to feature-based structure gradually

**Alternatives Considered**:

- Complete rewrite: Wastes existing work
- Keep as-is: Doesn't meet architectural requirements
- Fork and modify: Creates maintenance burden

### 6. CLI Interface Design

**Decision**: Commander.js with structured commands

**Rationale**:

- Most popular Node.js CLI framework
- Automatic help generation
- Subcommand support
- TypeScript types available

**CLI Structure per Package**:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
  .name('shared-data')
  .description('Data access layer CLI')
  .version('0.1.0');

program
  .command('query')
  .option('--type <type>', 'Entity type')
  .option('--id <id>', 'Entity ID')
  .option('--format <format>', 'Output format', 'json')
  .action(async options => {
    // Implementation
  });

program.parse();
```

**Alternatives Considered**:

- Yargs: More complex API
- Oclif: Overkill for simple CLIs
- Manual parsing: Error-prone, no help generation

### 7. Test Infrastructure

**Decision**: Vitest with React Testing Library

**Rationale**:

- Vite-native, shares config with frontend
- Jest-compatible API for easy migration
- Fast execution with parallel tests
- Built-in TypeScript support

**Test Organization**:

```
tests/
├── contract/       # API contract tests
├── integration/    # Cross-component tests
├── unit/          # Isolated unit tests
└── fixtures/      # Test data
```

**Testing Utilities**:

```typescript
// Test database helper
export function createTestDb(): Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

// Mock service locator
export function createMockServices(): ServiceLocator {
  return new MockServiceLocator({
    logger: createTestLogger(),
    db: createTestDb(),
  });
}
```

**Alternatives Considered**:

- Jest: Slower, requires separate config
- Mocha/Chai: More setup required
- Playwright: E2E only, not for unit tests

### 8. Error Handling Strategy

**Decision**: Typed error classes with error codes

**Rationale**:

- Type-safe error handling
- Consistent error responses
- Easy to test error cases
- Machine-readable error codes

**Error Hierarchy**:

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super('VALIDATION_ERROR', message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} ${id} not found`, 404);
  }
}
```

**Alternatives Considered**:

- Error codes only: Less developer-friendly
- Throwing strings: No type safety
- HTTP status only: Insufficient detail

## Implementation Priorities

1. **Core Infrastructure First**
   - Service locator implementation
   - Pino logger configuration
   - Error handling middleware
   - Request ID propagation

2. **Monorepo Setup**
   - pnpm workspace configuration
   - Turborepo pipeline setup
   - Shared TypeScript config
   - Build scripts

3. **Library Foundations**
   - Base repository class
   - CLI template/utilities
   - Test helpers
   - Package structure

4. **Application Setup**
   - Frontend migration
   - Backend scaffolding
   - API route structure
   - Development scripts

## Risk Mitigation

| Risk                          | Mitigation Strategy                  |
| ----------------------------- | ------------------------------------ |
| Complex service locator       | Start simple, enhance incrementally  |
| Frontend breaking during move | Test each step, preserve git history |
| Library CLI overhead          | Share CLI utilities package          |
| Test setup complexity         | Create test utilities package        |
| Logging performance           | Use async transport in production    |

## Success Criteria

- `pnpm dev` starts both frontend and backend
- All package CLIs respond to --help
- Structured logs appear in console
- Service locator provides typed dependencies
- Repository pattern abstracts database access
- Tests run successfully with `pnpm test`
- Frontend preserves existing functionality

## Next Steps

1. Create monorepo structure
2. Implement core infrastructure
3. Set up library packages
4. Migrate frontend code
5. Create backend scaffolding
6. Add test infrastructure
7. Create development scripts
8. Write documentation

---

_Research completed: 2025-09-13_
