# SkillArena Architecture

SkillArena is a local-first evaluation harness for Codex skills.

The v0 architecture is intentionally small. It should answer one question well:

> Did this Codex skill trigger correctly and improve the task outcome?

## System Overview

```text
                 +----------------------+
                 |  Eval Suite (YAML)   |
                 |  evals/*.yaml        |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |  CLI / Runner        |
                 |  skillarena run      |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |  Codex Adapter       |
                 |  codex exec --json   |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |  Trace Store         |
                 |  JSONL events        |
                 +----------+-----------+
                            |
                            v
        +-------------------+-------------------+
        |                                       |
        v                                       v
+----------------------+            +----------------------+
| Trace Parser         |            | Workspace Inspector  |
| Normalize events     |            | Files, diffs, exits  |
+----------+-----------+            +----------+-----------+
           |                                   |
           +-------------------+---------------+
                               |
                               v
                    +----------------------+
                    |  Grader Engine      |
                    |  Deterministic      |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |  Reporters          |
                    |  JSON / Markdown    |
                    +----------------------+
```

## Core Data Flow

1. A developer writes eval cases in `evals/*.yaml`.
2. The CLI loads the eval suite and creates an isolated run directory.
3. The Codex adapter executes each prompt with `codex exec --json`.
4. Raw JSONL output is stored without modification.
5. The trace parser converts Codex events into SkillArena's internal event model.
6. The workspace inspector records file changes, command results, and exit status.
7. The grader engine evaluates deterministic assertions.
8. Reporters generate human-readable and machine-readable results.
9. CI exits non-zero when required checks fail.

## Major Components

### CLI

Responsible for user-facing commands.

Expected commands:

```text
skillarena init
skillarena run
skillarena report
```

The CLI should stay thin. It should parse arguments, call application services, and print final results.

### Eval Loader

Responsible for reading and validating eval suite files.

Example future shape:

```yaml
name: markdown-skill
cases:
  - id: creates-table-of-contents
    prompt: "Add a table of contents to this markdown document."
    expect:
      skill_used: markdown
      files_changed:
        - README.md
      commands_succeeded: true
```

The loader should validate eval files before any Codex process starts.

### Codex Adapter

Responsible for invoking Codex.

v0 only supports:

```text
codex exec --json
```

The adapter should own:

- Command construction
- Environment setup
- Timeout handling
- Process exit capture
- Raw JSONL trace capture

Do not spread direct `codex` command calls across the codebase.

### Trace Store

Responsible for preserving raw run data.

Raw traces should be written before parsing so failures are debuggable even if SkillArena has a parser bug.

Suggested output shape:

```text
.skillarena/
  runs/
    2026-06-29T120000Z/
      raw/
        case-id.jsonl
      parsed/
        case-id.json
      report.json
      report.md
```

### Trace Parser

Responsible for normalizing Codex JSONL events into a stable internal model.

The internal event model should be smaller than Codex's raw trace format. It only needs fields SkillArena grades or reports on.

Useful normalized event categories:

- `skill_read`
- `command_started`
- `command_finished`
- `file_read`
- `file_changed`
- `assistant_message`
- `error`

### Workspace Inspector

Responsible for checking the filesystem before and after a run.

It should support assertions such as:

- Expected files exist
- Expected files changed
- Unexpected files did not change
- Generated artifacts match snapshots

### Grader Engine

Responsible for turning parsed run data into pass/fail results.

v0 should prioritize deterministic checks:

- Did the run exit successfully?
- Was the expected skill read or used?
- Were expected files created or changed?
- Did expected commands run?
- Did disallowed commands avoid running?

LLM-based judging can be added later, but it should not be required for the first reliable version.

### Reporters

Responsible for producing output.

v0 should support:

- `report.json` for automation
- `report.md` for humans
- Console summary for local use

The JSON report is the compatibility contract for later UI or CI integrations.

## Suggested Repository Layout

```text
SkillArena/
  src/
    cli/
    core/
      eval-loader/
      runner/
      grader/
      reporter/
    adapters/
      codex/
    trace/
    workspace/
  evals/
    examples/
  fixtures/
  docs/
    ARCHITECTURE.md
  .github/
```

This structure can evolve once the implementation language and package layout are chosen.

## Internal Interfaces

The exact language-level interfaces are not decided yet, but the boundaries should stay stable.

```text
EvalSuite -> Runner -> AgentAdapter -> RawTrace
RawTrace -> TraceParser -> ParsedRun
ParsedRun + WorkspaceState + EvalCase -> Grader -> CaseResult
CaseResult[] -> Reporter -> Report
```

## v0 Non-goals

- Supporting Claude Code, Gemini CLI, OpenCode, or other agents
- Hosted execution
- Multi-user dashboards
- Skill marketplace features
- Complex LLM judge workflows
- General observability or tracing platform features

## Design Principles

- Codex first, adapter later.
- Raw traces are never discarded.
- Deterministic graders come before subjective judges.
- Every failure should be reproducible locally.
- Reports should be useful in both terminal and CI.
- Keep the first architecture boring enough that contributors can extend it quickly.

