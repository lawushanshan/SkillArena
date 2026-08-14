import type { AdapterCapability } from "../../adapters/adapter-capabilities.js";
import type { AgentExecResult } from "../../adapters/agent-adapter.js";
import { gradeDeterministicExpectations } from "../grader/deterministic-grader.js";
import { gradeRubricJudge } from "../judge/grade-rubric-judge.js";
import type { RubricJudgeInput, RubricJudgeResult } from "../judge/rubric-judge.js";
import type { RunMetadata } from "../metadata/metadata.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { ParsedTrace } from "../trace/normalized-events.js";
import type { PreparedWorkspace } from "../workspace/prepare-workspaces.js";
import type { WorkspaceDiff } from "../workspace/workspace-snapshot.js";
import { createFailureTraceSummary } from "./create-failure-trace-summary.js";
import type { ReportCase, ReportCheck, ReportSuite, SkillArenaReport } from "./report-schema.js";

export interface CaseExecutionResult {
  suiteName: string;
  caseId: string;
  agent: AgentExecResult;
  parsedTracePath?: string;
  parsedTrace?: ParsedTrace;
  workspaceDiff?: WorkspaceDiff;
  judge?: {
    input: RubricJudgeInput;
    result: RubricJudgeResult;
  };
}

export interface CreateRunReportInput {
  runId: string;
  runDir: string;
  startedAt: Date;
  finishedAt: Date;
  metadata: RunMetadata;
  suites: LoadedEvalSuite[];
  workspaces: PreparedWorkspace[];
  executions: CaseExecutionResult[];
  capabilityBlocks: CapabilityBlock[];
  keepWorkspace: boolean;
  warnings: string[];
}

export interface CapabilityBlock {
  suiteName: string;
  caseId: string;
  missingCapabilities: AdapterCapability[];
}

export function createRunReport(input: CreateRunReportInput): SkillArenaReport {
  const workspaceByCase = new Map(
    input.workspaces.map((workspace) => [
      createCaseKey(workspace.suiteName, workspace.caseId),
      workspace,
    ]),
  );
  const executionByCase = new Map(
    input.executions.map((execution) => [
      createCaseKey(execution.suiteName, execution.caseId),
      execution,
    ]),
  );
  const capabilityBlockByCase = new Map(
    input.capabilityBlocks.map((block) => [createCaseKey(block.suiteName, block.caseId), block]),
  );

  const suites: ReportSuite[] = input.suites.map((loadedSuite) => {
    const cases = loadedSuite.selectedCases.map((testCase): ReportCase => {
      const key = createCaseKey(loadedSuite.suite.name, testCase.id);
      const workspace = workspaceByCase.get(key);
      const execution = executionByCase.get(key);
      const capabilityBlock = capabilityBlockByCase.get(key);
      if (capabilityBlock) {
        return {
          id: testCase.id,
          prompt: testCase.prompt,
          status: "blocked",
          checks: [
            {
              name: "adapter-capabilities",
              status: "unsupported",
              message: `Missing adapter capabilities: ${capabilityBlock.missingCapabilities.join(", ")}`,
            },
          ],
        };
      }
      const checks = [
        ...createExecutionChecks(execution),
        ...(execution
          ? gradeDeterministicExpectations({
              testCase,
              agent: execution.agent,
              parsedTrace: execution.parsedTrace,
              workspaceDiff: execution.workspaceDiff,
              workspacePath: workspace?.path,
              snapshotsDir: workspace?.snapshotsDir,
            })
          : []),
        ...(testCase.expect.judge
          ? gradeRubricJudge(testCase.expect.judge, execution?.judge?.result)
          : []),
      ];
      const failed = checks.some((check) => check.status === "fail");

      return {
        id: testCase.id,
        prompt: testCase.prompt,
        status: failed ? "fail" : "pass",
        workspace: workspace
          ? {
              path: workspace.path,
              preserved: input.keepWorkspace,
              fixture: workspace.fixture,
              skill: workspace.skill,
            }
          : undefined,
        artifacts: execution
          ? {
              rawTrace: execution.agent.rawOutputPath,
              stderr: execution.agent.stderrPath,
              parsedTrace: execution.parsedTracePath,
            }
          : undefined,
        judge:
          execution?.judge && testCase.expect.judge
            ? createJudgeReport(testCase.expect.judge.min_score, execution.judge)
            : undefined,
        failureTraceSummary: failed
          ? createFailureTraceSummary(checks, execution?.parsedTrace)
          : undefined,
        checks,
      };
    });
    const suiteBlocked = cases.some((testCase) => testCase.status === "blocked");
    const suiteFailed = cases.some((testCase) => testCase.status === "fail");

    return {
      name: loadedSuite.suite.name,
      path: loadedSuite.path,
      status: suiteBlocked ? "blocked" : suiteFailed ? "fail" : "pass",
      cases,
    };
  });

  const allCases = suites.flatMap((suite) => suite.cases);
  const passed = allCases.filter((testCase) => testCase.status === "pass").length;
  const failed = allCases.filter((testCase) => testCase.status === "fail").length;
  const blocked = allCases.filter((testCase) => testCase.status === "blocked").length;

  return {
    schemaVersion: "0.1",
    tool: "skillarena",
    mode: "run",
    run: {
      id: input.runId,
      dir: input.runDir,
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.finishedAt.toISOString(),
      durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    },
    metadata: input.metadata,
    summary: {
      suites: suites.length,
      cases: allCases.length,
      passed,
      failed,
      blocked,
      warnings: input.warnings.length,
    },
    suites,
    warnings: input.warnings,
  };
}

