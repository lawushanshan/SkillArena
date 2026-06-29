# Usage

This document describes the intended developer experience for SkillArena v0.

The implementation is not complete yet. Treat this as the product contract we are building toward.

## Who Uses SkillArena

SkillArena is for developers who maintain Codex skills and want to answer:

- Does Codex select this skill when it should?
- Does Codex avoid this skill when it should not be used?
- Does the skill cause the expected commands, files, and outputs?
- Did a new skill version improve or regress behavior?

## Expected Workflow

```text
1. Install SkillArena
2. Initialize eval files in a skill project
3. Write eval cases as YAML
4. Run evals locally
5. Inspect Markdown and JSON reports
6. Add the eval command to CI
```

## Installation

SkillArena v0 is intended to be a standalone CLI package. The exact package ecosystem is not decided yet, but the target experience should be one command.

Possible future install commands:

```powershell
npm install -g skillarena
```

or:

```powershell
uv tool install skillarena
```

The first implementation should choose one ecosystem and keep installation simple.

## Initialize a Project

From a repository that contains one or more Codex skills:

```powershell
skillarena init
```

Expected generated files:

```text
skillarena.yaml
evals/
  sample-audit.yaml
fixtures/
  sample-workspace/
    README.md
    package.json
    src/app.js
.skillarena/
  runs/
```

The generated eval demonstrates file creation, file changes, and unchanged file assertions. The init command should not modify existing skill files.

## Example Project

The repository includes a complete example at:

```text
examples/basic-audit/
```

It contains:

- `skillarena.yaml`
- `evals/code-audit.yaml`
- `fixtures/security-review/`

Use it to understand how eval files and fixtures fit together.

## Write Eval Cases

An eval file describes prompts and expected observable behavior.

Example:

```yaml
name: markdown-skill
agent: codex
cases:
  - id: creates-table-of-contents
    prompt: "Add a table of contents to README.md."
    workspace:
      fixture: fixtures/markdown-basic
    expect:
      skill_used: markdown
      files_changed:
        - README.md
      commands_succeeded: true

  - id: does-not-trigger-for-unrelated-task
    prompt: "List the files in this repository."
    workspace:
      fixture: fixtures/markdown-basic
    expect:
      skill_not_used: markdown
      commands_succeeded: true
```

The first eval format should support:

- `id`
- `prompt`
- `workspace.fixture`
- `expect.skill_used`
- `expect.skill_not_used`
- `expect.commands`
- `expect.files_created`
- `expect.files_changed`
- `expect.files_unchanged`
- `expect.exit_code`

## Run Evals

The current implementation supports both dry-run validation and minimal Codex execution.

Dry-run mode loads project config, validates eval YAML, copies fixtures into per-case workspaces, records run metadata, and writes reports without invoking Codex.

Run all evals:

```powershell
skillarena run
```

Run a specific eval file:

```powershell
skillarena run evals/markdown-skill.yaml
```

Run a specific case:

```powershell
skillarena run evals/markdown-skill.yaml --case creates-table-of-contents
```

Validate without invoking Codex:

```powershell
skillarena run --dry-run
```

Expected console output:

```text
SkillArena

Agent: codex
Suite: markdown-skill

PASS creates-table-of-contents
PASS does-not-trigger-for-unrelated-task

2 passed, 0 failed
Report: .skillarena/runs/2026-06-29T120000Z/report.md
```

The current Codex execution path grades process-level results and the first deterministic trace assertions:

- timeout and exit code
- raw JSONL output and stderr
- parsed trace availability
- `expect.skill_used`
- `expect.skill_not_used`
- `expect.commands`
- `expect.commands_succeeded`
- `expect.exit_code`
- `expect.files_created`
- `expect.files_changed`
- `expect.files_unchanged`

## Evaluate Scripted Skills

SkillArena does not directly execute scripts inside a skill.

For end-to-end skill evaluation, Codex must decide whether to run the script based on the skill instructions. SkillArena observes and grades what happened.

Example:

```yaml
name: code-audit-skill
agent: codex
cases:
  - id: runs-audit-script
    prompt: "Review this repository for security issues and write a report."
    workspace:
      fixture: fixtures/security-review
    expect:
      skill_used: code-audit
      commands:
        - contains: "node scripts/audit.js"
          exit_code: 0
      files_created:
        - audit-report.md
```

This catches failures that direct script tests cannot catch, such as Codex reading the skill but ignoring the script instructions.

## Compare Skill Versions

The target v0.1 workflow is A/B evaluation.

Example:

```powershell
skillarena run evals/markdown-skill.yaml --variant baseline
skillarena run evals/markdown-skill.yaml --variant candidate
skillarena compare baseline candidate
```

The report should show:

- Pass rate change
- Skill trigger rate change
- False-positive rate change
- Runtime change
- Token or cost change when available

## Reports

Each run should produce a directory like:

```text
.skillarena/
  runs/
    2026-06-29T120000Z/
      workspaces/
        markdown-skill/
          creates-table-of-contents/
      raw/
        creates-table-of-contents.jsonl
      parsed/
        creates-table-of-contents.json
      report.json
      report.md
```

`report.md` is for humans.

`report.json` is for automation and should be treated as the stable report contract.

The JSON report starts with:

```json
{
  "schemaVersion": "0.1",
  "tool": "skillarena",
  "mode": "run"
}
```

Reports also include reproducibility metadata such as SkillArena version, Node version, platform, config hash, eval file hashes, fixture hashes, and Codex version when detected.

Each case report includes the prepared workspace path. Future Codex execution will use that path as the case working directory.

Render the latest report again:

```powershell
skillarena report
```

Render a specific run directory:

```powershell
skillarena report .skillarena/runs/2026-06-29T120000Z
```

The command reads `report.json`, rewrites `report.md`, and prints a concise summary. This is useful when inspecting or sharing a saved run without invoking Codex again.

## CI Usage

SkillArena should exit with:

- `0` when required evals pass
- non-zero when required evals fail or cannot run

Example GitHub Actions usage:

```yaml
name: SkillArena

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install SkillArena
        run: npm install -g skillarena
      - name: Run skill evals
        run: skillarena run
```

The exact installation command will be updated after the implementation language and package manager are finalized.

## Failure Debugging

When an eval fails, developers should inspect:

1. The console summary
2. The case section in `report.md`
3. The normalized trace in `parsed/*.json`
4. The raw Codex JSONL trace in `raw/*.jsonl`
5. The preserved workspace when `--keep-workspace` is enabled

Useful debug commands:

```powershell
skillarena run --case creates-table-of-contents --keep-workspace
skillarena report .skillarena/runs/2026-06-29T120000Z
```

## Local Safety Model

SkillArena v0 should run each case in an isolated workspace copied from fixtures.

The v0 local sandbox should provide:

- Per-case run directory
- Fixture copy before execution
- Timeout
- Raw trace capture
- File change inspection
- Optional workspace preservation for failed cases

It is not a security sandbox for untrusted code. Container or VM isolation can be added later.
