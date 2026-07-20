import {
  CODEX_ADAPTER_CAPABILITIES,
  missingCapabilities,
  type AdapterCapability
} from "../../adapters/adapter-capabilities.js";
import { runCodexExec } from "../../adapters/codex/codex-adapter.js";
import { gradeDeterministicExpectations } from "../grader/deterministic-grader.js";
import { gradeRubricJudge } from "../judge/grade-rubric-judge.js";
import {
  createRubricJudgeInput,
  OpenAiRubricJudge,
  type RubricJudge,
  type RubricJudgeResult
} from "../judge/rubric-judge.js";
import { collectRunMetadata } from "../metadata/metadata.js";
import {
  createRunReport,
  type CapabilityBlock,
  type CaseExecutionResult
} from "../report/create-run-report.js";
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
import { removeWorkspaces } from "./workspace-retention.js";

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
  keepWorkspace?: boolean;
  adapterCapabilities?: ReadonlySet<AdapterCapability>;
  rubricJudge?: RubricJudge;
  judgeModel?: string;
  judgeTimeoutMs?: number;
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
  const rubricJudge = hasJudgeExpectations(suites)
    ? options.rubricJudge ??
      new OpenAiRubricJudge({
        apiKey: process.env.OPENAI_API_KEY,
        model: options.judgeModel ?? process.env.SKILLARENA_JUDGE_MODEL,
        timeoutMs: options.judgeTimeoutMs ?? 60_000
      })
    : undefined;
  const capabilityBlocks = collectCapabilityBlocks(
    suites,
    options.adapterCapabilities ?? CODEX_ADAPTER_CAPABILITIES
  );
  const blockedCaseKeys = new Set(
    capabilityBlocks.map((block) => createCaseKey(block.suiteName, block.caseId))
  );
  const runnableSuites = withoutBlockedCases(suites, blockedCaseKeys);
  const workspaces = await prepareWorkspaces(project, runStore, runnableSuites);
  const executedSuites: LoadedEvalSuite[] = [];
  const executions: CaseExecutionResult[] = [];
  let shouldStop = false;

  for (const loadedSuite of suites) {
    if (shouldStop) {
      break;
    }

    for (const testCase of loadedSuite.selectedCases) {
      const caseKey = createCaseKey(loadedSuite.suite.name, testCase.id);
      if (blockedCaseKeys.has(caseKey)) {
        addExecutedCase(executedSuites, loadedSuite, testCase);
        warnings.push(`Skipped ${testCase.id}: required adapter capability is unavailable.`);

        if (options.failFast) {
          warnings.push(`Stopped after blocked case because --fail-fast is enabled: ${testCase.id}`);
          shouldStop = true;
          break;
        }

        continue;
      }

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
      const judge =
        testCase.expect.judge && codex.exitCode === 0 && !codex.timedOut && !codex.error && rubricJudge
          ? await runRubricJudge(rubricJudge, testCase, workspace, workspaceDiff)
          : undefined;

      const execution = {
        suiteName: loadedSuite.suite.name,
        caseId: testCase.id,
        codex,
        parsedTracePath,
        parsedTrace,
        workspaceDiff,
        judge
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
    capabilityBlocks,
    keepWorkspace: options.keepWorkspace ?? false,
    warnings
  });

  await writeReport(runStore, report);

  if (!options.keepWorkspace) {
    await removeWorkspaces(runStore);
  }

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

function collectCapabilityBlocks(
  suites: LoadedEvalSuite[],
  adapterCapabilities: ReadonlySet<AdapterCapability>
): CapabilityBlock[] {
  return suites.flatMap((loadedSuite) =>
    loadedSuite.selectedCases.flatMap((testCase) => {
      const missing = missingCapabilities(testCase, adapterCapabilities);

      return missing.length === 0
        ? []
        : [
            {
              suiteName: loadedSuite.suite.name,
              caseId: testCase.id,
              missingCapabilities: missing
            }
          ];
    })
  );
}

function withoutBlockedCases(
  suites: LoadedEvalSuite[],
  blockedCaseKeys: ReadonlySet<string>
): LoadedEvalSuite[] {
  return suites.map((loadedSuite) => {
    const selectedCases = loadedSuite.selectedCases.filter(
      (testCase) => !blockedCaseKeys.has(createCaseKey(loadedSuite.suite.name, testCase.id))
    );

    return {
      ...loadedSuite,
      selectedCases,
      selectedCaseCount: selectedCases.length
    };
  });
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

  const deterministicFailed = gradeDeterministicExpectations({
    testCase,
    codex: execution.codex,
    parsedTrace: execution.parsedTrace,
    workspaceDiff: execution.workspaceDiff,
    workspacePath: workspace.path,
    snapshotsDir: workspace.snapshotsDir
  }).some((check) => check.status === "fail");

  return (
    deterministicFailed ||
    (testCase.expect.judge
      ? gradeRubricJudge(testCase.expect.judge, execution.judge?.result).some(
          (check) => check.status === "fail"
        )
      : false)
  );
}

async function runRubricJudge(
  judge: RubricJudge,
  testCase: EvalCase,
  workspace: PreparedWorkspace,
  workspaceDiff: NonNullable<CaseExecutionResult["workspaceDiff"]>
): Promise<NonNullable<CaseExecutionResult["judge"]>> {
  try {
    const input = await createRubricJudgeInput(
      testCase.prompt,
      testCase.expect.judge!,
      workspace.path,
      workspaceDiff
    );
    return { input, result: await judge.judge(input) };
  } catch {
    const result: RubricJudgeResult = {
      status: "error",
      promptVersion: "skillarena-rubric-v1",
      message: "SkillArena could not prepare the rubric judge input."
    };
    return {
      input: {
        promptVersion: "skillarena-rubric-v1",
        prompt: testCase.prompt,
        rubric: testCase.expect.judge!.rubric,
        artifacts: [],
        workspaceDiff
      },
      result
    };
  }
}

function hasJudgeExpectations(suites: LoadedEvalSuite[]): boolean {
  return suites.some((suite) => suite.selectedCases.some((testCase) => Boolean(testCase.expect.judge)));
}

function createCaseKey(suiteName: string, caseId: string): string {
  return `${suiteName}\0${caseId}`;
}
