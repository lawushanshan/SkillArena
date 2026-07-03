# SkillArena

SkillArena is a Codex skill evaluation harness.

The first goal is intentionally narrow: help Codex skill authors automatically verify whether a skill is triggered correctly and improves task outcomes.

## Scope

SkillArena v0 focuses on:

- Running eval cases through `codex exec --json`
- Capturing structured traces
- Checking whether the expected skill behavior happened
- Comparing skill versions with A/B runs
- Producing simple pass/fail reports for local development and CI

SkillArena v0 does not aim to be a general agent observability platform or a universal benchmark suite.

## MVP

- YAML-based eval cases
- Codex runner
- Trace parser for JSONL output
- Deterministic graders for skill usage, command execution, files, and exit status
- Optional LLM judge support later
- Markdown and JSON reports
- CI-friendly exit codes

## Documentation

- [Usage](docs/USAGE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Product and Architecture Review](docs/PRODUCT-ARCHITECTURE-REVIEW.md)
- [Product Shape Decision](docs/ADR-0001-product-shape.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## Core Concepts FAQ

### What is an eval?

An eval is a repeatable test definition for a Codex skill. It describes a task to give Codex and the observable behavior SkillArena should check afterward.

An eval helps answer questions such as:

- Did Codex select the expected skill?
- Did Codex avoid the skill when it should not be used?
- Did Codex run the expected commands?
- Did the commands succeed?
- Did the expected files get created, changed, or left unchanged?

### What is an eval case?

An eval case is one executable test case inside an eval suite. You can think of it as a task brief plus acceptance criteria.

For example:

```yaml
cases:
  - id: creates-audit-report
    prompt: "Review this repository and create audit-report.md."
    workspace:
      fixture: fixtures/security-review
    expect:
      files_created:
        - audit-report.md
      commands_succeeded: true
```

In this case:

- `id` names the case.
- `prompt` is the task sent to Codex.
- `workspace.fixture` selects the initial project files for the run.
- `expect` defines the pass/fail checks.

### What is a fixture?

A fixture is an initial workspace template. It is a directory of prepared files that SkillArena copies before running an eval case.

The original fixture is not modified by Codex. Each run gets a fresh copy, so cases that use the same fixture start from the same file state every time.

Different fixtures can represent different scenarios:

```text
fixtures/
  security-review/
  markdown-doc/
  broken-node-app/
```

### What is a workspace?

A workspace is the actual per-case directory where Codex runs.

`workspace` is a SkillArena concept, not a Codex-specific object. SkillArena creates it by copying the selected fixture into the current run directory, then invokes Codex with that directory as the working directory.

The flow is:

```text
fixture template
  -> copied into a fresh workspace
  -> Codex runs the prompt there
  -> SkillArena compares before/after file state
  -> report is generated
```

Run workspaces are created under:

```text
.skillarena/runs/<run-id>/workspaces/<suite>/<case>/
```

Each selected eval case gets its own workspace. Even when two cases use the same fixture, SkillArena copies that fixture separately so the cases do not affect each other.

## Target Usage

SkillArena v0 is designed as a standalone command-line tool:

```powershell
skillarena init
skillarena run
skillarena compare
```

Developers write eval cases in YAML, run them against Codex with `codex exec --json`, and inspect Markdown or JSON reports under `.skillarena/runs/`.

Use `skillarena compare` to compare the latest two saved run reports during A/B skill iteration. You can also pass two explicit run ids or run directories.

## Examples

- [Basic Audit Example](examples/basic-audit/README.md)

## Repository Status

This repository has a TypeScript CLI with project initialization, eval schema dry-run validation, per-case workspaces, Codex execution, normalized trace parsing, deterministic graders, workspace diff checks, and JSON/Markdown reports.

## Development

```powershell
npm install
npm run check
npm test
npm run build
```
