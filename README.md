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
- [Product Shape Decision](docs/ADR-0001-product-shape.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## Target Usage

SkillArena v0 is designed as a standalone command-line tool:

```powershell
skillarena init
skillarena run
```

Developers write eval cases in YAML, run them against Codex with `codex exec --json`, and inspect Markdown or JSON reports under `.skillarena/runs/`.

## Repository Status

This repository is at the project definition stage. The next step is to implement the Codex runner and a minimal eval format.