function createJudgeReport(
  minimumScore: number,
  judge: NonNullable<CaseExecutionResult["judge"]>,
): NonNullable<ReportCase["judge"]> {
  const artifacts = judge.input.artifacts.map(({ path, characters, truncated, available }) => ({
    path,
    characters,
    truncated,
    available,
  }));

  if (judge.result.status === "error") {
    return {
      status: "error",
      model: judge.result.model,
      promptVersion: judge.result.promptVersion,
      minimumScore,
      artifacts,
      error: judge.result.message,
    };
  }

  return {
    status: "completed",
    model: judge.result.model,
    promptVersion: judge.result.promptVersion,
    minimumScore,
    score: judge.result.score,
    summary: judge.result.summary,
    criteria: judge.result.criteria,
    artifacts,
  };
}

function createExecutionChecks(execution: CaseExecutionResult | undefined): ReportCheck[] {
  if (!execution) {
    return [
      {
        name: "agent-exec",
        status: "fail",
        message: "Agent execution did not run.",
        category: "adapter_error",
      },
    ];
  }

  const checks: ReportCheck[] = [
    {
      name: "agent-exec",
      status:
        execution.agent.exitCode === 0 && !execution.agent.timedOut && !execution.agent.error
          ? "pass"
          : "fail",
      message: execution.agent.error
        ? `error=${execution.agent.error}`
        : `exitCode=${execution.agent.exitCode ?? "null"}, timedOut=${execution.agent.timedOut}`,
      category:
        execution.agent.exitCode === 0 && !execution.agent.timedOut && !execution.agent.error
          ? undefined
          : execution.agent.timedOut
            ? "timeout"
            : "adapter_error",
    },
    {
      name: "raw-trace",
      status: execution.agent.stdoutBytes > 0 ? "pass" : "warn",
      message: `Raw JSONL bytes: ${execution.agent.stdoutBytes}`,
    },
    {
      name: "parsed-trace",
      status:
        execution.parsedTrace && execution.parsedTrace.stats.parseErrors === 0 ? "pass" : "warn",
      message: execution.parsedTrace
        ? `events=${execution.parsedTrace.stats.normalizedEvents}, parseErrors=${execution.parsedTrace.stats.parseErrors}`
        : "Parsed trace is not available.",
    },
  ];

  if (execution.agent.stderrBytes > 0) {
    checks.push({
      name: "stderr",
      status: "warn",
      message: `stderr bytes: ${execution.agent.stderrBytes}`,
    });
  }

  return checks;
}

function createCaseKey(suiteName: string, caseId: string): string {
  return `${suiteName}\0${caseId}`;
}
