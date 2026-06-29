# Contributing

SkillArena is being built as a focused developer tool for evaluating Codex skills.

## Development Principles

- Keep v0 focused on Codex.
- Prefer deterministic checks before LLM-as-judge scoring.
- Treat traces as first-class data.
- Make failures easy to reproduce locally.
- Avoid adding framework abstractions before the Codex path is proven.

## Suggested Workflow

1. Open an issue describing the eval or feature gap.
2. Keep pull requests small and tied to one behavior.
3. Add or update eval fixtures when changing grader behavior.
4. Include the command used to verify the change.

