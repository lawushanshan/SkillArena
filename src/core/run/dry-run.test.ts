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
      detectCodexVersion: false,
      keepWorkspace: true
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

  it("removes dry-run workspaces unless requested", async () => {
    const root = await makeTempDir();
    await initProject(root);

    const result = await runDryRun({
      cwd: root,
      command: ["run", "--dry-run"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(existsSync(result.workspaces[0]!.path)).toBe(false);
    expect(result.report.suites[0]?.cases[0]?.workspace?.preserved).toBe(false);
  });

  it("filters by suite name", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "other-suite.yaml"),
      `name: other-suite\ncases:\n  - id: other-case\n    prompt: other\n    workspace:\n      fixture: fixtures/sample-workspace\n`,
      "utf8"
    );

    const result = await runDryRun({
      cwd: root,
      suiteName: "other-suite",
      command: ["run", "--dry-run", "--suite", "other-suite"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
    expect(result.suites).toHaveLength(1);
    expect(result.suites[0]?.suite.name).toBe("other-suite");
    expect(result.suites[0]?.selectedCases[0]?.id).toBe("other-case");
  });

  it("fails when the selected suite name does not exist", async () => {
    const root = await makeTempDir();
    await initProject(root);

    await expect(
      runDryRun({
        cwd: root,
        suiteName: "missing-suite",
        command: ["run", "--dry-run", "--suite", "missing-suite"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("No eval suite found with name: missing-suite");
  });

  it("does not validate fixtures for unselected cases", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "sample-audit.yaml"),
      `name: sample-audit\ncases:\n  - id: selected-case\n    prompt: selected\n    workspace:\n      fixture: fixtures/sample-workspace\n  - id: unselected-case\n    prompt: unselected\n    workspace:\n      fixture: fixtures/does-not-exist\n`,
      "utf8"
    );

    const result = await runDryRun({
      cwd: root,
      caseId: "selected-case",
      command: ["run", "--dry-run", "--case", "selected-case"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
    expect(result.suites[0]?.selectedCases[0]?.id).toBe("selected-case");
  });

  it("limits selected cases with maxCases", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "sample-audit.yaml"),
      `name: sample-audit\ncases:\n  - id: first-case\n    prompt: first\n    workspace:\n      fixture: fixtures/sample-workspace\n  - id: second-case\n    prompt: second\n    workspace:\n      fixture: fixtures/sample-workspace\n`,
      "utf8"
    );

    const result = await runDryRun({
      cwd: root,
      maxCases: 1,
      command: ["run", "--dry-run", "--max-cases", "1"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
    expect(result.workspaces).toHaveLength(1);
    expect(result.suites[0]?.selectedCases.map((testCase) => testCase.id)).toEqual(["first-case"]);
    expect(result.report.summary.cases).toBe(1);
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

  it("validates snapshot files for selected cases", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(join(root, "snapshots", "audit-report.md"), "expected\n", "utf8");
    await writeFile(
      join(root, "evals", "snapshot.yaml"),
      `name: snapshot\ncases:\n  - id: snapshot-case\n    prompt: test\n    workspace:\n      fixture: fixtures/sample-workspace\n    expect:\n      file_snapshots:\n        - path: audit-report.md\n          snapshot: audit-report.md\n`,
      "utf8"
    );

    const result = await runDryRun({
      cwd: root,
      evalFile: "evals/snapshot.yaml",
      command: ["run", "--dry-run"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
  });

  it("rejects snapshot paths outside the configured snapshots directory", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(join(root, "outside.md"), "outside\n", "utf8");
    await writeFile(
      join(root, "evals", "outside-snapshot.yaml"),
      `name: outside-snapshot\ncases:\n  - id: outside-snapshot\n    prompt: test\n    expect:\n      file_snapshots:\n        - path: report.md\n          snapshot: ../outside.md\n`,
      "utf8"
    );

    await expect(
      runDryRun({
        cwd: root,
        evalFile: "evals/outside-snapshot.yaml",
        command: ["run", "--dry-run"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("Snapshot path must resolve inside the configured snapshots directory");
  });

  it("resolves explicit eval files relative to the project root when run from a subdirectory", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await mkdir(join(root, "nested"), { recursive: true });

    const result = await runDryRun({
      cwd: join(root, "nested"),
      evalFile: "evals/sample-audit.yaml",
      command: ["run", "--dry-run", "evals/sample-audit.yaml"],
      skillarenaVersion: "0.0.0-test",
      detectCodexVersion: false
    });

    expect(result.project.root).toBe(root);
    expect(result.totalCases).toBe(1);
    expect(result.suites[0]?.path).toBe(join(root, "evals", "sample-audit.yaml"));
  });

  it("rejects explicit eval files outside the configured evals directory", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "outside.yaml"),
      `name: outside\ncases:\n  - id: outside\n    prompt: test\n`,
      "utf8"
    );

    await expect(
      runDryRun({
        cwd: root,
        evalFile: "outside.yaml",
        command: ["run", "--dry-run", "outside.yaml"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("Eval file must resolve inside the configured evals directory");
  });

  it("rejects fixture paths outside the configured fixtures directory", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "outside-fixture.yaml"),
      `name: outside-fixture\ncases:\n  - id: outside-fixture\n    prompt: test\n    workspace:\n      fixture: ../\n`,
      "utf8"
    );

    await expect(
      runDryRun({
        cwd: root,
        evalFile: "evals/outside-fixture.yaml",
        command: ["run", "--dry-run"],
        skillarenaVersion: "0.0.0-test",
        detectCodexVersion: false
      })
    ).rejects.toThrow("Fixture path must resolve inside the configured fixtures directory");
  });
});
