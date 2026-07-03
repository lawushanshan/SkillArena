import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import type { SkillArenaReport } from "../report/report-schema.js";
import { compareReports, renderCompareSummary, runCompareCommand } from "./compare-runs.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-compare-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("compareReports", () => {
  it("compares pass rate, skill checks, duration, and case status changes", () => {
    const baseline = createReport({
      runId: "baseline",
      durationMs: 1000,
      cases: [
        createCase("suite", "improves", "fail", [
          { name: "expect.skill_used", status: "fail", message: "missing" }
        ]),
        createCase("suite", "regresses", "pass", [
          { name: "expect.skill_not_used", status: "pass", message: "clean" }
        ]),
        createCase("suite", "same", "pass", [])
      ]
    });
    const candidate = createReport({
      runId: "candidate",
      durationMs: 1250,
      cases: [
        createCase("suite", "improves", "pass", [
          { name: "expect.skill_used", status: "pass", message: "observed" }
        ]),
        createCase("suite", "regresses", "fail", [
          { name: "expect.skill_not_used", status: "fail", message: "misfire" }
        ]),
        createCase("suite", "same", "pass", []),
        createCase("suite", "new-case", "pass", [])
      ]
    });

    const comparison = compareReports(baseline, candidate);

    expect(comparison.baseline.passRate).toBeCloseTo(2 / 3);
    expect(comparison.candidate.passRate).toBeCloseTo(3 / 4);
    expect(comparison.baseline.triggerRate).toBe(0);
    expect(comparison.candidate.triggerRate).toBe(1);
    expect(comparison.baseline.falsePositiveRate).toBe(0);
    expect(comparison.candidate.falsePositiveRate).toBe(1);
    expect(comparison.delta.triggerRatePoints).toBe(1);
    expect(comparison.delta.falsePositiveRatePoints).toBe(1);
    expect(comparison.delta.passed).toBe(1);
    expect(comparison.delta.failed).toBe(0);
    expect(comparison.delta.durationMs).toBe(250);
    expect(comparison.delta.skillUsedPassed).toBe(1);
    expect(comparison.delta.skillUsedFailed).toBe(-1);
    expect(comparison.delta.skillNotUsedPassed).toBe(-1);
    expect(comparison.delta.skillNotUsedFailed).toBe(1);
    expect(comparison.cases).toMatchObject({
      common: 3,
      improved: 1,
      regressed: 1,
      unchanged: 1,
      added: 1,
      removed: 0
    });
    expect(comparison.cases.improvedCases).toEqual([
      {
        suiteName: "suite",
        caseId: "improves",
        baselineStatus: "fail",
        candidateStatus: "pass"
      }
    ]);
    expect(comparison.cases.regressedCases).toEqual([
      {
        suiteName: "suite",
        caseId: "regresses",
        baselineStatus: "pass",
        candidateStatus: "fail"
      }
    ]);
    expect(comparison.cases.addedCases).toEqual([
      {
        suiteName: "suite",
        caseId: "new-case",
        candidateStatus: "pass"
      }
    ]);
    expect(renderCompareSummary(comparison)).toContain("Case changes: 1 improved, 1 regressed");
    expect(renderCompareSummary(comparison)).toContain("Trigger rate: 0.0% -> 100.0%");
    expect(renderCompareSummary(comparison)).toContain("suite/improves: fail -> pass");
  });
});

