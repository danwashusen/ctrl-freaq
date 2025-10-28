---
name: Prepare PR
description: Prepare a Pull Request for the current branch.
handoff: Suggest using the `pr-monitor` playbook to monitor the PR after creation.
---

## Instructions

- Use the Github CLI (execute `gh pr create --help` for usage instructions, prefer the `--body-file` option over `--body` to preserve line breaks).
- Determine the current branch as CURRENT_BRANCH, stop if it is a protected branch or the main branch.
- Confirm that there are no uncommitted changes in the working directory, stop if there are.
- Confirm that a pull request does not already exist for the current branch, stop if it does.
- Read the feature specification file for the current branch (e.g. `./specs/{CURRENT_BRANCH}/spec.md`), fail if no spec is found.
- Create a Pull Request for the current branch based on the feature specification:
  - make sure the title complies with the Conventional Commits specification
  - prepare a body based on the feature specification
