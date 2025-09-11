# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a document management system that uses the BMAD-METHOD framework for agent-based development workflows. The project integrates with Context7 for documentation retrieval and focuses on managing agents, tasks, and documentation artifacts.

## Architecture

### Core Structure
- **`.bmad-core/`**: Contains the BMAD-METHOD framework components including agents, tasks, templates, and workflows
- **`AGENTS.md`**: Auto-generated agent definitions and commands (contains extensive agent persona definitions)
- **`.claude/`**: Claude Code configuration directory with commands and settings
- **`.mcp.json`**: MCP server configuration for Context7 integration

### Key Components
- **Agents**: Specialized AI personas (UX Expert, Developer, Product Manager, etc.) defined in `.bmad-core/agents/`
- **Tasks**: Executable workflows in `.bmad-core/tasks/`
- **Templates**: Document templates in `.bmad-core/templates/`
- **Core Config**: Project configuration in `.bmad-core/core-config.yaml`

## Development Commands

### BMAD-METHOD Commands
```bash
# List available agents
npx bmad-method list:agents

# Reinstall BMAD core and regenerate AGENTS.md  
npx bmad-method install -f -i codex

# Validate configuration
npx bmad-method validate
```

### Node.js Environment
- Node version: 22 (specified in `.nvmrc`)
- Use `nvm use` to switch to correct Node version

## Working with Agents

### Agent Activation
Reference agents naturally in conversation:
- "As dev, implement..."
- "Use UX Expert to..."
- "As po, create..."

### Available Agents
- **ux-expert** (Sally): UI/UX design, wireframes, prototypes
- **dev** (James): Full stack development, code implementation  
- **dev-junior** (Julee): Junior development tasks under guidance
- **pm**: Product management, PRDs, strategy
- **po**: Product ownership, backlog management
- **sm**: Scrum master, story creation, agile processes
- **qa**: Test architecture and quality assurance
- **architect**: System design and architecture
- **analyst**: Business analysis and research
- **bmad-orchestrator**: Workflow coordination
- **bmad-master**: Comprehensive expertise across domains

### Documentation Structure
Based on core-config.yaml, the project expects:
- PRD: `docs/prd.md` (sharded in `docs/prd/`)
- Architecture: `docs/architecture.md` (sharded in `docs/architecture/`)
- Stories: `docs/stories/`
- QA: `docs/qa/`

### Key Files Always Loaded by Dev Agent
- `docs/architecture/coding-standards.md`
- `docs/architecture/tech-stack.md`
- `docs/architecture/unified-project-structure.md`
- `docs/architecture/high-level-architecture.md`
- `docs/architecture/development-workflow.md`

## Important Rules

### Agent Behavior
- UX Expert (Sally) does NOT modify source code files - only updates specs and creates developer tickets
- Tasks with `elicit=true` require user interaction and cannot be bypassed
- Agent activation: greet user, run `*help`, then await commands
- Stay in character for each agent persona

### File Management
- Commit `.bmad-core/` and `AGENTS.md` to repo for full agent definitions
- Use `.ai/debug-log.md` for development debugging
- Markdown exploder enabled for document management

## Context7 Integration

The project uses Context7 MCP server for documentation retrieval. Requires `CONTEXT7_API_KEY` environment variable.