describe("runCompareCommand", () => {
  it("loads report.json from two run directories", async () => {
    const root = await makeTempDir();
    const baselineRunDir = join(root, ".skillarena", "runs", "baseline");
    const candidateRunDir = join(root, ".skillarena", "runs", "candidate");
    await mkdir(baselineRunDir, { recursive: true });
    await mkdir(candidateRunDir, { recursive: true });
    await writeFile(
      join(baselineRunDir, "report.json"),
      `${JSON.stringify(
        createReport({
          runId: "baseline",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "fail", [])]
        }),
        null,
        2
      )}\n`,
      "utf8"
    );
    await writeFile(
      join(candidateRunDir, "report.json"),
      `${JSON.stringify(
        createReport({
          runId: "candidate",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "pass", [])]
        }),
        null,
        2
      )}\n`,
      "utf8"
    );

    const comparison = await runCompareCommand({
      cwd: root,
      baselineRunDir: ".skillarena/runs/baseline",
      candidateRunDir: ".skillarena/runs/candidate"
    });

    expect(comparison.cases.improved).toBe(1);
    expect(comparison.delta.passed).toBe(1);
  });

  it("loads reports by run id from the configured runs directory", async () => {
    const root = await createProjectWithRuns([
      {
        runId: "20260629T000000Z-baseln",
        report: createReport({
          runId: "baseline",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "fail", [])]
        })
      },
      {
        runId: "20260629T010000Z-candid",
        report: createReport({
          runId: "candidate",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "pass", [])]
        })
      }
    ]);

    const comparison = await runCompareCommand({
      cwd: root,
      baselineRunDir: "20260629T000000Z-baseln",
      candidateRunDir: "20260629T010000Z-candid"
    });

    expect(comparison.cases.improved).toBe(1);
  });

  it("compares the latest two runs when run directories are omitted", async () => {
    const root = await createProjectWithRuns([
      {
        runId: "20260629T000000Z-oldold",
        report: createReport({
          runId: "old",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "pass", [])]
        })
      },
      {
        runId: "20260629T010000Z-baseln",
        report: createReport({
          runId: "baseline",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "fail", [])]
        })
      },
      {
        runId: "20260629T020000Z-candid",
        report: createReport({
          runId: "candidate",
          durationMs: 100,
          cases: [createCase("suite", "case-1", "pass", [])]
        })
      }
    ]);

    const comparison = await runCompareCommand({ cwd: root });

    expect(comparison.baseline.runId).toBe("baseline");
    expect(comparison.candidate.runId).toBe("candidate");
    expect(comparison.cases.improved).toBe(1);
  });
});

function createReport(input: {
  runId: string;
  durationMs: number;
  cases: Array<SkillArenaReport["suites"][number]["cases"][number] & { suiteName: string }>;
}): SkillArenaReport {
  const suiteNames = [...new Set(input.cases.map((testCase) => testCase.suiteName))];
  const suites = suiteNames.map((suiteName) => {
    const cases = input.cases
      .filter((testCase) => testCase.suiteName === suiteName)
      .map(({ suiteName: _suiteName, ...testCase }) => testCase);

    return {
      name: suiteName,
      path: `evals/${suiteName}.yaml`,
      status: cases.some((testCase) => testCase.status === "fail") ? "fail" as const : "pass" as const,
      cases
    };
  });
  const cases = suites.flatMap((suite) => suite.cases);

  return {
    schemaVersion: "0.1",
    tool: "skillarena",
    mode: "run",
    run: {
      id: input.runId,
      dir: `/runs/${input.runId}`,
      startedAt: "2026-06-29T00:00:00.000Z",
      finishedAt: "2026-06-29T00:00:01.000Z",
      durationMs: input.durationMs
    },
    metadata: {
      skillarenaVersion: "0.0.0-test",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      startedAt: "2026-06-29T00:00:00.000Z",
      command: ["run"],
      projectRoot: "/project",
      configPath: "/project/skillarena.yaml",
      configHash: "hash",
      evals: [],
      skills: [],
      fixtures: []
    },
    summary: {
      suites: suites.length,
      cases: cases.length,
      passed: cases.filter((testCase) => testCase.status === "pass").length,
      failed: cases.filter((testCase) => testCase.status === "fail").length,
      blocked: cases.filter((testCase) => testCase.status === "blocked").length,
      warnings: 0
    },
    suites,
    warnings: []
  };
}

function createCase(
  suiteName: string,
  id: string,
  status: "pass" | "fail" | "blocked",
  checks: SkillArenaReport["suites"][number]["cases"][number]["checks"]
): SkillArenaReport["suites"][number]["cases"][number] & { suiteName: string } {
  return {
    suiteName,
    id,
    prompt: "Do a task.",
    status,
    checks
  };
}

async function createProjectWithRuns(
  runs: Array<{ runId: string; report: SkillArenaReport }>
): Promise<string> {
  const root = await makeTempDir();
  await writeFile(
    join(root, "skillarena.yaml"),
    `schemaVersion: "0.1"\nagent: codex\n`,
    "utf8"
  );

  for (const run of runs) {
    const runDir = join(root, ".skillarena", "runs", run.runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "report.json"),
      `${JSON.stringify(run.report, null, 2)}\n`,
      "utf8"
    );
  }

  return root;
}
