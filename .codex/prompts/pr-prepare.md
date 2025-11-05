---
name: Prepare PR
description: Prepare a Pull Request for the current branch.
handoff: Suggest using the `pr-monitor` playbook to monitor the PR after creation.
---

## Instructions

- Use the Github CLI (execute `gh pr create --help` for usage instructions, prefer the `--body-file` option over `--body` to preserve line breaks).
- Confirm `gh auth status` succeeds before continuing.
- Determine the current branch as CURRENT_BRANCH, stop if it is a protected branch or the main branch.
- Determine if there are uncommitted changes in the working directory, if so, then:
   - prepare a commit message based on the changes
   - prompt the user to confirm committing the changes with the prepared message
   - if confirmed, add the changes to the commit and commit them
   - if not confirmed, stop the process
- Confirm that a pull request does not already exist for the current branch, stop if it does.
- Verify the branch exists on the remote (create/push with `git push -u origin CURRENT_BRANCH` if needed).
- Read the feature specification file for the current branch (e.g. `./specs/{CURRENT_BRANCH}/spec.md`) if it exists, and extract problem context, solution summary, acceptance criteria, and test instructions for the PR contents.
- When no feature specification file exists, draft a short specification from the diff: include context, the implemented changes, acceptance criteria, and any testing performed; note in the PR body that the spec was inferred.
- Create a Pull Request for the current branch based on the feature specification:
  - make sure the title complies with the Conventional Commits specification; choose an appropriate prefix (`feat`, `fix`, `chore`, etc.) and keep to ≤72 characters.
  - prepare a body based on the feature specification using a structured template (e.g. Context, Changes, Testing, Follow-ups, Spec reference).
  - attach links to specs, screenshots, or logs when available.
