# ADR-0003: Agent Adapter Interface

Date: 2026-08-14

## Status

Accepted

## Context

SkillArena v0 through v0.3 is tightly coupled to Codex. The runner calls
`runCodexExec` directly, parses Codex JSONL traces, and hardcodes
`source: "codex"` in normalized events.

The roadmap calls for an adapter interface so SkillArena can evaluate skills
against other coding agents (Claude Code, Gemini CLI, etc.) without rewriting
the grading, reporting, or comparison layers.

## Decision

Define a formal `AgentAdapter` interface with four members:

- `name`: identifies the agent (matches the `agent` field in eval suites)
- `capabilities`: declares which trace event types the adapter can produce
- `execute(options)`: runs a prompt against the agent and captures raw output
- `parseTrace(rawPath)`: converts raw output to SkillArena's normalized trace model

The Codex adapter (`createCodexAdapter`) is the reference implementation. It
wraps the existing `runCodexExec` and `parseCodexJsonlTrace` functions behind
the interface contract without changing their behavior.

## Consequences

**Positive:**

- New agents can be added by implementing one interface
- The grading and reporting layers remain agent-agnostic
- Capability checks already work: unsupported cases are blocked before execution

**Negative:**

- The runner (`run-evals.ts`) still calls Codex functions directly; wiring it
  to the interface is future work
- The `source` field in `NormalizedEventBase` and `ParsedTrace` is hardcoded
  to `"codex"`; generalizing it requires a schema change
- Dynamic imports in the factory add a small indirection cost

## Future Work

1. Refactor `run-evals.ts` to accept an `AgentAdapter` and dispatch through it
2. Generalize the `source` field to a string union or remove the constraint
3. Add a second adapter to validate the interface design
