# Usage

This document describes the current developer experience for SkillArena v0.

The implemented CLI provides `init`, `run`, `report`, `compare`, and optional rubric-based OpenAI
judging. Additional agent adapters remain future work.

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

SkillArena is a Node.js CLI and requires Node.js 20 or later. From a source checkout:

```powershell
npm install
npm run build
node dist/cli/index.js --help
```

When published, the package can be installed globally:

```powershell
npm install -g skillarena
```

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

The generated eval demonstrates file creation, file changes, file deletion, and unchanged file assertions. The init command should not modify existing skill files.

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

When a suite declares `skill`, its `path` must point to a directory containing `SKILL.md`.
SkillArena copies that directory into each isolated case workspace at
`.codex/skills/<skill-name>/` before invoking Codex. The source skill and fixture are never
modified by the run.

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
      commands_not_run:
        - contains: "npm publish"
      commands_succeeded: true
```

The eval format supports:

- `id`
- `prompt`
- `workspace.fixture`
- `expect.skill_used`
- `expect.skill_not_used`
- `expect.commands`
- `expect.commands_not_run`
- `expect.files_created`
- `expect.files_changed`
- `expect.files_deleted`
- `expect.files_unchanged`
- `expect.file_snapshots`
- `expect.exit_code`

`file_snapshots` compares a generated workspace file byte-for-byte with a file below the configured
`paths.snapshots` directory. Each `snapshot` value is relative to that directory:

```yaml
paths:
  snapshots: snapshots

# In an eval case
expect:
  file_snapshots:
    - path: audit-report.md
      snapshot: code-audit/audit-report.md
```

The snapshot must exist before the run starts. A missing snapshot is a configuration error; a
content mismatch fails the case with `artifact_mismatch`. Use this only for stable artifacts.

## Rubric Judging

Use `expect.judge` when deterministic assertions cannot fully assess the quality of an artifact.
The judge scores each criterion from 0 to 100 and compares the weighted overall score with
`min_score`.

```yaml
expect:
  files_created:
    - audit-report.md
  judge:
    min_score: 80
    files:
      - audit-report.md
    rubric:
      - criterion: actionable-findings
        description: "The report identifies concrete risks and gives a useful remediation."
        weight: 2
      - criterion: scope
        description: "The report stays grounded in the supplied workspace evidence."
        weight: 1
```

Only files declared in `judge.files` are sent as artifact evidence. They must be relative to the
case workspace. Individual files and the combined evidence are truncated before the API request.

The judge is opt-in. Cases without `expect.judge` never call OpenAI. Configure the API key and an
explicit model only when running judged cases:

```powershell
$env:OPENAI_API_KEY = "..."
skillarena run --judge-model <model-id>

# Or set the model once for the shell/session.
$env:SKILLARENA_JUDGE_MODEL = "<model-id>"
skillarena run
```

`--judge-timeout-ms <ms>` controls the per-case OpenAI request timeout and defaults to `60000`.
Dry-run validates the judge schema and artifact paths but never calls OpenAI. Missing credentials,
missing model configuration, an API error, timeout, invalid structured output, or a score below
`min_score` fails only that case with the `judge_failed` category.

## Run Evals

The implementation supports dry-run validation and Codex execution. Use `--codex-command <command>`
to select a Codex executable. When given an absolute executable path, SkillArena also adds that
executable's directory to the Codex child process `PATH`, so companion tools shipped alongside it
remain available to skills.

Dry-run mode loads project config, validates eval YAML, prepares per-case workspaces, records run metadata, and writes reports without invoking Codex.

Run all evals:

```powershell
skillarena run
```

Run a specific eval file:

```powershell
skillarena run evals/markdown-skill.yaml
```

Run a specific suite by name:

```powershell
skillarena run --suite markdown-skill
```

Run a specific case:

```powershell
skillarena run evals/markdown-skill.yaml --case creates-table-of-contents
```

Limit the number of selected cases:

```powershell
skillarena run --max-cases 5
```

Validate without invoking Codex:

```powershell
skillarena run --dry-run
```

Keep per-case workspaces for debugging. By default, workspaces are removed after `report.json` and
`report.md` are written; raw JSONL, stderr, parsed traces, and reports are always retained.

```powershell
skillarena run --case creates-table-of-contents --keep-workspace
skillarena run --dry-run --keep-workspace
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
- `expect.commands_not_run`
- `expect.commands_succeeded`
- `expect.exit_code`
- `expect.files_created`
- `expect.files_changed`
- `expect.files_deleted`
- `expect.files_unchanged`
- `expect.judge`

