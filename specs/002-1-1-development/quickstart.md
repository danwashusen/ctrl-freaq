# Quickstart Guide: Development Environment Bootstrap

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** 20.x LTS (verify with `node --version`)
- **pnpm** 9.x or later (install with `npm install -g pnpm`)
- **Git** (verify with `git --version`)
- **SQLite3** (usually pre-installed on macOS/Linux)
- **A code editor** (VS Code recommended)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ctrl-freaq
git checkout 002-1-1-development
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies for the monorepo
pnpm install

# This will:
# - Install root dependencies
# - Install dependencies for all packages
# - Set up workspace links
# - Run postinstall scripts
```

### 3. Environment Configuration

Create environment files for local development:

```bash
# Frontend environment
cat > apps/web/.env.development << 'EOF'
VITE_API_URL=http://localhost:5001
VITE_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
EOF

# Backend environment
cat > apps/api/.env.development << 'EOF'
NODE_ENV=development
PORT=5001
LOG_LEVEL=debug
DATABASE_URL=./dev.sqlite
CLERK_SECRET_KEY=<your-clerk-secret-key>
CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CORS_ORIGIN=http://localhost:5173
EOF

# Root environment for scripts
cat > .env << 'EOF'
NODE_ENV=development
EOF
```

**Note**: Replace `<your-clerk-*-key>` with actual Clerk development keys from https://clerk.com

### 4. Database Setup

Initialize the SQLite database:

```bash
# Run database migrations
pnpm --filter @ctrl-freaq/shared-data migrate

# Verify database creation
ls -la apps/api/dev.sqlite
```

### 5. Start Development Environment

```bash
# Start both frontend and backend in development mode
pnpm dev

# Or start individually:
pnpm dev:web    # Frontend only (port 5173)
pnpm dev:api    # Backend only (port 5001)
```

## Verification Steps

### 1. Backend Health Check

```bash
# Check API server health
curl http://localhost:5001/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-09-13T10:00:00.000Z",
  "version": "0.1.0",
  "service": "ctrl-freaq-api",
  "uptime": 10,
  "environment": "development",
  "database": {
    "status": "connected",
    "type": "sqlite"
  }
}
```

### 2. Frontend Access

1. Open browser to http://localhost:5173
2. You should see the Dashboard with Clerk authentication
3. Sign in with Clerk (development mode allows test accounts)
4. Verify the dashboard loads with "My Project" visible

### 3. Library CLI Verification

Test each library's CLI interface:

```bash
# Test shared-data CLI
pnpm --filter @ctrl-freaq/shared-data cli --help

# Test templates CLI
pnpm --filter @ctrl-freaq/templates cli --help

# Test ai CLI
pnpm --filter @ctrl-freaq/ai cli --help

# Each should display help information
```

### 4. Test Suite Execution

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @ctrl-freaq/shared-data test

# Run tests with coverage
pnpm test:coverage

# All placeholder tests should pass
```

### 5. Build Verification

```bash
# Build all packages
pnpm build

# Verify build outputs
ls -la apps/web/dist
ls -la apps/api/dist
ls -la packages/*/dist
```

### 6. Logging Verification

```bash
# Check structured logging in backend
pnpm dev:api

# In another terminal, make a request:
curl http://localhost:5001/api/v1/projects

# Check console for structured JSON logs with:
# - timestamp
# - level
# - service context
# - request ID
```

### 7. Type Checking

```bash
# Run TypeScript type checking
pnpm typecheck

# Should complete without errors
```

### 8. Linting

```bash
# Run ESLint
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

## Common Issues & Solutions

### Issue: Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::5001`

**Solution**:
```bash
# Find and kill process using the port
lsof -i :5001
kill -9 <PID>

# Or use different ports:
PORT=5002 pnpm dev:api
```

### Issue: Clerk Authentication Not Working

**Error**: `Clerk: Missing publishable key`

**Solution**:
1. Ensure `.env.development` files have correct Clerk keys
2. Sign up for free Clerk account at https://clerk.com
3. Create a development application
4. Copy keys from Clerk dashboard

### Issue: Database Connection Failed

**Error**: `Database connection failed`

**Solution**:
```bash
# Ensure SQLite is installed
sqlite3 --version

# Remove corrupted database and recreate
rm apps/api/dev.sqlite
pnpm --filter @ctrl-freaq/shared-data migrate
```

### Issue: Module Not Found Errors

**Error**: `Cannot find module '@ctrl-freaq/...'`

**Solution**:
```bash
# Rebuild workspace links
pnpm install

# Clear node_modules and reinstall
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install
```

### Issue: TypeScript Errors

**Error**: Various TypeScript compilation errors

**Solution**:
```bash
# Ensure TypeScript version is correct
pnpm list typescript

# Rebuild TypeScript project references
pnpm build:tsconfig
```

## Development Workflow

### 1. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes to relevant packages
# Frontend: apps/web/src/
# Backend: apps/api/src/
# Libraries: packages/*/src/
```

### 2. Testing Changes

```bash
# Write tests first (TDD)
# Test files: *.test.ts or *.spec.ts

# Run tests in watch mode
pnpm test:watch

# Run specific package tests
pnpm --filter <package-name> test
```

### 3. Committing Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue"
git commit -m "docs: update documentation"
```

### 4. Building for Production

```bash
# Build all packages
pnpm build

# Test production build locally
pnpm preview
```

## Project Structure Overview

```
ctrl-freaq/
├── apps/
│   ├── web/                 # React frontend
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── api/                 # Express.js backend
│       ├── src/
│       ├── tests/
│       └── package.json
├── packages/
│   ├── shared-data/         # Data access layer
│   ├── templates/           # Template engine
│   ├── ai/                  # AI integration
│   ├── qa/                  # Quality gates
│   ├── exporter/            # Export functionality
│   ├── editor-core/         # Editor components
│   ├── editor-persistence/  # Client persistence
│   └── template-resolver/   # Template resolution
├── docs/                    # Documentation
├── specs/                   # Specifications
├── pnpm-workspace.yaml      # Workspace config
├── turbo.json              # Turborepo config
└── package.json            # Root package.json
```

## Next Steps

After successful setup:

1. **Explore the codebase**: Familiarize yourself with the project structure
2. **Run the test suite**: Ensure all tests pass
3. **Check the documentation**: Read architecture.md and ui-architecture.md
4. **Start developing**: Pick a task from tasks.md (when generated)
5. **Follow TDD**: Write tests first, then implementation

## Support

For issues or questions:
- Check the existing documentation in `/docs`
- Review the architecture documents
- Consult the Constitutional requirements
- Check GitHub issues for known problems

---
*Quickstart guide version: 0.1.0 | Last updated: 2025-09-13*