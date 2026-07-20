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
      join(root, "evals", "sample-audit.yaml"),
      `name: sample-audit\nagent: codex\ncases:\n  - id: creates-audit-report\n    prompt: "Do a task."\n    workspace:\n      fixture: fixtures/sample-workspace\n    expect:\n      commands_succeeded: true\n      files_created:\n        - audit-report.md\n      files_changed:\n        - README.md\n      files_deleted:\n        - delete-me.txt\n      files_unchanged:\n        - untouched.txt\n`,
      "utf8"
    );
    await writeFile(join(root, "fixtures", "sample-workspace", "untouched.txt"), "same\n", "utf8");
    await writeFile(join(root, "fixtures", "sample-workspace", "delete-me.txt"), "remove\n", "utf8");
    const fakeCodex = await createFakeCodex(root, {
      exitCode: 0,
      stdout: [
        JSON.stringify({ type: "file_read", path: ".codex/skills/sample-audit/SKILL.md" }),
        JSON.stringify({ type: "exec_command_begin", command: "echo ok" }),
        JSON.stringify({ type: "exec_command_end", command: "echo ok", exit_code: 0 })
      ].join("\n"),
      script: [
        "const fs = require('node:fs');",
        "fs.appendFileSync('README.md', '\\nupdated\\n');",
        "fs.writeFileSync('audit-report.md', 'report\\n');",
        "fs.rmSync('delete-me.txt');"
      ].join("\n")
    });

    const result = await runEvals({
      cwd: root,
      command: ["run"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex],
      detectCodexVersion: false
    });

    expect(result.totalCases).toBe(1);
    expect(result.executions).toHaveLength(1);
    expect(result.report.mode).toBe("run");
    expect(result.report.summary.passed).toBe(1);
    expect(result.report.summary.failed).toBe(0);
    expect(existsSync(result.runStore.reportJsonPath)).toBe(true);
    expect(existsSync(result.executions[0]!.codex.rawOutputPath)).toBe(true);
    expect(result.executions[0]!.parsedTrace?.events).toHaveLength(3);
    expect(existsSync(result.workspaces[0]!.path)).toBe(false);

    const reportJson = JSON.parse(await readFile(result.runStore.reportJsonPath, "utf8")) as {
      mode: string;
      summary: { passed: number };
      suites: Array<{
        cases: Array<{
          artifacts?: { rawTrace?: string; stderr?: string; parsedTrace?: string };
          checks: Array<{ name: string; status: string }>;
        }>;
      }>;
    };
    expect(reportJson.mode).toBe("run");
    expect(reportJson.summary.passed).toBe(1);
    const reportCase = reportJson.suites[0]?.cases[0];
    expect(reportCase?.artifacts).toEqual({
      rawTrace: result.executions[0]!.codex.rawOutputPath,
      stderr: result.executions[0]!.codex.stderrPath,
      parsedTrace: result.executions[0]!.parsedTracePath
    });
    expect(existsSync(reportCase!.artifacts!.rawTrace!)).toBe(true);
    expect(existsSync(reportCase!.artifacts!.stderr!)).toBe(true);
    expect(existsSync(reportCase!.artifacts!.parsedTrace!)).toBe(true);
    expect(reportJson.suites[0]?.cases[0]?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "parsed-trace", status: "pass" }),
        expect.objectContaining({ name: "expect.commands_succeeded", status: "pass" }),
        expect.objectContaining({ name: "expect.files_created", status: "pass" }),
        expect.objectContaining({ name: "expect.files_changed", status: "pass" }),
        expect.objectContaining({ name: "expect.files_deleted", status: "pass" }),
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
      codexCommandArgs: [fakeCodex],
      detectCodexVersion: false
    });

    expect(result.report.summary.failed).toBe(1);
    expect(result.report.suites[0]?.cases[0]?.checks[0]?.category).toBe("adapter_error");
    expect(result.report.suites[0]?.cases[0]?.failureTraceSummary).toMatchObject({
      category: "adapter_error",
      skillsRead: [],
      failedCommands: [],
      runErrors: [],
      parseErrors: []
    });
  });

  it("records rubric judge results from an injected judge", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "sample-audit.yaml"),
      `name: sample-audit\ncases:\n  - id: judged-case\n    prompt: "Create a report."\n    workspace:\n      fixture: fixtures/sample-workspace\n    expect:\n      judge:\n        min_score: 80\n        files:\n          - audit-report.md\n        rubric:\n          - criterion: correctness\n            description: The report satisfies the task.\n`,
      "utf8"
    );
    const fakeCodex = await createFakeCodex(root, {
      exitCode: 0,
      stdout: "",
      script: "require('node:fs').writeFileSync('audit-report.md', 'complete report\\n');"
    });

    const result = await runEvals({
      cwd: root,
      command: ["run"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex],
      detectCodexVersion: false,
      rubricJudge: {
        async judge(input) {
          return {
            status: "completed",
            model: "mock-judge",
            promptVersion: input.promptVersion,
            score: 90,
            summary: "The report satisfies the rubric.",
            criteria: [
              {
                criterion: "correctness",
                score: 90,
                reason: "The report file was created."
              }
            ]
          };
        }
      }
    });

    const reportCase = result.report.suites[0]?.cases[0];
    expect(reportCase?.status).toBe("pass");
    expect(reportCase?.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "expect.judge", status: "pass" })])
    );
    expect(reportCase?.judge).toMatchObject({
      model: "mock-judge",
      score: 90,
      minimumScore: 80,
      artifacts: [{ path: "audit-report.md", available: true }]
    });
  });

  it("keeps workspaces when requested", async () => {
    const root = await makeTempDir();
    await initProject(root);
    const fakeCodex = await createFakeCodex(root, { exitCode: 0, stdout: "" });

    const result = await runEvals({
      cwd: root,
      command: ["run", "--keep-workspace"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex],
      detectCodexVersion: false,
      keepWorkspace: true
    });

    expect(existsSync(result.workspaces[0]!.path)).toBe(true);
    expect(result.report.suites[0]?.cases[0]?.workspace?.preserved).toBe(true);
  });

  it("blocks cases whose required adapter capabilities are unavailable", async () => {
    const root = await makeTempDir();
    await initProject(root);

    const result = await runEvals({
      cwd: root,
      command: ["run"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      codexCommand: process.execPath,
      detectCodexVersion: false,
      adapterCapabilities: new Set()
    });

    expect(result.executions).toHaveLength(0);
    expect(result.report.summary.blocked).toBe(1);
    expect(result.report.suites[0]?.status).toBe("blocked");
    expect(result.report.suites[0]?.cases[0]?.checks).toEqual([
      expect.objectContaining({ name: "adapter-capabilities", status: "unsupported" })
    ]);
  });

  it("stops after the first failed case when failFast is enabled", async () => {
    const root = await makeTempDir();
    await initProject(root);
    await writeFile(
      join(root, "evals", "sample-audit.yaml"),
      `name: sample-audit\nagent: codex\ncases:\n  - id: first-case\n    prompt: "first prompt"\n    workspace:\n      fixture: fixtures/sample-workspace\n  - id: second-case\n    prompt: "second prompt"\n    workspace:\n      fixture: fixtures/sample-workspace\n`,
      "utf8"
    );
    const fakeCodex = await createFakeCodex(root, {
      exitCode: 0,
      stdout: "",
      script: "if (process.argv.includes('first prompt')) process.exit(9);"
    });

    const result = await runEvals({
      cwd: root,
      command: ["run", "--fail-fast"],
      skillarenaVersion: "0.0.0-test",
      timeoutMs: 5000,
      failFast: true,
      codexCommand: process.execPath,
      codexCommandArgs: [fakeCodex],
      detectCodexVersion: false
    });

    expect(result.executions).toHaveLength(1);
    expect(result.totalCases).toBe(1);
    expect(result.report.summary.failed).toBe(1);
    expect(result.report.suites[0]?.cases.map((testCase) => testCase.id)).toEqual(["first-case"]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Stopped after failed case because --fail-fast is enabled: first-case"
      ])
    );
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
