---
name: Monitor PR
description:
  Monitor a Pull Request CI pipeline until the CI pipeline is successful, fixing
  any non-major issues found.
---

## Instructions

- Use the Github CLI.
- Determine if the current branch is associated with a Pull Request, if not ask
  the user to provide the URL of the Pull Request.
- Fetch the Pull Request details and output a summary.
- Consult existing comments on the Pull Request for context.
- Make sure the Pull Request is up to date with the target branch, rebase if
  necessary.
- Wait for any currently running CI pipelines to complete before entering the
  fix loop.
- Attempt to fix CI issues in a loop until the CI pipeline is successful:
  - Make sure the Pull Request is up to date with the target branch, rebase if
    necessary.
  - Apply fixes as long as it does not require significant changes to what is
    being delivered by the Pull Request.
  - Try to reproduce and verify fixes to CI issues locally.
  - Commit (using th Conventional Commit format) and push fixes and continue to
    the next iteration.
- Keep notes on issues and progress as comments on the Pull Request, use Github
  CLI with the `--body-file <FILE_PATH>` argument to ensure formatting is
  preserved.