Codex declares support for `skill_read_trace`, `command_trace`, and `file_change_detection`.
The runner maps each case's expectations to these capabilities before execution. A case requiring an
unavailable capability is not run: its check is reported as `unsupported`, its case and suite are
reported as `blocked`, and the command exits non-zero.

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

SkillArena can compare two saved run reports for A/B evaluation.

Example:

```powershell
skillarena run evals/markdown-skill.yaml
skillarena run evals/markdown-skill.yaml
skillarena compare
```

When no run directories are provided, `compare` uses the latest two runs from the configured runs directory. You can also pass run ids or explicit run directories:

```powershell
skillarena compare <baseline-run-id> <candidate-run-id>
skillarena compare .skillarena/runs/<baseline-run-id> .skillarena/runs/<candidate-run-id>
```

By default, SkillArena compares only runs with the same mode, project configuration hash, eval
hashes, fixture hashes, and selected suite/case set. This prevents a dry-run, changed benchmark,
or partial selection from being reported as a Skill improvement. Skill source hash changes are
expected in A/B evaluation and are shown in the result. Codex, Node, and platform changes are
reported as warnings because they can influence agent behavior.

For diagnostics only, compare otherwise incompatible reports explicitly:

```powershell
skillarena compare <baseline-run-id> <candidate-run-id> --allow-incompatible
```

Do not use an incompatible comparison as a CI regression gate. Create a baseline from the same
eval and fixture version, then change only the Skill source before running the candidate.

The comparison shows:

- Verdict: `improved`, `regressed`, `mixed`, or `unchanged`
- Pass rate change
- Passed, failed, and blocked case deltas
- Case status changes across common suite/case ids
- Trigger rate from `expect.skill_used`
- False-positive rate from failed `expect.skill_not_used` checks
- Concrete improved, regressed, added, and removed case ids
- Runtime change

Print machine-readable comparison data:

```powershell
skillarena compare --json
```

Fail the command when the candidate run has a regression:

```powershell
skillarena compare --fail-on-regression
```

A regression means at least one negative comparison signal was observed: pass rate decreased, a common case regressed, trigger rate decreased, or false-positive rate increased. `mixed` results also count as regressions for this flag because they contain at least one negative signal.

## Reports

Each run produces a directory like:

```text
.skillarena/
  runs/
    2026-06-29T120000Z/
      workspaces/              # present only with --keep-workspace
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

Each case report includes the prepared workspace path and a `preserved` flag. A workspace path is
usable only when that flag is `true`.

For judged cases, the report also includes the judge status, model, prompt version, score,
threshold, criterion scores, and artifact metadata. It excludes the API key, complete judge prompt,
and raw API response.

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

SkillArena exits with:

- `0` when required evals pass
- non-zero when required evals fail or cannot run

The repository's `Verify` workflow runs type checks, tests, a build, and the example project's
dry-run on every pull request. It deliberately does not invoke Codex or require credentials.

For real Codex evals, manually dispatch `Verify` with `run_real_evals=true`. That job runs only
on a self-hosted runner, where the maintainer must provision a working, authenticated Codex CLI.
Set the optional repository variable `SKILLARENA_CODEX_COMMAND` to an absolute Codex executable
path when `codex` is not on the runner's `PATH`. The workflow preserves run artifacts for review.

Minimal GitHub Actions usage:

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
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
      - working-directory: examples/basic-audit
        run: node ../../dist/cli/index.js run --dry-run
```

Do not put long-lived Codex credentials into pull-request workflows. Real evals use network access
and may incur model usage costs.

## Failure Debugging

When an eval fails, developers should inspect:

1. The console summary
2. The failure trace summary in the case section of `report.md`
3. The normalized trace in `parsed/*.json`
4. The raw Codex JSONL trace in `raw/*.jsonl`
5. The workspace when the run used `--keep-workspace`

Useful debug commands:

```powershell
skillarena run --case creates-table-of-contents --keep-workspace
skillarena report .skillarena/runs/2026-06-29T120000Z
```

Failure summaries identify the primary failure category and list the observed skill reads, non-zero
commands, run errors, and JSONL parse-error locations. They intentionally exclude command output,
assistant messages, and raw parse-error text; use the preserved artifacts when those details are needed.

## Local Safety Model

SkillArena runs each case in an isolated workspace copied from fixtures.

The local execution model provides:

- Per-case run directory
- Fixture copy before execution
- Timeout
- Raw trace capture
- File change inspection
- Optional workspace preservation for every selected case via `--keep-workspace`

It is not a security sandbox for untrusted code. Container or VM isolation can be added later.
