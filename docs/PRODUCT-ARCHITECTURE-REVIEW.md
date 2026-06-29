# Product and Architecture Review

This review captures gaps that are not yet fully specified in the current SkillArena docs.

The project direction is sound: v0 should be a standalone CLI for evaluating Codex skills. The remaining work is mostly about turning that direction into a reliable product contract.

## Product Gaps

### 1. Target User Segments

Current docs say "developers who maintain Codex skills." That is correct but broad.

We should explicitly support three initial user segments:

- Individual skill authors validating a local skill before publishing or sharing it
- Team maintainers reviewing skill changes in pull requests
- Platform/tooling teams maintaining shared skill packs

This matters because each segment cares about different outputs:

- Individual authors need fast local feedback and preserved failure workspaces
- Teams need CI exit codes and readable pull request reports
- Platform teams need A/B comparisons, regression history, and compatibility checks

### 2. Skill Discovery

We have not defined how SkillArena finds skills.

Open questions:

- Does the user pass `--skill path/to/skill`?
- Does SkillArena discover `.codex/skills/**/SKILL.md`?
- Does it support global Codex skills under the user's Codex home?
- Does an eval file declare the skill path?

Recommended v0 decision:

Use explicit skill paths in config or eval files. Add discovery later.

Example:

```yaml
name: markdown-skill
agent: codex
skill:
  name: markdown
  path: .codex/skills/markdown
```

### 3. Eval Project Model

We have examples, but we have not defined the project root contract.

SkillArena needs to know:

- Where eval files live
- Where fixtures live
- Where skills live
- Where run artifacts should be written
- Which defaults apply across suites

Recommended v0 shape:

```text
skillarena.yaml
evals/
fixtures/
.skillarena/runs/
```

`skillarena.yaml` should hold defaults. Individual eval files should override them only when needed.

### 4. Reproducibility

Agent behavior is probabilistic and can change with model, Codex version, and environment.

We have not defined what metadata must be captured for reproducibility.

Recommended v0 run metadata:

- SkillArena version
- Codex version
- Agent adapter name and version
- Eval suite file hash
- Skill file hash
- Fixture hash
- OS and shell
- Start time and duration
- Command arguments
- Environment allowlist

Without this metadata, reports will be hard to compare over time.

### 5. Credentials and Environment

SkillArena will invoke Codex, which may depend on existing local authentication and configuration.

We need to document:

- SkillArena does not manage Codex login in v0
- SkillArena checks that `codex` is available before running
- CI users must configure Codex authentication separately
- Environment variables should be allowlisted in reports to avoid leaking secrets

### 6. Local Safety and Untrusted Code

The current docs say v0 is not a security sandbox. That is correct, but we should make it more operational.

Recommended v0 safety contract:

- Never run evals directly in the source repository
- Always copy fixtures into a per-case run directory
- Default timeout per case
- Configurable max output size
- Optional `--keep-workspace` for debugging
- Redact known secret-like environment values from reports

Future:

- Docker runner
- Network control
- Resource limits

### 7. Scoring Semantics

We say pass/fail, but not how a suite result is calculated.

Recommended v0 scoring model:

- A case has multiple checks
- Each check has `pass`, `fail`, or `unsupported`
- A case fails if any required check fails
- A case is blocked if a required adapter capability is missing
- A suite fails if any required case fails or is blocked

Optional checks can warn without failing the suite.

### 8. Negative Cases and False Positives

We mention `skill_not_used`, but this should become a first-class product feature.

Negative cases are essential because a bad skill can trigger too often and degrade unrelated work.

Recommended v0 metrics:

- Trigger rate
- False-positive rate
- False-negative rate
- Pass rate

### 9. Failure Taxonomy

Reports should classify failures, not just show failed assertions.

Recommended failure categories:

- `setup_error`: Codex missing, auth missing, invalid config
- `adapter_error`: failed to invoke or parse agent output
- `timeout`: case exceeded time limit
- `skill_not_triggered`: expected skill was not used
- `skill_misfire`: skill was used when it should not be
- `command_failed`: expected command failed or unexpected command ran
- `artifact_mismatch`: expected files or snapshots did not match
- `judge_failed`: rubric or LLM judge failed

