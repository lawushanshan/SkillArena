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
      lines.push("");

      for (const check of testCase.checks) {
        lines.push(`- ${check.status}: ${check.name} - ${check.message}`);
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

