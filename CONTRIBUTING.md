# Contributing

Thank you for your interest in contributing to SkillArena! This project follows a
[Code of Conduct](CODE_OF_CONDUCT.md) — please read it before participating.

SkillArena is being built as a focused developer tool for evaluating Codex skills.

## Development Principles

- Keep v0 focused on Codex.
- Prefer deterministic checks before LLM-as-judge scoring.
- Treat traces as first-class data.
- Make failures easy to reproduce locally.
- Avoid adding framework abstractions before the Codex path is proven.

## Getting Started

```powershell
git clone https://github.com/lawushanshan/SkillArena.git
cd SkillArena
npm install
npm run build
npm test
```

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Run the CLI in development mode via `tsx` |
| `npm run check` | Type-check without emitting |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run the Vitest test suite |
| `npm run test:coverage` | Run tests with code coverage |
| `npm run lint` | Lint and format check (Biome) |
| `npm run lint:fix` | Auto-fix lint and format issues |
| `npm run format` | Format source files |

## Code Style

SkillArena uses [Biome](https://biomejs.dev/) for linting and formatting. Run
`npm run lint:fix` before committing to ensure your changes pass CI.

Key conventions:

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- 2-space indentation, double quotes, semicolons, trailing commas
- Keep the CLI thin — business logic belongs in `src/core/`
- Deterministic graders before LLM-as-judge
- Every new behavior should include tests

## Suggested Workflow

1. Open an issue describing the eval or feature gap.
2. Fork the repo and create a branch from `main`.
3. Keep pull requests small and tied to one behavior.
4. Add or update eval fixtures when changing grader behavior.
5. Ensure `npm run check`, `npm test`, and `npm run lint` all pass.
6. Update documentation if the change affects user-facing behavior.
7. Include the command used to verify the change.

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- The eval case, command, and relevant trace or report output
- OS, Codex version, and SkillArena version or commit
