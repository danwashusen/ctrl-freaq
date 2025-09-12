# Quickstart: Development Environment Bootstrap

## Prerequisites
- Node.js 20.x LTS installed
- pnpm 9.x installed (`npm install -g pnpm@9`)
- Git configured
- Clerk account for authentication keys

## Setup Steps

### 1. Clone and Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd ctrl-freaq

# Install dependencies
pnpm install

# Verify installation
pnpm run typecheck
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local and add:
# - CLERK_PUBLISHABLE_KEY=<your-key>
# - CLERK_SECRET_KEY=<your-key>
# - DATABASE_URL=./.data/dev.sqlite
```

### 3. Start Development Servers
```bash
# Start both frontend and backend
pnpm dev

# Or start individually:
pnpm dev:web   # Frontend on http://localhost:5173
pnpm dev:api   # Backend on http://localhost:5001
```

### 4. Verify Setup
```bash
# Check health endpoint
curl http://localhost:5001/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-09-13T...",
  "version": "1.0.0",
  "uptime": 10
}
```

### 5. Access Dashboard
1. Open http://localhost:5173 in browser
2. Sign in with Clerk
3. Verify Dashboard displays with "My Project"
4. Check authentication is working

## Running Tests

### All Tests
```bash
pnpm test
```

### Specific Package Tests
```bash
# Test a specific library
pnpm --filter @ctrl-freaq/shared-data test

# Test frontend
pnpm --filter @ctrl-freaq/web test

# Test backend
pnpm --filter @ctrl-freaq/api test
```

### Test Coverage
```bash
pnpm test:coverage
```

## Library CLI Commands

### shared-data
```bash
# Query documents
pnpm shared-data query --type document --output json

# Create document
pnpm shared-data create-doc --type architecture --title "Test"
```

### templates
```bash
# Validate template
pnpm templates validate --file templates/architecture.yaml

# List templates
pnpm templates list --output json
```

### ai
```bash
# Test streaming
pnpm ai stream-test --prompt "Hello" --verify-sse
```

### qa
```bash
# List quality gates
pnpm qa list-gates --type blocker --output human
```

### exporter
```bash
# Validate export
pnpm exporter validate-export --file docs/architecture.md
```

## Development Scripts

### Code Quality
```bash
pnpm lint        # Run ESLint
pnpm format      # Run Prettier
pnpm typecheck   # TypeScript type checking
```

### Build
```bash
pnpm build       # Build all packages
pnpm build:web   # Build frontend only
pnpm build:api   # Build backend only
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 5001 (backend)
lsof -ti:5001 | xargs kill -9
```

### Dependencies Issues
```bash
# Clear all node_modules and reinstall
pnpm clean
pnpm install --force
```

### Database Issues
```bash
# Reset database
rm -rf .data/dev.sqlite
pnpm db:migrate
```

### Type Errors
```bash
# Regenerate TypeScript declarations
pnpm build:types
```

## Validation Checklist

- [ ] `pnpm dev` starts without errors
- [ ] Frontend loads at http://localhost:5173
- [ ] Backend health check returns 200
- [ ] Authentication with Clerk works
- [ ] Dashboard displays "My Project"
- [ ] All library CLI commands show help
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

## Next Steps

1. Review [Constitutional Requirements](../../CONSTITUTION.md)
2. Read [Architecture Documentation](../../docs/architecture.md)
3. Explore library CLIs with `--help` flag
4. Start implementing features following TDD

## Support

- Check logs in `.logs/` directory
- Review error messages for request IDs
- Ensure all environment variables are set
- Verify Node.js and pnpm versions match requirements