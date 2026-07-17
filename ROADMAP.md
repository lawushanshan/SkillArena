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

## v0.1: A/B Evaluation

- [x] Compare runs with and without a skill
- [x] Compare skill version A vs version B
- [x] Report trigger rate, false-positive rate, pass rate, runtime, and cost signals when available

## v0.2: Better Grading

- [ ] Add rubric-based LLM judge support
- [x] Add snapshot fixtures for expected artifacts
- [x] Add failure trace summaries

## Later

- Adapter interface for other coding agents
- Web report viewer
- Shared benchmark packs

Non-goals for the first milestone:

- Skill marketplace
- General-purpose observability platform
- Multi-agent framework support
- Hosted SaaS
