# Intelligently implement tasks from a tasks.md file with analysis, validation, and progress tracking.

Given the tasks document path as an argument (e.g.,
"specs/002-feature/tasks.md"), perform:

- Pre-implementation analysis to understand current state
- Smart task selection respecting dependencies and priorities
- Implementation with validation and quality gates
- Progress tracking with checkbox updates
- Post-implementation testing and verification

Inputs

- Required: path to `tasks.md`
- Optional:
  - Task range or specific tasks (e.g., "T001-T010" or "T001,T005,T009")
  - Phase filter (e.g., "Phase 3.2" or "Tests")
  - Category filter for review tasks (e.g., "[Security]" or "[Critical]")
  - Skip completed flag (--skip-completed, default: true)
  - Dry run mode (--dry-run, show what would be done)

Early Gates (stop if any fail)

1. Network Access Gate
   - Check CLI context (`network_access`), sandbox policy, or recent command
     failures that indicate restricted network access.
   - If network access is restricted, STOP and warn: "Network access is
     restricted. This playbook requires full network access for installs,
     audits, and tests. Please re-run with full access granted."
   - Do not continue until full network access is available; otherwise
     implementation validation will silently miss critical signals.

2. Tasks Document Gate
   - Verify tasks.md exists and is valid
   - Parse all tasks and their dependencies
   - If invalid format, output Status: "Invalid Tasks Document". STOP.

3. Research Briefs Gate
   - Load `<feature>/research.md` referenced by the tasks document.
   - Confirm a `## Implementation Briefs` section exists with a
     `<!-- story-tasks:auto -->` block.
   - Ensure every phase or remediation group in `tasks.md` has a matching
     `### Phase 3.x – …` subsection and that task ranges align.
   - If the block is missing, stale, or mismatched, STOP with Status:
     "Implementation Briefs Missing" and request a refreshed Story Tasks run.

4. Completion Audit Gate
   - Run intent-based analysis on all tasks (per validate-tasks.md logic)
   - Identify: ✅ Complete, 🟡 Partial, 🔶 Stub, ❌ Not Started
   - Build implementation queue of incomplete tasks
   - Regardless of queue contents, execute workspace quality bundle:
     `pnpm -w lint`, `pnpm -w typecheck`, `pnpm -w test`, `pnpm -w build`. If
     any command fails, reopen or append remediation tasks (e.g., lint/type
     regressions) before proceeding and report `Quality Gates Failing`.
   - Only declare Status: "All Tasks Complete" when the task list is fully
     checked _and_ the quality bundle succeeds in the current session.

5. Dependency Analysis Gate
   - Map task dependencies from document structure and explicit notes
   - Verify prerequisites are met for each task
   - Order tasks respecting: Setup → Tests → Implementation → Integration →
     Polish
   - If circular dependencies found, output Status: "Circular Dependencies".
     STOP.

6. TDD Compliance Gate
   - For implementation tasks, verify corresponding tests exist and fail
   - For test tasks, ensure they will run before implementation
   - If TDD violated, output Status: "TDD Violation - Tests Must Fail First".
     STOP.

Pre-Implementation Analysis (for each task) Before starting any task, perform
comprehensive analysis:

1. Current State Assessment:
   - What already exists for this task?
   - Is there partial implementation to build upon?
   - Are there related files that provide patterns to follow?
   - Check git history for previous attempts

2. Context Gathering:
   - Start with the Implementation Brief for this task's phase (`research.md` →
     `## Implementation Briefs`) and preload every anchor it references.
   - Load related design documents (plan.md, research.md, data-model.md)
   - Identify patterns from similar completed tasks
   - Check for code review feedback (T0XX tasks) affecting this task
   - Review constitutional requirements applicable to this task

3. Implementation Planning:
   - Determine exact files to create/modify
   - Identify required imports and dependencies
   - Plan test scenarios if implementing features
   - Note integration points with existing code

Task Implementation Strategies

By Task Type:

Setup Tasks (package.json, configs):

- Check for existing config files to extend
- Use established patterns from project
- Validate against TypeScript/ESLint after creation
- Ensure all dependencies are properly versioned

