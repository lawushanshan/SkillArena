import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { runReportCommand, renderConsoleReportSummary } from "./report-command.js";
import type { SkillArenaReport } from "./report-schema.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-report-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runReportCommand", () => {
  it("loads report.json and rewrites report.md for an explicit run directory", async () => {
    const root = await createProjectWithRun("20260629T000000Z-aaaaaa");
    const runDir = join(root, ".skillarena", "runs", "20260629T000000Z-aaaaaa");

    const result = await runReportCommand({ cwd: root, runDir });

    expect(result.report.summary.passed).toBe(1);
    expect(result.markdownWritten).toBe(true);
    expect(existsSync(result.reportMarkdownPath)).toBe(true);
    await expect(readFile(result.reportMarkdownPath, "utf8")).resolves.toContain(
      "# SkillArena Report"
    );
  });

  it("uses the latest run when runDir is omitted", async () => {
    const root = await createProjectWithRun("20260629T000000Z-aaaaaa");
    await createRun(root, "20260629T010000Z-bbbbbb");

    const result = await runReportCommand({ cwd: root });

    expect(result.runDir).toContain("20260629T010000Z-bbbbbb");
  });

  it("renders a concise console summary", async () => {
    const root = await createProjectWithRun("20260629T000000Z-aaaaaa");
    const result = await runReportCommand({ cwd: root, writeMarkdown: false });

    expect(renderConsoleReportSummary(result)).toContain("Passed: 1");
  });

  it("fails invalid reports", async () => {
    const root = await createProjectWithRun("20260629T000000Z-aaaaaa");
    const runDir = join(root, ".skillarena", "runs", "20260629T000000Z-aaaaaa");
    await writeFile(join(runDir, "report.json"), `{"tool":"not-skillarena"}`, "utf8");

    await expect(runReportCommand({ cwd: root, runDir })).rejects.toThrow(
      "Invalid SkillArena report"
    );
  });
});

async function createProjectWithRun(runId: string): Promise<string> {
  const root = await makeTempDir();
  await writeFile(
    join(root, "skillarena.yaml"),
    `schemaVersion: "0.1"\nagent: codex\n`,
    "utf8"
  );
  await createRun(root, runId);
  return root;
}

async function createRun(root: string, runId: string): Promise<void> {
  const runDir = join(root, ".skillarena", "runs", runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "report.json"), `${JSON.stringify(createReport(root, runId), null, 2)}\n`);
}

function createReport(root: string, runId: string): SkillArenaReport {
  const runDir = join(root, ".skillarena", "runs", runId);
  return {
    schemaVersion: "0.1",
    tool: "skillarena",
    mode: "dry-run",
    run: {
      id: runId,
      dir: runDir,
      startedAt: "2026-06-29T00:00:00.000Z",
      finishedAt: "2026-06-29T00:00:01.000Z",
      durationMs: 1000
    },
    metadata: {
      skillarenaVersion: "0.0.0-test",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      startedAt: "2026-06-29T00:00:00.000Z",
      command: ["run", "--dry-run"],
      projectRoot: root,
      configPath: join(root, "skillarena.yaml"),
      configHash: "hash",
      evals: [],
      skills: [],
      fixtures: []
    },
    summary: {
      suites: 1,
      cases: 1,
      passed: 1,
      failed: 0,
      blocked: 0,
      warnings: 0
    },
    suites: [],
    warnings: []
  };
}

