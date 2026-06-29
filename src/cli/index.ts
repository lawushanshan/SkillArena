#!/usr/bin/env node

import { Command } from "commander";

import { formatUnknownError } from "../core/errors.js";
import { initProject } from "../core/init/init-project.js";
import { runDryRun } from "../core/run/dry-run.js";

const program = new Command();

program
  .name("skillarena")
  .description("Evaluate Codex skills with repeatable local eval suites.")
  .version("0.0.0");

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
  .option("--case <caseId>", "Run a single eval case")
  .option("--dry-run", "Load and validate evals without invoking Codex.")
  .action(async (evalFile: string | undefined, options: { case?: string; dryRun?: boolean }) => {
    if (!options.dryRun) {
      console.error("Real eval execution is not implemented yet. Use --dry-run to validate suites.");
      process.exitCode = 1;
      return;
    }

    try {
      const result = await runDryRun({
        cwd: process.cwd(),
        evalFile,
        caseId: options.case
      });

      console.log("SkillArena dry run");
      console.log(`Project: ${result.project.root}`);
      console.log(`Agent: ${result.project.config.agent}`);
      console.log(`Suites: ${result.suites.length}`);
      console.log(`Cases: ${result.totalCases}`);

      for (const loadedSuite of result.suites) {
        console.log(`\nPASS ${loadedSuite.suite.name}`);
        console.log(`  File: ${loadedSuite.path}`);
        console.log(`  Cases: ${loadedSuite.selectedCaseCount}`);
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        for (const warning of result.warnings) {
          console.log(`  - ${warning}`);
        }
      }
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exitCode = 1;
    }
  });

program
  .command("report")
  .description("Render or inspect a SkillArena run report.")
  .argument("[runDir]", "Run directory under .skillarena/runs")
  .action(() => {
    console.log("skillarena report is not implemented yet.");
    process.exitCode = 1;
  });

program.parse();
