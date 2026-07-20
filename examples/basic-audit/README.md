# Basic Audit Example

This example contains three independent suites that show the relationship between an eval file,
a fixture, and a local Skill: security auditing, configuration hardening, and release notes.

Run from this directory:

```powershell
skillarena run --dry-run
```

Each eval describes a task with observable artifacts. The suites create either an audit report,
configuration notes, or release notes; all preserve `package.json`.

The fixture provides the starting workspace copied for each case.

The suite's local Skill is copied into each case workspace before Codex runs.

Real Codex execution may pass or fail depending on the available skills and model behavior. Dry-run mode validates the project shape without invoking Codex.
