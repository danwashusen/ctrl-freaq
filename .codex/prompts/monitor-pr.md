---
name: Monitor PR
description: Monitor a Pull Request CI pipeline until the CI pipeline is successful, fixing any non-major issues found.
---

## Instructions

- Use the Github CLI.
- Fetch the Pull Request defined by $PR_URL and output a summary.
- Monitor the CI pipeline until it goes green.
- Avoid waiting for the CI pipeline to complete if a stage has failed.
- Attempt to fix CI issues as long as it does not require significant changes to what is being delivered.
- Consult existing comments on the Pull Request for context.
- Keep notes on issues and progress as comments on the Pull Request.
