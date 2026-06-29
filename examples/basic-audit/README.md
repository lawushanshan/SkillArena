# Basic Audit Example

This example shows the relationship between an eval file and a fixture.

Run from this directory:

```powershell
skillarena run --dry-run
```

The eval describes a task that should create `audit-report.md`, change `README.md`, and leave `package.json` unchanged.

The fixture provides the starting workspace copied for each case.

Real Codex execution may pass or fail depending on the available skills and model behavior. Dry-run mode validates the project shape without invoking Codex.

