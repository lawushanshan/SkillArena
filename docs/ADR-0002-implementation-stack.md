# ADR 0002: Implementation Stack

## Status

Accepted

## Context

SkillArena v0 is a standalone CLI package. The implementation stack should make local installation, CI usage, JSON/YAML processing, and cross-platform command execution straightforward.

Practical options:

- Node.js with TypeScript and npm
- Python with uv or pipx

Both can work. The first implementation should choose one and avoid maintaining two package surfaces.

## Decision

SkillArena v0 will use Node.js, TypeScript, and npm.

The CLI package will expose a `skillarena` command.

## Rationale

Node.js and TypeScript fit the v0 requirements:

- Simple global installation through npm
- Good cross-platform CLI support on Windows, macOS, and Linux
- Strong JSON and YAML tooling
- Straightforward process execution for `codex exec --json`
- Type checking for eval, trace, and report schemas
- Familiar package shape for open-source CLI tools

## Consequences

The repository should include:

- `package.json`
- `tsconfig.json`
- `src/`
- A test runner
- A build command
- A CLI entrypoint that compiles to `dist/`

The project should avoid framework-heavy dependencies until the Codex runner, eval loader, grader, and reporter are proven end-to-end.

## Alternatives Considered

Python remains a good future option for helper scripts or integrations, but the v0 product should not ship both npm and Python package entrypoints.

