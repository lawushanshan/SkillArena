# Roadmap

## v0: Codex Skill Eval Harness

- Define eval case format
- Run prompts with `codex exec --json`
- Capture JSONL traces and command metadata
- Implement deterministic graders
- Generate Markdown and JSON reports
- Support CI exit codes

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