This makes reports useful to humans and automation.

### 10. Trace Format Stability

Codex JSONL may evolve. Our architecture says raw traces are preserved and normalized events are used, which is right.

We still need:

- Parser fixtures for sample raw traces
- Graceful handling for unknown event types
- Adapter capability checks
- Versioned normalized report schema

### 11. Report Schema Versioning

`report.json` is intended as a stable contract, but we have not specified schema versioning.

Recommended v0:

```json
{
  "schemaVersion": "0.1",
  "tool": "skillarena",
  "run": {},
  "summary": {},
  "cases": []
}
```

The schema can evolve, but versioning should exist from the first implementation.

### 12. Language and Packaging Choice

The product shape is a CLI, but the implementation ecosystem is undecided.

This is a blocking architecture decision before implementation.

Pragmatic options:

- Node.js/TypeScript: natural for CLI distribution with `npm`, good YAML/JSON tooling, cross-platform
- Python: strong scripting ecosystem, easy local tooling, `uv tool` distribution

Recommended next ADR:

Choose the v0 implementation stack and package manager.

### 13. CI Reality

CI usage depends on Codex availability, authentication, network, model access, and cost.

We should avoid promising that public CI will work out of the box.

Recommended v0 docs:

- Local use is primary
- CI is supported when Codex authentication is configured
- CI examples should include placeholders for auth setup
- Reports should work even when cases fail during setup

### 14. Cost and Runtime Controls

Skill evals can become expensive or slow.

Recommended v0 controls:

- `--case`
- `--suite`
- `--fail-fast`
- `--timeout`
- `--max-cases`
- `--dry-run`

Later:

- Budget limits
- Parallelism
- Historical cost comparison

### 15. Fixture Strategy

Fixtures are central to repeatability, but not yet specified.

Recommended v0:

- Fixtures are normal directories under `fixtures/`
- Each case copies a fixture into a new run workspace
- Large fixtures are discouraged
- Snapshot expectations should be opt-in

### 16. Configuration Precedence

We need predictable precedence:

```text
CLI flags > eval file > skillarena.yaml > built-in defaults
```

Without this, debugging will be frustrating.

### 17. Privacy and Data Handling

Reports and raw traces may contain prompts, file contents, command outputs, and secrets.

Recommended v0:

- Store artifacts locally by default
- Do not upload anything
- Document that raw traces may contain sensitive data
- Redact common secret patterns in console and Markdown report where feasible
- Keep raw traces complete for debugging, but warn users before sharing them

### 18. Compatibility Matrix

SkillArena depends on external tool behavior.

We should document tested versions for:

- Operating systems
- Node.js or Python runtime
- Codex CLI
- Shells

### 19. Extensibility Without Premature Abstraction

The Agent Adapter boundary is good. The missing piece is a rule for when to add abstraction.

Recommended rule:

Do not implement a second adapter abstraction until the Codex adapter works end-to-end. Define interfaces now, but keep implementations concrete.

### 20. Success Criteria

We should define what proves v0 is useful.

Recommended v0 success criteria:

- Can evaluate at least 3 real Codex skills
- Each skill has at least 10 cases
- Detects missed trigger, false trigger, command failure, and artifact mismatch
- Produces a report useful enough to fix a failed skill without rerunning manually
- Runs on Windows and Linux

## Recommended Next Decisions

1. Choose implementation stack and package manager.
2. Define `skillarena.yaml` and eval file schema.
3. Define `report.json` schema v0.1.
4. Define Codex adapter input/output contract.
5. Define local run workspace and fixture copying rules.
6. Define failure taxonomy and suite scoring.
7. Add a minimal example eval project.

## Recommended v0 Architecture Additions

Add these modules to the architecture before coding:

```text
Config Loader
Project Resolver
Run Sandbox
Metadata Collector
Schema Validator
Failure Classifier
```

These are small but important boundaries. They keep the implementation practical without turning v0 into a platform.

