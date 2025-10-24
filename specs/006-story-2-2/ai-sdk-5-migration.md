# AI SDK v5 Migration Notes

## Overview

This document tracks the in-flight migration of the CTRL FreaQ co-authoring
stack to `ai@5.x`. The upgrade introduces a richer stream protocol, expanded
message part semantics, and breaking changes across the `@ai-sdk/*` provider
packages.

## Key Changes

- Adopt the v5 `TextStreamPart` lifecycle (`text-start`, `text-delta`,
  `finish-step`, etc.) inside `packages/ai/src/session/proposal-runner.ts`.
  Tokens now stream via `part.text`, and the provider surfaces new events like
  `reasoning-*`, `tool-input-*`, `tool-call`, and `finish-step`.
- Aggregate assistant responses from `result.response.messages`, normalising
  `AssistantContent` into a `parts` payload that accompanies the raw proposal
  JSON. The legacy delta buffer stays as a fallback for providers that omit a
  response body.
- Extend `ProposalProviderEvent` to forward the new stream events so downstream
  consumers (API services, web UI, CLI) can react without losing data.
- Rework the unit suite to mock the v5 stream shape and assert that tokens,
  reasoning deltas, tool activity, and assistant parts are emitted correctly.

## Follow-Ups

- Resolve the outstanding Zod compatibility errors triggered during
  `pnpm lint/typecheck/test`. The codemod upgraded `zod` to v4, which exposes
  stricter typing (e.g. optional array defaults, `ipv4/ipv6` helpers). The
  shared-data schema layer needs a targeted refactor before CI can pass again.
- Once the schemas are aligned, rerun `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, and `pnpm build` to capture a clean baseline.
- Revisit the API and web layers to decide how (or if) we persist the structured
  `parts` alongside existing `rawText` payloads.
