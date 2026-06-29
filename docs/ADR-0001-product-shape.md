# ADR 0001: Product Shape

## Status

Accepted

## Context

SkillArena needs a clear product shape so contributors know what they are building.

Possible shapes:

- A Codex skill
- A Codex plugin
- A standalone installable CLI package
- A hosted web service

The first project goal is to automatically evaluate whether Codex skills are effective. That requires running eval cases, invoking Codex, capturing traces, inspecting workspaces, grading results, and producing reports.

## Decision

SkillArena v0 will be a standalone installable CLI package.

Target user experience:

```powershell
skillarena init
skillarena run
skillarena report
```

The CLI is the product. It can be used locally and in CI.

## Why Not a Codex Skill

A Codex skill helps Codex perform a task inside an agent session.

SkillArena needs to orchestrate repeatable eval runs around Codex. It must create isolated workspaces, run `codex exec --json`, capture raw traces, inspect file changes, grade assertions, and emit reports.

Those responsibilities fit a CLI package better than a skill.

A SkillArena skill may be useful later as a convenience layer, for example:

```text
"Use the SkillArena skill to generate eval cases for this skill."
```

That would help authors create evals, but it should not be the execution engine.

## Why Not a Codex Plugin First

A Codex plugin can package skills, commands, tools, hooks, or integrations.

That may become useful after the CLI exists. For example, a plugin could expose SkillArena commands inside Codex or bundle helper skills for writing eval cases.

However, plugin packaging should not be the v0 foundation. The evaluation engine should remain usable outside a Codex session, especially in CI.

## Why Not a Hosted Service First

A hosted service would add account management, remote execution, storage, billing, secrets, and security concerns before the core evaluation loop is proven.

The first version should be local-first.

## Consequences

SkillArena v0 should prioritize:

- A reliable command-line interface
- A stable eval file format
- A Codex adapter
- Local run directories
- JSON and Markdown reports
- CI-friendly exit codes

Future packaging can include:

- A Codex skill for authoring or improving eval cases
- A Codex plugin for convenient command integration
- A web report viewer
- Additional agent adapters

The core evaluation engine should not depend on any one packaging surface.

