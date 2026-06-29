import type { CodexExecResult } from "../../adapters/codex/codex-adapter.js";
import type { RunMetadata } from "../metadata/metadata.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { PreparedWorkspace } from "../workspace/prepare-workspaces.js";
import type { ReportCase, ReportCheck, ReportSuite, SkillArenaReport } from "./report-schema.js";

export interface CaseExecutionResult {
  suiteName: string;
  caseId: string;
  codex: CodexExecResult;
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
  warnings: string[];
}

export function createRunReport(input: CreateRunReportInput): SkillArenaReport {
  const workspaceByCase = new Map(
    input.workspaces.map((workspace) => [
      createCaseKey(workspace.suiteName, workspace.caseId),
      workspace
    ])
  );
  const executionByCase = new Map(
    input.executions.map((execution) => [
      createCaseKey(execution.suiteName, execution.caseId),
      execution
    ])
  );

  const suites: ReportSuite[] = input.suites.map((loadedSuite) => {
    const cases = loadedSuite.selectedCases.map((testCase): ReportCase => {
      const key = createCaseKey(loadedSuite.suite.name, testCase.id);
      const workspace = workspaceByCase.get(key);
      const execution = executionByCase.get(key);
      const checks = createExecutionChecks(execution);
      const failed = checks.some((check) => check.status === "fail");

      return {
        id: testCase.id,
        prompt: testCase.prompt,
        status: failed ? "fail" : "pass",
        workspace: workspace
          ? {
              path: workspace.path,
              fixture: workspace.fixture
            }
          : undefined,
        checks
      };
    });
    const suiteFailed = cases.some((testCase) => testCase.status === "fail");

    return {
      name: loadedSuite.suite.name,
      path: loadedSuite.path,
      status: suiteFailed ? "fail" : "pass",
      cases
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
      durationMs: input.finishedAt.getTime() - input.startedAt.getTime()
    },
    metadata: input.metadata,
    summary: {
      suites: suites.length,
      cases: allCases.length,
      passed,
      failed,
      blocked,
      warnings: input.warnings.length
    },
    suites,
    warnings: input.warnings
  };
}

function createExecutionChecks(execution: CaseExecutionResult | undefined): ReportCheck[] {
  if (!execution) {
    return [
      {
        name: "codex-exec",
        status: "fail",
        message: "Codex execution did not run.",
        category: "adapter_error"
      }
    ];
  }

  const checks: ReportCheck[] = [
    {
      name: "codex-exec",
      status:
        execution.codex.exitCode === 0 && !execution.codex.timedOut && !execution.codex.error
          ? "pass"
          : "fail",
      message: execution.codex.error
        ? `error=${execution.codex.error}`
        : `exitCode=${execution.codex.exitCode ?? "null"}, timedOut=${execution.codex.timedOut}`,
      category:
        execution.codex.exitCode === 0 && !execution.codex.timedOut && !execution.codex.error
          ? undefined
          : execution.codex.timedOut
            ? "timeout"
            : "adapter_error"
    },
    {
      name: "raw-trace",
      status: execution.codex.stdoutBytes > 0 ? "pass" : "warn",
      message: `Raw JSONL bytes: ${execution.codex.stdoutBytes}`
    }
  ];

  if (execution.codex.stderrBytes > 0) {
    checks.push({
      name: "stderr",
      status: "warn",
      message: `stderr bytes: ${execution.codex.stderrBytes}`
    });
  }

  return checks;
}

function createCaseKey(suiteName: string, caseId: string): string {
  return `${suiteName}\0${caseId}`;
}
