# Research Findings: Document Editor Core Infrastructure

**Date**: 2025-09-20 **Feature**: Document Editor Core Infrastructure
(006-story-2-2)

## Technical Context Clarifications

### Coding Standards Resolution

**Decision**: ESLint v9 with strict TypeScript rules, Prettier formatting, Husky
pre-commit hooks

**Rationale**:

- Project already has established linting configuration in eslint.config.js
- TypeScript compiler strictness enabled in tsconfig.base.json
- Pre-commit automation via Husky ensures consistent code quality
- Constitution protects quality control configurations

**Alternatives considered**:

- Biome (newer, faster): Not mature enough for production use
- StandardJS: Less configurable, doesn't fit project needs
- TSLint: Deprecated in favor of ESLint

## Technology Research

### Milkdown Editor Integration

**Decision**: Use Milkdown v7.15.5 as specified in architecture

**Rationale**:

- WYSIWYG Markdown editing with ProseMirror foundation
- Supports Git-style patch generation via onChange API
- Plugin architecture for section-specific behaviors
- TypeScript native with excellent type definitions
- Already chosen by architecture team

**Best practices identified**:

- Instance pooling for memory management across sections
- Lazy loading of plugins to reduce initial bundle size
- Custom theme integration with shadcn/ui design tokens
- Debounced change tracking for performance

### State Management Architecture

**Decision**: Zustand with Immer for document state, TanStack Query for server
state

**Rationale**:

- Zustand already established in codebase patterns
- Immer provides immutability with natural mutation syntax
- TanStack Query handles caching, synchronization, background updates
- Minimal boilerplate compared to Redux

**Best practices identified**:

- Separate stores per feature (document-store, editor-store)
- Use devtools middleware for debugging
- Persist pending changes to localStorage via persist middleware
- Implement optimistic updates with rollback

### Section Navigation Performance

**Decision**: Virtual scrolling with Intersection Observer for ToC sync

**Rationale**:

- Full document rendering requirement rules out lazy loading
- Intersection Observer provides native performance
- Virtual scrolling for ToC when sections exceed viewport
- CSS containment for section isolation

**Implementation approach**:

- Use react-intersection-observer for React integration
- Throttle scroll events to 16ms (60fps target)
- Preload adjacent sections in background
- Use CSS content-visibility for off-screen sections

### Patch Management Strategy

**Decision**: diff-match-patch library with custom wrapper

**Rationale**:

- Google's diff-match-patch is battle-tested
- Generates unified diffs compatible with Git
- Supports three-way merge for conflict resolution
- Small bundle size (30KB minified)

**Alternatives considered**:

- jsdiff: Less efficient for large documents
- fast-diff: Missing patch application features
- Custom implementation: Unnecessary complexity

### Local Persistence Layer

**Decision**: localforage for IndexedDB abstraction

**Rationale**:

- Fallback chain: IndexedDB → WebSQL → localStorage
- Promise-based API fits async patterns
- Supports binary data for compressed patches
- Already used in editor-persistence package

**Storage schema**:

```javascript
{
  documentId: string,
  sectionId: string,
  patches: PatchDiff[],
  timestamp: number,
  version: number
}
```

## Additional Research

### Architecture Pattern Alignment

Analysis of the existing architecture documents reveals key patterns that must
be maintained:

**Repository Pattern Implementation**:

- All data access through repository interfaces in shared-data package
- No direct database queries in UI components or API routes
- Repositories return typed entities with Zod validation

**Service Locator Pattern**:

- Services resolved from req.services in Express routes
- No singleton patterns per Constitutional requirements
- Per-request service instances for isolation

**Library Boundaries**:

- Each package in packages/ directory is self-contained
- CLI interfaces mandatory for non-UI packages
- Clear public API exports in index.ts files

### UI Component Architecture

Review of existing UI patterns in the codebase:

**Component Structure**:

- Functional components with TypeScript interfaces
- memo() wrapping for performance optimization
- Custom hooks for logic extraction
- shadcn/ui as base component library

**State Patterns**:

- Server state: TanStack Query with 5-minute cache
- Client state: Zustand stores with devtools
- Form state: React Hook Form with Zod validation
- URL state: React Router params and search params

**Testing Patterns**:

- Component tests with React Testing Library
- User event simulation over fireEvent
- MSW for API mocking in tests
- Playwright for critical user flows

### Performance Optimization Strategies

Based on front-end specification requirements:

**Animation Performance**:

- Use CSS transforms for 60fps animations
- Implement will-change hints sparingly
- Respect prefers-reduced-motion media query
- Use Framer Motion for complex interactions

**Bundle Optimization**:

- Route-based code splitting with lazy()
- Dynamic imports for heavy libraries
- Tree shaking via Vite build optimization
- Separate vendor chunks for caching

**Rendering Optimization**:

- React.memo for expensive components
- useMemo/useCallback for referential stability
- Virtual scrolling for long lists (ToC)
- Suspense boundaries for async components

## Resolved Unknowns

All NEEDS CLARIFICATION items have been resolved:

- ✅ Coding Standards: ESLint v9 + Prettier + Husky configuration confirmed

## Phase 0 Completion Status

- [x] Technical context unknowns resolved
- [x] Dependency best practices researched
- [x] Integration patterns identified
- [x] Architecture alignment confirmed
- [x] Performance strategies defined
- [x] Testing approach validated

Ready to proceed to Phase 1: Design & Contracts
