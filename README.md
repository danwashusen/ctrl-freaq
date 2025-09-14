# CTRL FreaQ

[![CI Pipeline](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg)](https://github.com/[OWNER]/ctrl-freaq/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-9.x-blue.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

> AI-optimized documentation system built as a monorepo with React frontend and Express.js backend.

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
│   ├── ai/          # LLM integration
│   └── ...          # Additional utility packages
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

### Technical Stack

- **Frontend:** React 18.3.x, Vite 5.x, shadcn/ui, Tailwind CSS
- **Backend:** Express.js 5.1.0, SQLite with better-sqlite3
- **Language:** TypeScript 5.4.x, Node.js 22.x
- **Testing:** Vitest 1.x, React Testing Library
- **Monorepo:** pnpm workspaces + Turborepo
- **Auth:** Clerk (JWT-based authentication)

## 🏗️ CI/CD Pipeline

The project uses GitHub Actions for continuous integration with the following quality gates:

- **Linting:** ESLint validation across all packages
- **Type Checking:** TypeScript compilation validation
- **Building:** Turborepo optimized builds
- **Testing:** Vitest test suites with coverage
- **Workspace Validation:** Dependency consistency checks

All jobs are configured with 5-minute timeouts and comprehensive caching for optimal performance.

### CI Status

| Job | Status | Description |
|-----|--------|-------------|
| Setup | [![Setup](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg?event=push)](https://github.com/[OWNER]/ctrl-freaq/actions) | Dependency installation and caching |
| Lint | [![Lint](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg?event=push)](https://github.com/[OWNER]/ctrl-freaq/actions) | ESLint code quality validation |
| TypeCheck | [![TypeCheck](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg?event=push)](https://github.com/[OWNER]/ctrl-freaq/actions) | TypeScript compilation validation |
| Build | [![Build](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg?event=push)](https://github.com/[OWNER]/ctrl-freaq/actions) | Package building with Turborepo |
| Test | [![Test](https://github.com/[OWNER]/ctrl-freaq/workflows/CI%20Pipeline/badge.svg?event=push)](https://github.com/[OWNER]/ctrl-freaq/actions) | Test suites execution |

## 📚 Documentation

- **[Architecture Guide](docs/README.md)** - System architecture and design patterns
- **[CI Troubleshooting](docs/ci-troubleshooting.md)** - Debug and fix CI pipeline issues
- **[Repository Setup](docs/ci-repository-setup.md)** - GitHub repository configuration
- **[Development Constitution](CONSTITUTION.md)** - Core development principles

## 🔧 Local Development

### Prerequisites

- Node.js 22.x (managed via .nvmrc)
- pnpm 9.x package manager
- Git with GitHub CLI (optional, for CI management)

### Setup Process

1. **Clone and setup:**
   ```bash
   git clone https://github.com/[OWNER]/ctrl-freaq.git
   cd ctrl-freaq
   nvm use  # Switch to Node.js 22.x
   ```

2. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Start development:**
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

## 🚦 Quality Gates

This project enforces strict quality standards:

- **Test-Driven Development:** All features require failing tests before implementation
- **Library-First Architecture:** Each feature starts as a standalone library
- **Constitutional Compliance:** All development follows [CONSTITUTION.md](CONSTITUTION.md)
- **SOC 2 Requirements:** Security, audit logging, and compliance built-in

## 📖 Contributing

1. **Follow the Constitution:** Read [CONSTITUTION.md](CONSTITUTION.md) for development principles
2. **Create Feature Branch:** `git checkout -b feature/your-feature-name`
3. **Write Tests First:** Implement failing tests before feature code
4. **Validate Locally:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
5. **Submit Pull Request:** Include description and link to related issues

### Code Quality

- All code must pass linting, type checking, and tests
- Follow existing code style and patterns
- Include comprehensive test coverage
- Document complex functionality

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🏢 Architecture

CTRL FreaQ follows a constitutional development approach with:

- **Service Locator Pattern** for dependency injection
- **Repository Pattern** for data access abstraction
- **Structured Logging** with Pino and correlation IDs
- **Request-scoped containers** for Express.js middleware
- **Library-first architecture** with CLI interfaces

---

*Built with ❤️ using modern TypeScript, React, and Node.js*

Why did the chicking cross the road? To see the other side...
