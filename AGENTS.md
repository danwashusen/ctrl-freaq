# Claude Code Context - CTRL FreaQ

## Project Overview

CTRL FreaQ is an AI-optimized documentation system built as a monorepo with
React frontend and Express.js backend. The project follows Constitutional
principles including library-first architecture, mandatory TDD, and CLI
interfaces for all libraries.

**Current Focus**: Document Editor Core Infrastructure (Story 2.2)

- Building hierarchical Table of Contents navigation
- Implementing read/edit mode transitions for sections
- Adding placeholder states for empty sections

## Project Structure

```
ctrl-freaq/
├── apps/
│   ├── web/          # React 18+ frontend with Vite
│   └── api/          # Express.js backend
├── packages/         # Library packages (all with CLI interfaces)
│   ├── shared-data/  # Repository pattern, document/template models
│   ├── templates/    # YAML template engine with Zod validation
│   ├── ai/          # LLM integration (Vercel AI SDK)
│   ├── qa/          # Quality gates
│   ├── exporter/    # Document export
│   ├── editor-core/ # TipTap-based WYSIWYG editor (placeholder impl)
│   ├── editor-persistence/ # IndexedDB/localStorage client persistence
│   └── template-resolver/  # Version-aware template caching
└── specs/           # Feature specifications and implementation plans
    └── 006-story-2-2/  # Current: Document editor infrastructure
```

## Development Commands

### Available Commands

```bash
pnpm dev        # Start frontend (5173) + backend (5001)
pnpm test       # Run all tests with Vitest
pnpm test:contracts  # Run API contract tests (TDD - should fail first)
pnpm build      # Build all packages
pnpm typecheck  # TypeScript checking
pnpm lint       # ESLint checking

yamllint        # Validate YAML files

# Library CLIs (all packages have CLI interfaces)
pnpm --filter @ctrl-freaq/shared-data cli --help
pnpm --filter @ctrl-freaq/templates cli --help
pnpm --filter @ctrl-freaq/ai cli --help
pnpm --filter @ctrl-freaq/editor-core cli --help
pnpm --filter @ctrl-freaq/editor-persistence cli --help
pnpm --filter @ctrl-freaq/template-resolver cli --help
```

## Tech Stack & Patterns

- **Frontend**: React 18+, TypeScript, Zustand (state), Radix UI + Tailwind
- **Backend**: Express.js, TypeScript, Zod validation
- **Editor**: TipTap/ProseMirror foundation
- **Storage**: IndexedDB (client), PostgreSQL (server)
- **Testing**: Vitest (unit), Playwright (E2E)
- **Patterns**: Repository pattern, compound components, optimistic UI

## Recent Changes

1. **Document Editor Core** (2025-09-20)
   - Designed section editing data models
   - Created OpenAPI contracts for section management
   - Defined section lock mechanism for concurrent editing
   - Added contract tests following TDD principles

2. **Template System** (Previous)
   - Hierarchical section structure from YAML templates
   - Version-aware caching with VersionedTemplateCache
   - Zod validation for template schemas

## Assumption Handling Strategy

When you believe an assumption may be required:

1. IDENTIFY
   - State the possible assumption as an **Open Question** (e.g., “[Open
     Question] What’s the meaning of life?”).

2. CHECK CONTEXT
   - If the question has a **clear answer** from the provided context,
     immediately mark it as resolved and continue:
     - Example: “[Resolved Question] What’s the meaning of life? Answer: 42”

3. HANDLE UNCERTAINTY
   - If the answer is **not clear**:
     - Research or propose 3–5 plausible options, ranked by best fit for the
       context.
     - Ask the user to either:
       - Choose a numbered option (1 option per line), or
       - Provide a refined answer in free text.

4. APPLY DEFAULTS
   - If the user does not respond and a safe default exists, proceed with that
     default.
   - Always state which default you are applying.

5. RECORD
   - Capture the resolved assumption in a **Decision Log**:
     - Example: “Q: What’s the meaning of life? → A: 42 (user-provided)”

6. CONTINUE
   - Resume executing the main instruction flow using the resolved assumption.

@CONSTITUTION.md
