# CTRL FreaQ

> AI-optimized documentation system for high-quality software development

## Overview

CTRL FreaQ is a fun research experiment in AI-spec-driven development -
basically, we're testing whether AI can write comprehensive documentation and
then use that same documentation to build working software. It's an interactive
system that generates the core technical specs needed for software development.

This serves as a practical research case: can we create AI-optimized
Architecture documents that are detailed and structured enough to guide the
development of a working MVP with authentication, dashboard, and project
management features? The experiment aims to validate this approach while
building something useful.

## Problem We Solve

- **Documentation Gap**: Experienced developers often skip rigorous
  documentation, leading to inconsistent, low-quality LLM outputs
- **Inconsistent AI Output**: Ad-hoc prompting and "vibe coding" yield
  unpredictable results
- **Time Waste**: 3-6 hours/week per engineer lost to prompt crafting and
  re-contextualizing
- **PR Churn**: 20-40% of PRs require rework due to unclear architecture

## Target Users

**Senior/Staff+ Engineers and Tech Leads** who:

- Use AI-assisted development
- Want predictable, higher-quality LLM output
- Need to maintain architectural consistency
- Value low-friction workflows

## Key Features (MVP)

### Document Creation Flow

- Guided, human-in-the-loop flow for Architecture documents
- Schema validation and cross-references
- Decision logs and traceability

### Conversational Co-Authoring

- Section-aware chat during document creation
- Suggested drafts and edits
- Inline citations to fields

### Document Management

- QA chat for existing documents
- Update and version existing Architecture docs
- Diff preview and changelog tracking

### Quality & Export

- Validation checks and acceptance checklists
- Markdown export with frontmatter
- Version markers and changelog
- Exports to `docs/architecture.md` and sharded `docs/architecture/*.md`

## Success Metrics

- **Time to first Architecture draft**: ≤ 60 minutes
- **Revision cycles**: ≤ 2 iterations for approval
- **Prompt crafting time reduction**: ≥ 30%
- **PR churn reduction**: ≤ 10% rework due to architecture issues

## 🚀 Quick Start

```bash
# Prerequisites: Node.js 22.x and pnpm 9.x
nvm use                    # Use Node.js version from .nvmrc
npm install -g pnpm@9     # Install pnpm globally

# Install dependencies and start development
pnpm install              # Install all workspace dependencies
pnpm dev                  # Start frontend (5173) + backend (5001)
```

## 📁 Project Structure

```
ctrl-freaq/
├── apps/
│   ├── web/          # React frontend application
│   └── api/          # Express.js backend API
├── packages/         # Shared library packages
│   ├── shared-data/  # Repository pattern data access
│   ├── templates/    # YAML template engine
│   ├── ai/          # LLM integration (Vercel AI SDK)
│   ├── qa/          # Quality gates
│   ├── exporter/    # Document export
│   ├── editor-core/ # WYSIWYG editor
│   ├── editor-persistence/ # Client persistence
│   └── template-resolver/  # Template resolution
└── docs/            # Documentation and guides
```

## 🛠️ Development

### Available Commands

```bash
pnpm dev        # Start development servers
pnpm build      # Build all packages
pnpm test       # Run test suites
pnpm lint       # Run ESLint
pnpm typecheck  # Run TypeScript compiler
```

### Document Editor E2E fixtures

- Launch the web app in deterministic fixture mode with
  `pnpm --filter @ctrl-freaq/web dev:e2e`. Vite forces `VITE_E2E=true`, mounts
  the `/__fixtures` middleware, and points API clients at
  `http://localhost:5173/__fixtures/api`.
- Deep link to `/documents/demo-architecture/sections/sec-api` to verify the
  document editor renders fixtures for the table of contents, section preview,
  assumption transcripts, diff previews, and approval state.
- Navigating to a missing fixture (for example `sec-missing`) surfaces the
  `DocumentMissing` view with a dashboard link so Playwright can assert graceful
  failure handling.
- Run `pnpm --filter @ctrl-freaq/web test:e2e` to execute the Playwright suite
  with `playwright.fixture.config.ts`. Use
  `pnpm --filter @ctrl-freaq/web test:live` to scaffold live-service runs once
  backend orchestration is ready.

### Technical Stack

- **Frontend:** React 18.3.x, Vite 5.x, shadcn/ui, Tailwind CSS
- **Backend:** Express.js 5.1.0, SQLite (local development)
- **Language:** TypeScript 5.4.x, Node.js 22.x
- **Testing:** Vitest 1.x, React Testing Library
- **Monorepo:** pnpm workspaces + Turborepo
- **LLM Integration:** OpenAI via Vercel AI SDK
- **Auth:** Clerk (JWT-based authentication)

## 🏗️ CI/CD Pipeline

The project uses GitHub Actions for continuous integration with quality gates
for linting, type checking, building, and testing. All jobs are configured with
comprehensive caching for optimal performance.

## 📚 Documentation

- **[Project Brief](docs/brief.md)** - Product vision and requirements
- **[Architecture Guide](docs/README.md)** - System architecture and design
  patterns
- **[Development Constitution](CONSTITUTION.md)** - Core development principles

## 🔧 Local Development

### Prerequisites

- Node.js 22.x (managed via .nvmrc)
- pnpm 9.x package manager
- Git with GitHub CLI (optional, for CI management)

### Setup Process

1. **Clone and setup:**

   ```bash
   git clone https://github.com/yourusername/ctrl-freaq.git
   cd ctrl-freaq
   nvm use  # Switch to Node.js 22.x
   ```

2. **Install dependencies:**

   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   # Add your OpenAI API key and Clerk keys to .env
   ```

4. **Start development:**
   ```bash
   pnpm dev  # Frontend: http://localhost:5173, API: http://localhost:5001
   ```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test -- --watch

# Test specific package
pnpm --filter @ctrl-freaq/[package-name] test
```

## 🚦 Development Philosophy

This project enforces strict quality standards:

- **Test-Driven Development:** All features require failing tests before
  implementation
- **Library-First Architecture:** Each feature starts as a standalone library
  with CLI interface
- **Repository Pattern:** Abstract data access for future scalability
- **Structured Logging:** JSON format with correlation IDs
- **Constitutional Compliance:** All development follows
  [CONSTITUTION.md](CONSTITUTION.md)

## 📖 Contributing

1. **Follow the Constitution:** Read [CONSTITUTION.md](CONSTITUTION.md) for
   development principles
2. **Create Feature Branch:** `git checkout -b feature/your-feature-name`
3. **Write Tests First:** Implement failing tests before feature code
4. **Validate Locally:** Run
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
5. **Submit Pull Request:** Include description and link to related issues

### Code Quality

- All code must pass linting, type checking, and tests
- Follow existing code style and patterns
- Include comprehensive test coverage
- Document complex functionality

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for details.

## 🏢 Value Proposition

CTRL FreaQ accelerates high-quality AI-assisted development by:

- **Reducing Time Waste:** Save 3-6 hours/week per engineer on prompt crafting
- **Improving PR Quality:** Reduce rework from 20-40% to under 10%
- **Accelerating Delivery:** Go from kickoff to approved architecture in under
  60 minutes
- **Ensuring Consistency:** Produce predictable, high-quality LLM outputs every
  time

---

_Built with modern TypeScript, React, and Node.js_
