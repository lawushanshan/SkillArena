import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { initProject } from "../init/init-project.js";
import { runEvals } from "./run-evals.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-run-evals-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runEvals", () => {
  it("runs fake Codex against prepared workspaces and writes a run report", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "sample-skill.yaml"),
      `name: sample-skill\nagent: codex\ncases:\n  - id: sample-dry-run\n    prompt: "Do a task."\n    workspace:\n      fixture: fixtures/sample-workspace\n    expect:\n      commands_succeeded: true\n      files_created:\n        - audit-report.md\n      files_changed:\n        - README.md\n      files_unchanged:\n        - untouched.txt\n`,
      "utf8"
    );
    await writeFile(join(root, "fixtures", "sample-workspace", "untouched.txt"), "same\n", "utf8");
    const fakeCodex = await createFakeCodex(root, {
      exitCode: 0,
      stdout: [
        JSON.stringify({ type: "file_read", path: ".codex/skills/sample-skill/SKILL.md" }),
        JSON.stringify({ type: "exec_command_begin", command: "echo ok" }),
        JSON.stringify({ type: "exec_command_end", command: "echo ok", exit_code: 0 })
      ].join("\n"),
      script: [
        "const fs = require('node:fs');",
        "fs.appendFileSync('README.md', '\\nupdated\\n');",
        "fs.writeFileSync('audit-report.md', 'report\\n');"
      ].join("\n")
    });

    const result = await runEvals({
      cwd: root,
      command: ["run"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex]
    });

    expect(result.totalCases).toBe(1);
    expect(result.executions).toHaveLength(1);
    expect(result.report.mode).toBe("run");
    expect(result.report.summary.passed).toBe(1);
    expect(result.report.summary.failed).toBe(0);
    expect(existsSync(result.runStore.reportJsonPath)).toBe(true);
    expect(existsSync(result.executions[0]!.codex.rawOutputPath)).toBe(true);
    expect(result.executions[0]!.parsedTrace?.events).toHaveLength(3);

    const reportJson = JSON.parse(await readFile(result.runStore.reportJsonPath, "utf8")) as {
      mode: string;
      summary: { passed: number };
      suites: Array<{ cases: Array<{ checks: Array<{ name: string; status: string }> }> }>;
    };
    expect(reportJson.mode).toBe("run");
    expect(reportJson.summary.passed).toBe(1);
    expect(reportJson.suites[0]?.cases[0]?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "parsed-trace", status: "pass" }),
        expect.objectContaining({ name: "expect.commands_succeeded", status: "pass" }),
        expect.objectContaining({ name: "expect.files_created", status: "pass" }),
        expect.objectContaining({ name: "expect.files_changed", status: "pass" }),
        expect.objectContaining({ name: "expect.files_unchanged", status: "pass" })
      ])
    );
  });

  it("marks failed Codex exits as failed cases", async () => {
    const root = await makeTempDir();
    await initProject(root);
    const fakeCodex = await createFakeCodex(root, {
      exitCode: 7,
      stdout: ""
    });

    const result = await runEvals({
      cwd: root,
      command: ["run"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex]
    });

    expect(result.report.summary.failed).toBe(1);
    expect(result.report.suites[0]?.cases[0]?.checks[0]?.category).toBe("adapter_error");
  });
});

async function createFakeCodex(
  root: string,
  options: { exitCode: number; stdout: string; script?: string }
): Promise<string> {
  const scriptPath = join(root, "fake-codex.js");
  await writeFile(
    scriptPath,
    `if (process.argv[2] !== "exec") process.exit(2);\n` +
      `${options.script ?? ""}\n` +
      `if (${JSON.stringify(options.stdout)}.length > 0) console.log(${JSON.stringify(options.stdout)});\n` +
      `process.exit(${options.exitCode});\n`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
}
