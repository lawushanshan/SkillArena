import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { runCodexExec } from "./codex-adapter.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-codex-adapter-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runCodexExec", () => {
  it("captures stdout JSONL, stderr, and exit code", async () => {
    const dir = await makeTempDir();
    const scriptPath = await createFakeCodex(
      dir,
      `console.log(JSON.stringify({ type: "message", text: "ok" })); console.error("warn");`
    );
    const rawOutputPath = join(dir, "raw.jsonl");
    const stderrPath = join(dir, "stderr.txt");

    const result = await runCodexExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath,
      stderrPath,
      timeoutMs: 5000,
      codexCommand: process.execPath,
      codexCommandArgs: [scriptPath]
    });

    expect(result.command[0]).toBe(process.execPath);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(await readFile(rawOutputPath, "utf8")).toContain('"type":"message"');
    expect(await readFile(stderrPath, "utf8")).toContain("warn");
    expect(result.stdoutBytes).toBeGreaterThan(0);
    expect(result.stderrBytes).toBeGreaterThan(0);
    expect(result.command).toContain(scriptPath);
  });

  it("marks timed out executions", async () => {
    const dir = await makeTempDir();
    await createFakeCodex(dir, `setTimeout(() => {}, 10000);`);

    const result = await runCodexExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath: join(dir, "raw.jsonl"),
      stderrPath: join(dir, "stderr.txt"),
      timeoutMs: 50,
      codexCommand: process.execPath,
      codexCommandArgs: [join(dir, "fake-codex.js")]
    });

    expect(result.timedOut).toBe(true);
  });

  it("returns an execution error when the command cannot be spawned", async () => {
    const dir = await makeTempDir();

    const result = await runCodexExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath: join(dir, "raw.jsonl"),
      stderrPath: join(dir, "stderr.txt"),
      timeoutMs: 5000,
      codexCommand: "definitely-missing-codex-command"
    });

    expect(result.exitCode).toBeNull();
    expect(result.error).toBeTruthy();
    expect(await readFile(result.stderrPath, "utf8")).toContain("definitely-missing-codex-command");
  });
});

async function createFakeCodex(dir: string, body: string): Promise<string> {
  const scriptPath = join(dir, "fake-codex.js");
  await writeFile(
    scriptPath,
    `const args = process.argv.slice(2);\nif (args[0] !== "exec") process.exit(2);\n${body}\n`,
    "utf8"
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
}
