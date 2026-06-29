import { runCodexExec } from "../../adapters/codex/codex-adapter.js";
import { collectRunMetadata } from "../metadata/metadata.js";
import { createRunReport, type CaseExecutionResult } from "../report/create-run-report.js";
import type { SkillArenaReport } from "../report/report-schema.js";
import { writeReport } from "../report/write-report.js";
import { parseCodexJsonlTrace } from "../trace/codex-jsonl-parser.js";
import { writeParsedTrace } from "../trace/write-parsed-trace.js";
import { prepareWorkspaces, type PreparedWorkspace } from "../workspace/prepare-workspaces.js";
import { diffWorkspaceSnapshots, snapshotWorkspace } from "../workspace/workspace-snapshot.js";
import { createParsedTracePath, createRawTracePath, createStderrPath } from "./case-artifacts.js";
import { createRunPlan, type LoadedEvalSuite } from "./run-plan.js";
import { createRunStore, type RunStore } from "./run-store.js";

export interface RunEvalsOptions {
  cwd: string;
  evalFile?: string;
  caseId?: string;
  command?: string[];
  skillarenaVersion: string;
  timeoutMs: number;
  codexCommand?: string;
  codexCommandArgs?: string[];
}

export interface RunEvalsResult {
  runStore: RunStore;
  report: SkillArenaReport;
  workspaces: PreparedWorkspace[];
  suites: LoadedEvalSuite[];
  executions: CaseExecutionResult[];
  totalCases: number;
  warnings: string[];
}

export async function runEvals(options: RunEvalsOptions): Promise<RunEvalsResult> {
  const startedAt = new Date();
  const { project, suites, totalCases, warnings } = await createRunPlan(options);
  const runStore = await createRunStore(project);
  const workspaces = await prepareWorkspaces(project, runStore, suites);
  const metadata = await collectRunMetadata({
    project,
    suites,
    startedAt,
    command: options.command ?? [],
    skillarenaVersion: options.skillarenaVersion
  });
  const executions: CaseExecutionResult[] = [];

  for (const loadedSuite of suites) {
    for (const testCase of loadedSuite.selectedCases) {
      const workspace = workspaces.find(
        (candidate) =>
          candidate.suiteName === loadedSuite.suite.name && candidate.caseId === testCase.id
      );

      if (!workspace) {
        continue;
      }

      const beforeSnapshot = await snapshotWorkspace(workspace.path);
      const codex = await runCodexExec({
        prompt: testCase.prompt,
        cwd: workspace.path,
        rawOutputPath: createRawTracePath(runStore, loadedSuite.suite.name, testCase.id),
        stderrPath: createStderrPath(runStore, loadedSuite.suite.name, testCase.id),
        timeoutMs: options.timeoutMs,
        codexCommand: options.codexCommand,
        codexCommandArgs: options.codexCommandArgs
      });
      const afterSnapshot = await snapshotWorkspace(workspace.path);
      const workspaceDiff = diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot);
      const parsedTrace = await parseCodexJsonlTrace(codex.rawOutputPath);
      const parsedTracePath = createParsedTracePath(runStore, loadedSuite.suite.name, testCase.id);
      await writeParsedTrace(parsedTracePath, parsedTrace);

      executions.push({
        suiteName: loadedSuite.suite.name,
        caseId: testCase.id,
        codex,
        parsedTracePath,
        parsedTrace,
        workspaceDiff
      });
    }
  }

  const finishedAt = new Date();
  const report = createRunReport({
    runId: runStore.runId,
    runDir: runStore.runDir,
    startedAt,
    finishedAt,
    metadata,
    suites,
    workspaces,
    executions,
    warnings
  });

  await writeReport(runStore, report);

  return {
    runStore,
    report,
    workspaces,
    suites,
    executions,
    totalCases,
    warnings
  };
}
