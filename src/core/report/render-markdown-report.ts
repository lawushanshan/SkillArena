import type { SkillArenaReport } from "./report-schema.js";

export function renderMarkdownReport(report: SkillArenaReport): string {
  const lines: string[] = [];

  lines.push("# SkillArena Report");
  lines.push("");
  lines.push(`Mode: ${report.mode}`);
  lines.push(`Run: ${report.run.id}`);
  lines.push(`Started: ${report.run.startedAt}`);
  lines.push(`Duration: ${report.run.durationMs}ms`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Suites: ${report.summary.suites}`);
  lines.push(`- Cases: ${report.summary.cases}`);
  lines.push(`- Passed: ${report.summary.passed}`);
  lines.push(`- Failed: ${report.summary.failed}`);
  lines.push(`- Blocked: ${report.summary.blocked}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push("");

  if (report.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");

    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }

    lines.push("");
  }

  lines.push("## Suites");
  lines.push("");

  for (const suite of report.suites) {
    lines.push(`### ${suite.name}`);
    lines.push("");
    lines.push(`- Status: ${suite.status}`);
    lines.push(`- File: ${suite.path}`);
    lines.push("");

    for (const testCase of suite.cases) {
      lines.push(`#### ${testCase.id}`);
      lines.push("");
      lines.push(`- Status: ${testCase.status}`);
      if (testCase.workspace) {
        lines.push(`- Workspace: ${testCase.workspace.path}`);
        if (testCase.workspace.skill) {
          lines.push(`- Skill: ${testCase.workspace.skill.name}`);
          lines.push(`- Skill source: ${testCase.workspace.skill.sourcePath}`);
        }
      }
      if (testCase.artifacts) {
        if (testCase.artifacts.rawTrace) {
          lines.push(`- Raw trace: ${testCase.artifacts.rawTrace}`);
        }
        if (testCase.artifacts.parsedTrace) {
          lines.push(`- Parsed trace: ${testCase.artifacts.parsedTrace}`);
        }
        if (testCase.artifacts.stderr) {
          lines.push(`- Stderr: ${testCase.artifacts.stderr}`);
        }
      }
      lines.push("");

      for (const check of testCase.checks) {
        lines.push(`- ${check.status}: ${check.name} - ${check.message}`);
      }

      if (testCase.failureTraceSummary) {
        lines.push("");
        lines.push("##### Failure Trace Summary");
        lines.push("");
        lines.push(`- Category: ${testCase.failureTraceSummary.category ?? "unknown"}`);
        lines.push(
          `- Skills read: ${testCase.failureTraceSummary.skillsRead.join(", ") || "none"}`
        );
        lines.push(`- Failed commands: ${testCase.failureTraceSummary.failedCommands.length}`);

        for (const command of testCase.failureTraceSummary.failedCommands) {
          lines.push(`  - exitCode=${command.exitCode ?? "unknown"}: ${command.command}`);
        }

        lines.push(`- Run errors: ${testCase.failureTraceSummary.runErrors.length}`);
        for (const error of testCase.failureTraceSummary.runErrors) {
          lines.push(`  - ${error}`);
        }

        lines.push(`- Trace parse errors: ${testCase.failureTraceSummary.parseErrors.length}`);
        for (const error of testCase.failureTraceSummary.parseErrors) {
          lines.push(`  - line ${error.line}: ${error.message}`);
        }
      }

      lines.push("");
    }
  }

  lines.push("## Metadata");
  lines.push("");
  lines.push(`- SkillArena: ${report.metadata.skillarenaVersion}`);
  lines.push(`- Node: ${report.metadata.nodeVersion}`);
  lines.push(`- Platform: ${report.metadata.platform}/${report.metadata.arch}`);
  lines.push(`- Codex: ${report.metadata.codexVersion ?? "not detected"}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}
