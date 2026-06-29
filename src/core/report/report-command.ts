import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { SkillArenaError } from "../errors.js";
import { loadProject } from "../project/project.js";
import { loadReport } from "./load-report.js";
import { renderMarkdownReport } from "./render-markdown-report.js";
import type { SkillArenaReport } from "./report-schema.js";

export interface ReportCommandOptions {
  cwd: string;
  runDir?: string;
  writeMarkdown?: boolean;
}

export interface ReportCommandResult {
  report: SkillArenaReport;
  runDir: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  markdownWritten: boolean;
}

export async function runReportCommand(options: ReportCommandOptions): Promise<ReportCommandResult> {
  const runDir = options.runDir
    ? resolve(options.cwd, options.runDir)
    : await findLatestRunDir(options.cwd);
  const reportJsonPath = resolve(runDir, "report.json");
  const reportMarkdownPath = resolve(runDir, "report.md");

  if (!existsSync(reportJsonPath)) {
    throw new SkillArenaError(`report.json does not exist: ${reportJsonPath}`);
  }

  const report = await loadReport(reportJsonPath);
  const shouldWriteMarkdown = options.writeMarkdown ?? true;

  if (shouldWriteMarkdown) {
    await writeFile(reportMarkdownPath, renderMarkdownReport(report), "utf8");
  }

  return {
    report,
    runDir,
    reportJsonPath,
    reportMarkdownPath,
    markdownWritten: shouldWriteMarkdown
  };
}

export function renderConsoleReportSummary(result: ReportCommandResult): string {
  const report = result.report;
  return [
    "SkillArena report",
    `Mode: ${report.mode}`,
    `Run: ${report.run.id}`,
    `Suites: ${report.summary.suites}`,
    `Cases: ${report.summary.cases}`,
    `Passed: ${report.summary.passed}`,
    `Failed: ${report.summary.failed}`,
    `Blocked: ${report.summary.blocked}`,
    `Warnings: ${report.summary.warnings}`,
    `Report: ${result.reportMarkdownPath}`
  ].join("\n");
}

async function findLatestRunDir(cwd: string): Promise<string> {
  const project = await loadProject(cwd);

  if (!existsSync(project.runsDir)) {
    throw new SkillArenaError(`Run directory does not exist: ${project.runsDir}`);
  }

  const entries = await readdir(project.runsDir, { withFileTypes: true });
  const runDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(project.runsDir, entry.name))
    .sort()
    .reverse();

  if (runDirs.length === 0) {
    throw new SkillArenaError(`No SkillArena runs found in ${project.runsDir}`);
  }

  return runDirs[0]!;
}