Test Tasks (_.test.ts, _.test.tsx):

- MUST be written to fail initially (TDD)
- Include comprehensive test cases:
  - Happy path scenarios
  - Error conditions
  - Edge cases
  - Security validations if applicable
- Use existing test setup/utilities
- Ensure proper async handling
- Add meaningful assertions, not just existence checks

Implementation Tasks (features, services):

- Follow established patterns in codebase
- Include proper error handling
- Add structured logging with context
- Implement security checks (auth, validation)
- Use dependency injection via service locator
- Include TypeScript types/interfaces
- Add JSDoc comments for public APIs
- Refer to the
  [Quality Gate Command Crib Sheet](#quality-gate-command-crib-sheet) before
  each checkpoint so you can run the scoped quality gates you need without
  flooding the transcript.
- Verify quality gates (typecheck, lint, targeted tests) before checking off the
  task.

Prefer `pnpm lint:fix` or `pnpm --filter <package> lint -- --fix` before manual
edits; fall back to `pnpm lint:fix:check` for a dry-run list. Filter command
output to the actionable lines when pasting into prompts, e.g.
`pnpm lint:repo -- --format compact | rg -i 'error|warning'` and
`pnpm typecheck -- --pretty false | rg -i 'error'`. When the scope is known,
keep runs tight with Turbo filters such as
`pnpm exec turbo run lint --filter=@ctrl-freaq/web` or
`pnpm exec turbo run typecheck --filter=packages/<name>`.

<a id="quality-gate-command-crib-sheet"></a>Quality Gate Command Crib Sheet

- `pnpm typecheck -- --pretty false | rg -i 'error'` — concise global typecheck
  output
- `pnpm exec turbo run typecheck --filter=packages/<name>` — typecheck a
  specific package
- `pnpm lint:repo -- --format compact | rg -i 'error|warning'` — lint output
  trimmed to issues
- `pnpm exec turbo run lint --filter=@ctrl-freaq/web` — lint only the web app
- `pnpm --filter <package> test -- --runInBand` — isolate tests to the impacted
  package
- `pnpm lint:fix` / `pnpm --filter <package> lint -- --fix` — bulk apply lint
  fixes
- `pnpm lint:fix:check` — dry-run lint fixes to capture only what needs
  attention

Fix/Review Tasks ([Category] fixes):

- First understand the specific issue
- Locate exact code needing change
- Apply minimal fix that resolves issue
- Verify fix doesn't break existing functionality
- Add/update tests to prevent regression
- Update related documentation

Integration Tasks (middleware, routes):

- Ensure proper connection between layers
- Add request/response validation
- Include correlation ID propagation
- Implement proper error boundaries
- Add integration tests

Configuration Tasks:

- Use environment variables for secrets
- Provide sensible defaults
- Add validation for required settings
- Document all configuration options

Quality Gates (apply to each implementation)

1. Code Quality:
   - Passes TypeScript compilation
   - No ESLint errors
   - Follows project conventions
   - No console.log statements (use logger)
   - No commented-out code
   - No TODO/FIXME without ticket reference

2. Security:
   - Input validation on all user data
   - No hardcoded secrets
   - Proper authentication checks
   - SQL injection prevention (parameterized queries)
   - XSS prevention (output encoding)

3. Testing:
   - Unit tests for new functions
   - Integration tests for endpoints
   - Tests actually test functionality, not just run
   - Error cases are tested
   - Minimum 80% code coverage for new code

4. Constitutional Compliance:
   - Library-first: Features as libraries with CLI
   - TDD: Tests written and failing first
   - Service Locator: No singletons
   - Structured Logging: JSON format with context
   - Repository Pattern: Database access abstracted
   - SOC 2: Audit fields, logging, error handling

Implementation Workflow

For each task in the implementation queue:

1. Pre-Implementation:

   ```
   📋 Task: T001 - Create monorepo structure
   🔍 Analyzing current state...
   ✓ Found partial implementation: package.json exists
   ⚠️ Missing: pnpm-workspace.yaml, turbo.json
   📚 Loading patterns from completed tasks...
   🎯 Implementation plan ready
   ```

2. Implementation:

   ```
   🚀 Implementing T001...
   ✓ Created pnpm-workspace.yaml
   ✓ Updated package.json with workspace config
   ✓ Added required dependencies
   🧪 Running validation...
   ```

3. Validation:

   ```
   ✓ TypeScript: No errors
   ✓ ESLint: Passed
   ✓ Tests: N/A (config file)
   ✓ Integration: pnpm install successful
   ```

   - Immediately follow with the quality check loop: `pnpm typecheck`,
     `pnpm lint`, task-scoped tests, and any required build step. Capture
     command output in the implementation log. If any command fails, halt task
     completion, diagnose, and keep the checkbox unchecked while documenting
     remediation steps.

4. Progress Update:
   ```
   ✅ T001 Complete - Updating tasks.md
   📊 Progress: 1/50 tasks complete (2%)
   ```

Progress Tracking

- Update task checkboxes in real-time:
  - Change `- [ ] T001` to `- [x] T001` when complete
  - Add completion timestamp comment: `<!-- completed: 2024-01-15 14:30 -->`
  - If any lint/typecheck/test/build command fails after marking complete,
    immediately revert the checkbox to `- [ ]` (or create a remediation task)
    and note the failure in the implementation log.

- Maintain implementation log:

  ```
  ## Implementation Log - <YYYY-MM-DD HH:MM>

  ### Session Summary
  - Tasks Attempted: 10
  - Tasks Completed: 8
  - Tasks Failed: 2 (T045, T046 - missing dependencies)
  - Time Elapsed: 45 minutes

  ### Completed Tasks
  ✅ T001: Monorepo structure (5 min)
  ✅ T002: Root package.json (3 min)
  [...]

  ### Failed Tasks
  ❌ T045: Missing Clerk SDK configuration
  ❌ T046: Database connection not available

  ### Next Steps
  - Configure Clerk authentication
  - Set up database connection
  - Retry failed tasks
  ```

Error Handling

When implementation fails:

1. Log detailed error with context
2. Attempt automatic recovery if possible
3. Mark task as 🟡 Partial if some progress made
4. Document blockers in implementation log
5. Continue with non-dependent tasks
6. Provide clear remediation steps

Post-Implementation Actions

After completing all possible tasks:

1. Run Test Suite:

   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

2. Generate Summary Report:

   ```
   ## Implementation Summary

   ### Statistics
   - Total Tasks: 50
   - Completed: 35 (70%)
   - Partial: 5 (10%)
   - Blocked: 3 (6%)
   - Not Started: 7 (14%)

   ### Quality Metrics
   - Test Coverage: 85%
   - TypeScript Errors: 0
   - ESLint Warnings: 3
   - Build Status: ✅ Passing

   ### Blockers
   - Missing external dependencies
   - Unclear requirements for T047
   - Database setup required for T040-T043
   ```

3. Update Documentation:
   - Update CLAUDE.md with new patterns
   - Add implementation notes to relevant tasks
   - Document any workarounds or decisions made

Output Format

- Summary: Implementation Complete | Partial Implementation | Blocked by
  Dependencies | Implementation Failed
- Progress: XX/XX tasks implemented (XX%)
  - ✅ Completed: [count]
  - 🟡 Partial: [count]
  - 🔶 Stub: [count]
  - ❌ Failed: [count]
- Quality Gates: TypeScript ✓ | ESLint ✓ | Tests ✓ | Coverage XX% (always report
  results from the latest quality bundle, even if no tasks were executed during
  the session; rerun commands to refresh the status)
- Session Metrics:
  - Time: XX minutes
  - Files Created: XX
  - Files Modified: XX
  - Lines Added: XXXX
- Blockers: [list any blocking issues]
- Next Steps: [recommended actions]

Important Notes

- Always run in project root unless otherwise specified
- Respect .gitignore patterns when creating files
- Use atomic commits with descriptive messages
- If uncertain about implementation, mark as 🟡 Partial and document uncertainty
- Never skip tests unless explicitly directed
- Keep security and performance in mind for all implementations
