Start a new feature by creating a specification and feature branch.

When asked to format the Story as an argument, do:
1. Define epic_number as the Epic number (e.g. "Epic 1" = 1, "Epic 7" = 7, "Epic 14" = 14)
2. Define story_number as the Story number (e.g. "Story 2" = 2, "Story 5" = 5, "Story 11" = 11)
3. Define story_title as the Story title (leave the title as is, do not reformat)
4. Output "{epic_number}.{story.number} - {story_title}"

Execute the following to build the context:
1. Read the @docs/prd.md to understand ALL the product requirements.
2. Read the @docs/front-end-spec.md to understand user interface requirements.

Given the feature description provided as an argument, do this:
1. If the feature description specifies a Story (e.g. "Epic 1, Story 2"), do:
    1. Check that the Story exists in the @docs/prd.md, fail with a warning if the Story can't be found
    2. Output the Story to the user and ask them to confirm
    3. When confirmed, invoke the @.claude/commands/specify.md command with the Story formatted as an argument
2. If the feature description describes something other than a Story, do:
   1. Restate the feature description to the user and ask them to confirm
   2. When confirmed, invoke the @.claude/commands/specify.md command with the feature description as an argument