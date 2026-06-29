# Roadmap

## v0: Codex Skill Eval Harness

- Choose implementation stack and package manager
- Define project config and eval schema
- Define report JSON schema
- Define eval case format
- Run prompts with `codex exec --json`
- Capture JSONL traces and command metadata
- Capture reproducibility metadata
- Implement deterministic graders
- Parse normalized events from Codex JSONL traces
- Add workspace diff graders for created, changed, and unchanged files
- Classify failures
- Generate Markdown and JSON reports
- Support CI exit codes
- Add a minimal example eval project

## v0.1: A/B Evaluation

- Compare runs with and without a skill
- Compare skill version A vs version B
- Report trigger rate, false-positive rate, pass rate, runtime, and cost signals when available

## v0.2: Better Grading

- Add rubric-based LLM judge support
- Add snapshot fixtures for expected artifacts
- Add failure trace summaries

## Later

- Adapter interface for other coding agents
- Web report viewer
- Shared benchmark packs

Non-goals for the first milestone:

- Skill marketplace
- General-purpose observability platform
- Multi-agent framework support
- Hosted SaaS
