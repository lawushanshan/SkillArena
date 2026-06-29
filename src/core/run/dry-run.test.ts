import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { initProject } from "../init/init-project.js";
import { runDryRun } from "./dry-run.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-dry-run-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runDryRun", () => {
  it("loads the generated sample eval", async () => {
    const root = await makeTempDir();
    await initProject(root);

    const result = await runDryRun({
      cwd: root,
      command: ["run", "--dry-run"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.project.root).toBe(root);
    expect(result.suites).toHaveLength(1);
    expect(result.totalCases).toBe(1);
    expect(result.suites[0]?.suite.name).toBe("sample-audit");
    expect(result.workspaces).toHaveLength(1);
    expect(existsSync(join(result.workspaces[0]!.path, "README.md"))).toBe(true);
    expect(existsSync(result.runStore.reportJsonPath)).toBe(true);
    expect(existsSync(result.runStore.reportMarkdownPath)).toBe(true);

    const reportJson = JSON.parse(await readFile(result.runStore.reportJsonPath, "utf8")) as {
      schemaVersion: string;
      summary: { cases: number };
      suites: Array<{ cases: Array<{ workspace?: { path: string; fixture?: string } }> }>;
    };
    expect(reportJson.schemaVersion).toBe("0.1");
    expect(reportJson.summary.cases).toBe(1);
    expect(reportJson.suites[0]?.cases[0]?.workspace?.fixture).toBe("fixtures/sample-workspace");
  });

  it("filters by case id", async () => {
    const root = await makeTempDir();
    await initProject(root);

    const result = await runDryRun({
      cwd: root,
      caseId: "creates-audit-report",
      command: ["run", "--dry-run", "--case", "creates-audit-report"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
    expect(result.suites[0]?.selectedCaseCount).toBe(1);
  });

  it("fails when the selected case id does not exist", async () => {
    const root = await makeTempDir();
    await initProject(root);

    await expect(
      runDryRun({
        cwd: root,
        caseId: "missing-case",
        command: ["run", "--dry-run"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("No eval case found with id: missing-case");
  });

  it("fails invalid eval suites", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "evals"), { recursive: true });
    await mkdir(join(root, "fixtures", "sample-workspace"), { recursive: true });
    await writeFile(
      join(root, "skillarena.yaml"),
      `schemaVersion: "0.1"\nagent: codex\n`,
      "utf8"
    );
    await writeFile(
      join(root, "evals", "broken.yaml"),
      `name: broken\ncases:\n  - id: duplicate\n    prompt: one\n  - id: duplicate\n    prompt: two\n`,
      "utf8"
    );

    await expect(
      runDryRun({
        cwd: root,
        command: ["run", "--dry-run"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("duplicate case id: duplicate");
  });

  it("fails when a fixture is missing", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "missing-fixture.yaml"),
      `name: missing-fixture\ncases:\n  - id: missing-fixture\n    prompt: test\n    workspace:\n      fixture: fixtures/does-not-exist\n`,
      "utf8"
    );

    await expect(
      runDryRun({
        cwd: root,
        evalFile: "evals/missing-fixture.yaml",
        command: ["run", "--dry-run"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("Fixture does not exist for case missing-fixture");
  });
});
