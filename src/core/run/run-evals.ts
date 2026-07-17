import { runCodexExec } from "../../adapters/codex/codex-adapter.js";
import { gradeDeterministicExpectations } from "../grader/deterministic-grader.js";
import { collectRunMetadata } from "../metadata/metadata.js";
import { createRunReport, type CaseExecutionResult } from "../report/create-run-report.js";
import type { SkillArenaReport } from "../report/report-schema.js";
import type { EvalCase } from "../eval/eval-schema.js";
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
  suiteName?: string;
  caseId?: string;
  maxCases?: number;
  command?: string[];
  skillarenaVersion: string;
  timeoutMs: number;
  failFast?: boolean;
  codexCommand?: string;
  codexCommandArgs?: string[];
  detectCodexVersion?: boolean;
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
  const executedSuites: LoadedEvalSuite[] = [];
  const executions: CaseExecutionResult[] = [];
  let shouldStop = false;

  for (const loadedSuite of suites) {
    if (shouldStop) {
      break;
    }

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

      const execution = {
        suiteName: loadedSuite.suite.name,
        caseId: testCase.id,
        codex,
        parsedTracePath,
        parsedTrace,
        workspaceDiff
      };

      executions.push(execution);
      addExecutedCase(executedSuites, loadedSuite, testCase);

      if (options.failFast && caseExecutionFailed(testCase, execution, workspace)) {
        warnings.push(`Stopped after failed case because --fail-fast is enabled: ${testCase.id}`);
        shouldStop = true;
        break;
      }
    }
  }

  const finishedAt = new Date();
  const reportSuites = options.failFast ? executedSuites : suites;
  const metadata = await collectRunMetadata({
    project,
    suites: reportSuites,
    startedAt,
    command: options.command ?? [],
    skillarenaVersion: options.skillarenaVersion,
    detectCodexVersion: options.detectCodexVersion
  });
  const report = createRunReport({
    runId: runStore.runId,
    runDir: runStore.runDir,
    startedAt,
    finishedAt,
    metadata,
    suites: reportSuites,
    workspaces,
    executions,
    warnings
  });

  await writeReport(runStore, report);

  return {
    runStore,
    report,
    workspaces,
    suites: reportSuites,
    executions,
    totalCases: report.summary.cases,
    warnings
  };
}

function addExecutedCase(
  executedSuites: LoadedEvalSuite[],
  loadedSuite: LoadedEvalSuite,
  testCase: EvalCase
): void {
  let executedSuite = executedSuites.find((candidate) => candidate.path === loadedSuite.path);

  if (!executedSuite) {
    executedSuite = {
      ...loadedSuite,
      selectedCases: [],
      selectedCaseCount: 0
    };
    executedSuites.push(executedSuite);
  }

  executedSuite.selectedCases.push(testCase);
  executedSuite.selectedCaseCount = executedSuite.selectedCases.length;
}

function caseExecutionFailed(
  testCase: EvalCase,
  execution: CaseExecutionResult,
  workspace: PreparedWorkspace
): boolean {
  const adapterFailed =
    execution.codex.exitCode !== 0 || execution.codex.timedOut || Boolean(execution.codex.error);

  if (adapterFailed) {
    return true;
  }

  return gradeDeterministicExpectations({
    testCase,
    codex: execution.codex,
    parsedTrace: execution.parsedTrace,
    workspaceDiff: execution.workspaceDiff,
    workspacePath: workspace.path,
    snapshotsDir: workspace.snapshotsDir
  }).some((check) => check.status === "fail");
}
