# Roadmap

## v0: Codex Skill Eval Harness

- [x] Choose implementation stack and package manager
- [x] Define project config and eval schema
- [x] Define report JSON schema
- [x] Define eval case format
- [x] Run prompts with `codex exec --json`
- [x] Capture JSONL traces and command metadata
- [x] Capture reproducibility metadata
- [x] Implement deterministic graders
- [x] Parse normalized events from Codex JSONL traces
- [x] Classify failures
- [x] Generate Markdown and JSON reports
- [x] Support CI exit codes
- [x] Add a minimal example eval project
- [x] Add optional workspace retention for debugging
- [x] Block cases whose adapter capabilities are unavailable

## v0.1: A/B Evaluation

- [x] Compare runs with and without a skill
- [x] Compare skill version A vs version B
- [x] Report trigger rate, false-positive rate, pass rate, runtime, and cost signals when available

## v0.2: Better Grading

- [x] Add rubric-based OpenAI judge support with structured rubric results
- [x] Add snapshot fixtures for expected artifacts
- [x] Add failure trace summaries

## v0.3: Evaluation Integrity

- [x] Block comparisons across run modes or changed benchmark definitions by default
- [x] Surface Skill source changes and execution-environment warnings in comparisons
- [x] Document compatible baseline and candidate comparison rules

## Later

- Adapter interface for other coding agents
- Web report viewer
- Shared benchmark packs

Non-goals for the first milestone:

- Skill marketplace
- General-purpose observability platform
- Multi-agent framework support
- Hosted SaaS
