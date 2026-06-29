import type { LoadedEvalSuite } from "../run/dry-run.js";
import type { RunMetadata } from "../metadata/metadata.js";
import type { SkillArenaReport, ReportCase, ReportSuite } from "./report-schema.js";
import type { PreparedWorkspace } from "../workspace/prepare-workspaces.js";

export interface CreateDryRunReportInput {
  runId: string;
  runDir: string;
  startedAt: Date;
  finishedAt: Date;
  metadata: RunMetadata;
  suites: LoadedEvalSuite[];
  workspaces: PreparedWorkspace[];
  warnings: string[];
}

export function createDryRunReport(input: CreateDryRunReportInput): SkillArenaReport {
  const workspaceByCase = new Map(
    input.workspaces.map((workspace) => [
      createWorkspaceKey(workspace.suiteName, workspace.caseId),
      workspace
    ])
  );

  const suites: ReportSuite[] = input.suites.map((loadedSuite) => {
    const cases: ReportCase[] = loadedSuite.selectedCases.map((testCase) => {
      const workspace = workspaceByCase.get(createWorkspaceKey(loadedSuite.suite.name, testCase.id));

      return {
        id: testCase.id,
        prompt: testCase.prompt,
        status: "pass",
        workspace: workspace
          ? {
              path: workspace.path,
              fixture: workspace.fixture
            }
          : undefined,
        checks: [
          {
            name: "schema",
            status: "pass",
            message: "Eval case schema is valid."
          },
          {
            name: "workspace",
            status: workspace ? "pass" : "fail",
            message: workspace
              ? `Workspace prepared: ${workspace.path}`
              : "Workspace was not prepared.",
            category: workspace ? undefined : "setup_error"
          },
          {
            name: "fixture",
            status: "pass",
            message: testCase.workspace.fixture
              ? `Fixture copied: ${testCase.workspace.fixture}`
              : "No fixture required."
          }
        ]
      };
    });

    return {
      name: loadedSuite.suite.name,
      path: loadedSuite.path,
      status: "pass",
      cases
    };
  });

  const totalCases = suites.reduce((sum, suite) => sum + suite.cases.length, 0);

  return {
    schemaVersion: "0.1",
    tool: "skillarena",
    mode: "dry-run",
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
      cases: totalCases,
      passed: totalCases,
      failed: 0,
      blocked: 0,
      warnings: input.warnings.length
    },
    suites,
    warnings: input.warnings
  };
}

function createWorkspaceKey(suiteName: string, caseId: string): string {
  return `${suiteName}\0${caseId}`;
}
