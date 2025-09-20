# Claude Code AI Assistant Context

## Project Overview

CTRL FreaQ - Document authoring and AI assistance platform for senior engineers
and tech leads.

## Current Feature: Document Editor Core Infrastructure (006-story-2-2)

### Technical Stack

**Language/Version**: TypeScript 5.4.x, Node.js 22.x, React 18.x **Primary
Dependencies**: React, Milkdown 7.15.5 (WYSIWYG editor), Zustand (state), React
Router v6, shadcn/ui **Storage**: Document sections in SQLite database via
shared-data package **Testing**: Vitest, React Testing Library, Playwright for
E2E **Project Type**: Web application (React frontend + Express.js backend)

### Architecture Context

- Monorepo with pnpm workspaces + Turborepo
- Library-first architecture per constitutional requirements
- Express.js API server with React frontend
- Modular monolith evolving to AWS serverless

### Current Implementation Focus

- Section-based document editing with hierarchical Table of Contents
- State management: idle → read_mode → edit_mode → saving
- WYSIWYG Markdown editor integration (Milkdown 7.15.5)
- Git-style patch management for tracking changes
- Visual state indicators and responsive navigation
- Performance goals: <300ms section navigation, 60fps animations, <100ms patch
  generation

### Recent Changes

- Created comprehensive data model for section views and pending changes
- Designed OpenAPI contracts for sections API endpoints
- Established test scenarios for ToC navigation and mode transitions
- Integrated diff-match-patch for Git-style change tracking

## Key Files and Patterns

### Frontend Architecture

- `apps/web/src/features/document-editor/` - Document editing components
- `packages/shared-data/` - Database access layer with Repository pattern
- State management via Zustand with Immer for immutable updates
- Component structure follows shadcn/ui + Tailwind CSS patterns

### API Patterns

- REST endpoints under `/api/v1/documents/{id}/sections`
- JWT authentication via Clerk
- Structured error responses with request correlation IDs
- OpenAPI contracts in `/specs/{feature}/contracts/`

### Testing Standards

- TDD mandatory: Tests before implementation
- Vitest for unit tests, Playwright for E2E
- Coverage thresholds: Lines 80%, Statements 80%, Branches 70%
- Component testing with React Testing Library

### Constitutional Principles

- Library-first: Every feature as standalone module
- Test-first development (TDD): Red-Green-Refactor cycle
- Repository pattern: Abstract data access for SQLite � DynamoDB migration
- Structured logging: Pino with correlation IDs
- No console.log in application code

## Development Commands

```bash
# Development
pnpm dev                 # Start all development servers
pnpm test               # Run all tests
pnpm typecheck          # TypeScript validation
pnpm lint               # ESLint with strict rules

# Feature-specific
pnpm --filter @ctrl-freaq/shared-data cli --help
pnpm test --run         # Run tests without watch
```

## Common Patterns

### Component Structure

```typescript
// Standard component pattern
export interface ComponentProps {
  className?: string;
  onAction?: (value: string) => void;
}

export const Component: FC<ComponentProps> = memo(({ className, onAction }) => {
  // Implementation with proper TypeScript, accessibility, and testing
});
```

### State Management

```typescript
// Zustand store with Immer
export const useFeatureStore = create<FeatureStore>()(
  devtools(
    immer((set, get) => ({
      // State and actions
    }))
  )
);
```

### API Integration

```typescript
// Service pattern with proper error handling
export class FeatureService {
  async operation(): Promise<Result> {
    return apiClient.post<Result>('/endpoint', data);
  }
}
```

Keep implementations aligned with these patterns and constitutional
requirements.
