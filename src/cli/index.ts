#!/usr/bin/env node

import { Command } from "commander";

import { renderCompareSummary, runCompareCommand } from "../core/compare/compare-runs.js";
import { formatUnknownError } from "../core/errors.js";
import { initProject } from "../core/init/init-project.js";
import { renderConsoleReportSummary, runReportCommand } from "../core/report/report-command.js";
import type { SkillArenaReport } from "../core/report/report-schema.js";
import { runDryRun } from "../core/run/dry-run.js";
import { runEvals } from "../core/run/run-evals.js";

const VERSION = "0.0.0";
const program = new Command();

program
  .name("skillarena")
  .description("Evaluate Codex skills with repeatable local eval suites.")
  .version(VERSION);

program
  .command("init")
  .description("Initialize SkillArena eval files in the current project.")
  .action(async () => {
    try {
      const result = await initProject(process.cwd());

      console.log("SkillArena initialized.");

      if (result.created.length > 0) {
        console.log("\nCreated:");
        for (const path of result.created) {
          console.log(`  ${path}`);
        }
      }

      if (result.skipped.length > 0) {
        console.log("\nSkipped existing files:");
        for (const path of result.skipped) {
          console.log(`  ${path}`);
        }
      }
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exitCode = 1;
    }
  });

program
  .command("run")
  .description("Run SkillArena evals.")
  .argument("[evalFile]", "Eval YAML file to run")
  .option("--suite <suiteName>", "Run a single eval suite by name")
  .option("--case <caseId>", "Run a single eval case")
  .option("--max-cases <count>", "Limit the number of selected eval cases to run")
  .option("--fail-fast", "Stop after the first failed eval case.")
  .option("--dry-run", "Load and validate evals without invoking Codex.")
  .option("--timeout-ms <ms>", "Per-case Codex execution timeout in milliseconds", "300000")
  .option("--codex-command <command>", "Codex command to execute", "codex")
  .action(async (
    evalFile: string | undefined,
    options: {
      suite?: string;
      case?: string;
      maxCases?: string;
      failFast?: boolean;
      dryRun?: boolean;
      timeoutMs: string;
      codexCommand: string;
    }
  ) => {
    try {
      const timeoutMs = parsePositiveInteger(options.timeoutMs, "--timeout-ms");
      const maxCases =
        options.maxCases === undefined
          ? undefined
          : parsePositiveInteger(options.maxCases, "--max-cases");

      const result = options.dryRun
        ? await runDryRun({
            cwd: process.cwd(),
            evalFile,
            suiteName: options.suite,
            caseId: options.case,
            maxCases,
            command: process.argv.slice(2),
            skillarenaVersion: VERSION
          })
        : await runEvals({
            cwd: process.cwd(),
            evalFile,
            suiteName: options.suite,
            caseId: options.case,
            maxCases,
            command: process.argv.slice(2),
            skillarenaVersion: VERSION,
            timeoutMs,
            failFast: options.failFast,
            codexCommand: options.codexCommand
          });

      console.log(options.dryRun ? "SkillArena dry run" : "SkillArena run");
      console.log(`Suites: ${result.suites.length}`);
      console.log(`Cases: ${result.totalCases}`);
      console.log(`Run: ${result.runStore.runDir}`);

      for (const suite of result.report.suites) {
        console.log(`\n${formatStatus(suite.status)} ${suite.name}`);
        console.log(`  File: ${suite.path}`);
        console.log(`  Cases: ${suite.cases.length}`);
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }

      console.log(`\nReport: ${result.runStore.reportMarkdownPath}`);
      process.exitCode = result.report.summary.failed > 0 || result.report.summary.blocked > 0 ? 1 : 0;
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exitCode = 1;
    }
  });

program
  .command("report")
  .description("Render or inspect a SkillArena run report.")
  .argument("[runDir]", "Run directory under .skillarena/runs")
  .option("--no-write-markdown", "Do not rewrite report.md from report.json")
  .action(async (runDir: string | undefined, options: { writeMarkdown?: boolean }) => {
    try {
      const result = await runReportCommand({
        cwd: process.cwd(),
        runDir,
        writeMarkdown: options.writeMarkdown
      });

      console.log(renderConsoleReportSummary(result));
      process.exitCode =
        result.report.summary.failed > 0 || result.report.summary.blocked > 0 ? 1 : 0;
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exitCode = 1;
    }
  });

program
  .command("compare")
  .description("Compare two SkillArena run reports.")
  .argument("[baselineRunDir]", "Baseline run directory or run id")
  .argument("[candidateRunDir]", "Candidate run directory or run id")
  .option("--json", "Print the comparison as JSON.")
  .option("--fail-on-regression", "Exit with code 1 when the candidate has regressions.")
  .action(async (
    baselineRunDir: string | undefined,
    candidateRunDir: string | undefined,
    options: { json?: boolean; failOnRegression?: boolean }
  ) => {
    try {
      const result = await runCompareCommand({
        cwd: process.cwd(),
        baselineRunDir,
        candidateRunDir
      });

      console.log(options.json ? JSON.stringify(result, null, 2) : renderCompareSummary(result));

      if (options.failOnRegression && result.hasRegression) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exitCode = 1;
    }
  });

program.parse();

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function formatStatus(status: SkillArenaReport["suites"][number]["status"]): string {
  return status.toUpperCase();
}
