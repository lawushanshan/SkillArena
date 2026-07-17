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
3. SkillArena copies each case fixture and declared local skill into a per-case workspace.
4. The Codex adapter executes each prompt with `codex exec --json` from the prepared workspace.
5. Raw JSONL output is stored without modification.
6. The trace parser converts Codex events into SkillArena's internal event model.
7. The workspace inspector records file changes, command results, and exit status.
8. The grader engine evaluates deterministic assertions.
9. Reporters generate human-readable and machine-readable results.
10. CI exits non-zero when required checks fail.

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

v0 supports:

```text
codex exec --json
```

The adapter should own:

- Command construction
- Environment setup
- Timeout handling
- Process exit capture
- Raw JSONL trace capture
- stderr capture

Do not spread direct `codex` command calls across the codebase.

### Skill Provisioning

When an eval suite declares `skill.name` and `skill.path`, SkillArena requires the path to be a
directory containing `SKILL.md`. It copies the skill into each isolated workspace at:

```text
.codex/skills/<skill-name>/
```

This keeps the evaluated skill local to the case, preserves the source skill, and avoids replacing
the user's `CODEX_HOME`, authentication, or global configuration.

### Trace Store

Responsible for preserving raw run data.

Raw traces should be written before parsing so failures are debuggable even if SkillArena has a parser bug.

Suggested output shape:

```text
.skillarena/
  runs/
    2026-06-29T120000Z/
      workspaces/
        suite-name/
          case-id/
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

Parsed traces are written under:

```text
.skillarena/runs/<run-id>/parsed/<suite>__<case>.json
```

The parser is intentionally tolerant. Unknown Codex events are preserved as `unknown` normalized events, and invalid JSONL lines are recorded as parse errors instead of crashing the whole run.

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

The first implemented deterministic checks use normalized trace events for `skill_used`, `skill_not_used`, `commands`, `commands_succeeded`, and `exit_code`. Workspace snapshots provide `files_created`, `files_changed`, and `files_unchanged` checks.

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

## Agent Adapter Boundary

SkillArena v0 is Codex-only, but the core should not depend directly on Codex-specific trace fields.

The adapter boundary is the reserved extension point for future agents such as Claude Code, Gemini CLI, or OpenCode.

```text
                 +----------------------+
                 |  SkillArena Core     |
                 |  runner/grader/report|
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |  AgentAdapter        |
                 |  Stable contract     |
                 +----------+-----------+
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
+---------------+   +---------------+   +---------------+
| Codex Adapter |   | Claude Adapter|   | OpenCode      |
| v0 supported  |   | future        |   | future        |
+---------------+   +---------------+   +---------------+
```

An adapter should be responsible for agent-specific behavior:

- Building the command line invocation
- Preparing the agent environment
- Capturing raw output and process metadata
- Parsing or routing raw trace events into the normalized model
- Reporting adapter capabilities

The core runner should only depend on normalized behavior:

- Was a skill or instruction file read?
- Which commands started and finished?
- Which files were read, created, or changed?
- Did the agent produce a final answer?
- Did the process fail, timeout, or exit successfully?

This keeps the first version focused while preserving a clean path to more agents later.

## Normalized Event Model

Each adapter should translate its native trace format into a small common event model.

Suggested normalized events:

```text
SkillRead
CommandStarted
CommandFinished
FileRead
FileChanged
AssistantMessage
RunError
```

The grader should use normalized events rather than raw Codex JSONL fields.

Raw traces still remain available for debugging and adapter-specific reports.

## Capability Flags

Not every agent exposes the same trace detail. Adapters should declare capabilities so eval cases can fail early when they require unsupported checks.

Possible capability flags:

```text
skill_read_trace
command_trace
file_read_trace
file_change_detection
token_usage
cost_usage
structured_final_output
```

For example, an eval that asserts `skill_used` should require an adapter with `skill_read_trace`. If a future adapter cannot provide that signal directly, it should either mark the capability unsupported or provide a documented approximation.

## Scripted Skills

SkillArena should not bypass the agent to run scripts embedded in a skill.

For an end-to-end skill eval, the agent must decide whether to follow the skill instructions and run the script. SkillArena observes the trace and grades the result.

This allows SkillArena to catch important failures:

- The agent never selected the skill
- The agent read the skill but ignored the script instructions
- The script ran with the wrong arguments
- The script succeeded but did not improve the task outcome

Direct script contract tests may be added later as a debugging aid, but they should not replace agent-in-the-loop skill evaluation.

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
