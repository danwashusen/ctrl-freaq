Plan how to implement the specified feature.

Given the implementation details document provided as an argument (e.g. "@specs/002-1-1-something/spec.md"), do this:
1. Confirm that the implementation details document exists, fail with a warning if it doesn't
2. Output a summary of the implementation details document and ask the user to confirm
3. Once confirmed, do:
   1. Read the @docs/architecture.md to understand the overall architecture.
   2. Read the @docs/ui-architecture.md to understand the frontend architecture.
   3. invoke the @.claude/commands/plan.md command with implementation details document argument