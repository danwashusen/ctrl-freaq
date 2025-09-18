# Claude Code Context - CTRL FreaQ

## Project Overview

CTRL FreaQ is an AI-optimized documentation system built as a monorepo with
React frontend and Express.js backend. The project follows Constitutional
principles including library-first architecture, mandatory TDD, and CLI
interfaces for all libraries.

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

## Development Commands

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
