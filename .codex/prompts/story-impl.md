# Playbook Wrapper: Intelligently implement tasks from a tasks.md file with analysis, validation, and progress tracking.

You are executing the CTRL FreaQ playbook. Treat `docs/playbooks/story-impl.md`
as the canonical source of truth. Do not rely on summaries or cached knowledge.

Instructions:

- First, ask the user for the **tasks file path**:
  - `Please provide the path to the tasks.md file (e.g. specs/005-story-2-1/tasks.md).`

- Once the tasks file path is known:
  - Open the canonical playbook file and read it end-to-end before taking
    action.
  - Then open the given tasks file.
  - Follow every section of the playbook in order, mirroring checklists,
    questions, and output contracts exactly as written.
  - Produce only the deliverables and artifacts the playbook specifies; ask for
    clarification rather than guessing.
  - Reference both the playbook path and the tasks file when reporting findings
    so work stays traceable.
  - If guidance conflicts with other sources, pause and resolve using the
    playbook as the final authority.
