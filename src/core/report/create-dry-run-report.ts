import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { RunMetadata } from "../metadata/metadata.js";
import type { SkillArenaReport, ReportCase, ReportSuite } from "./report-schema.js";
import type { PreparedWorkspace } from "../workspace/prepare-workspaces.js";
import type { CapabilityBlock } from "./create-run-report.js";

export interface CreateDryRunReportInput {
  runId: string;
  runDir: string;
  startedAt: Date;
  finishedAt: Date;
  metadata: RunMetadata;
  suites: LoadedEvalSuite[];
  workspaces: PreparedWorkspace[];
  capabilityBlocks: CapabilityBlock[];
  keepWorkspace: boolean;
  warnings: string[];
}

export function createDryRunReport(input: CreateDryRunReportInput): SkillArenaReport {
  const workspaceByCase = new Map(
    input.workspaces.map((workspace) => [
      createWorkspaceKey(workspace.suiteName, workspace.caseId),
      workspace
    ])
  );
  const capabilityBlockByCase = new Map(
    input.capabilityBlocks.map((block) => [createWorkspaceKey(block.suiteName, block.caseId), block])
  );

  const suites: ReportSuite[] = input.suites.map((loadedSuite) => {
    const cases: ReportCase[] = loadedSuite.selectedCases.map((testCase) => {
      const workspace = workspaceByCase.get(createWorkspaceKey(loadedSuite.suite.name, testCase.id));
      const capabilityBlock = capabilityBlockByCase.get(
        createWorkspaceKey(loadedSuite.suite.name, testCase.id)
      );

      if (capabilityBlock) {
        return {
          id: testCase.id,
          prompt: testCase.prompt,
          status: "blocked",
          checks: [
            {
              name: "adapter-capabilities",
              status: "unsupported",
              message: `Missing adapter capabilities: ${capabilityBlock.missingCapabilities.join(", ")}`
            }
          ]
        };
      }

      return {
        id: testCase.id,
        prompt: testCase.prompt,
        status: "pass",
        workspace: workspace
          ? {
              path: workspace.path,
              preserved: input.keepWorkspace,
              fixture: workspace.fixture,
              skill: workspace.skill
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
          },
          ...(workspace?.skill
            ? [
                {
                  name: "skill",
                  status: "pass" as const,
                  message: `Skill provisioned: ${workspace.skill.name}`
                }
              ]
            : []),
          ...(testCase.expect.judge
            ? [
                {
                  name: "expect.judge",
                  status: "warn" as const,
                  message: "Rubric judge configuration is valid; dry-run does not invoke OpenAI."
                }
              ]
            : [])
        ]
      };
    });

    const suiteBlocked = cases.some((testCase) => testCase.status === "blocked");

    return {
      name: loadedSuite.suite.name,
      path: loadedSuite.path,
      status: suiteBlocked ? "blocked" : "pass",
      cases
    };
  });

  const allCases = suites.flatMap((suite) => suite.cases);
  const totalCases = allCases.length;
  const blocked = allCases.filter((testCase) => testCase.status === "blocked").length;

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
      passed: totalCases - blocked,
      failed: 0,
      blocked,
      warnings: input.warnings.length
    },
    suites,
    warnings: input.warnings
  };
}

function createWorkspaceKey(suiteName: string, caseId: string): string {
  return `${suiteName}\0${caseId}`;
}
