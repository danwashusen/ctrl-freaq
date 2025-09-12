Plan how to implement the specified feature.

1. Read the @docs/architecture.md to understand the full backend architecture.
2. Read the @docs/ui-architecture.md to understand the full UI architecture.
2. Determine the Epic and Story that needs a spec, asking the user if necessary. When asking the user which Epic and
   story that needs a spec, list all Epics and stories in order in a summary format.
3. Analyze the @docs/prd.md and extract the details relating the specific Epic and Story.
4. Confirm the details of the specific Epic and Story with the user.
5. Invoke the @.claude/commands/specify.md command with instructions with "{epic_number}-{story.number}-{story_title}: Create a
   spec for Epic {epic}, Story {story} described in the @docs/prd.md document".