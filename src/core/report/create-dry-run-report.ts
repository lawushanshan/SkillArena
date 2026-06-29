import type { LoadedEvalSuite } from "../run/dry-run.js";
import type { RunMetadata } from "../metadata/metadata.js";
import type { SkillArenaReport, ReportCase, ReportSuite } from "./report-schema.js";

export interface CreateDryRunReportInput {
  runId: string;
  runDir: string;
  startedAt: Date;
  finishedAt: Date;
  metadata: RunMetadata;
  suites: LoadedEvalSuite[];
  warnings: string[];
}

export function createDryRunReport(input: CreateDryRunReportInput): SkillArenaReport {
  const suites: ReportSuite[] = input.suites.map((loadedSuite) => {
    const cases: ReportCase[] = loadedSuite.selectedCases.map((testCase) => ({
      id: testCase.id,
      prompt: testCase.prompt,
      status: "pass",
      checks: [
        {
          name: "schema",
          status: "pass",
          message: "Eval case schema is valid."
        },
        {
          name: "fixture",
          status: "pass",
          message: testCase.workspace.fixture
            ? `Fixture is available: ${testCase.workspace.fixture}`
            : "No fixture required."
        }
      ]
    }));

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

