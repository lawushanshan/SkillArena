# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-13

Initial public release of SkillArena, a local-first evaluation harness for Codex skills.

### Added

- CLI commands: `init`, `run`, `report`, `compare`
- YAML-based eval case definitions with schema validation
- Codex adapter executing prompts via `codex exec --json`
- Normalized trace parser converting Codex JSONL events to internal model
- Deterministic graders for skill usage, command execution, file changes, and exit status
- Optional rubric-based OpenAI judge with structured output and score thresholds
- A/B comparison of runs with trigger rate, false-positive rate, pass rate, and runtime deltas
- Snapshot fixtures for byte-for-byte artifact comparison
- Failure trace summaries in Markdown reports
- Reproducibility metadata (SkillArena version, Node version, platform, config/eval/fixture hashes)
- Workspace isolation per case with optional `--keep-workspace` retention
- Adapter capability flags that block unsupported checks before execution
- Evaluation integrity checks that block incompatible comparisons by default
- JSON and Markdown report output
- CI-friendly exit codes
- Example project with code-audit, config-hardening, and release-notes eval suites
- Bilingual documentation (English and Simplified Chinese)
- Contributing guide, Code of Conduct, and Security Policy
- GitHub Actions CI workflow with dry-run validation
- Issue templates and pull request template

[Unreleased]: https://github.com/lawushanshan/SkillArena/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lawushanshan/SkillArena/releases/tag/v0.1.0
