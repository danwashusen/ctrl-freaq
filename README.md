# CTRL FreaQ

> Researching AI-assisted delivery of complex software systems

## Overview

CTRL FreaQ is an ongoing research effort exploring AI-assisted software
development, focused on delivering a complex, production-quality app from a
real-world product brief (see [Project Brief](docs/brief.md)) by pairing a
single experienced engineer with a team of AI coding assistants.

## Development Approach

The app follows an AI-spec-driven workflow: we begin by co-authoring
comprehensive, structured technical documentation (see [PRD](docs/prd.md),
[Front End Spec](docs/front-end-spec.md), [Architecture](docs/architecture.md),
etc.) and treat those artifacts as the definitive source of truth for the
subsequent AI-assisted implementation. Implementation is carried out by AI
coding assistants—primarily Codex, with Claude Code in supporting roles—working
through [Spec Kit Ext](https://github.com/danwashusen/spec-kit-ext), a
customized version of [GitHub Spec Kit](https://github.com/github/spec-kit/)
with a strong human-in-the-loop focus.
