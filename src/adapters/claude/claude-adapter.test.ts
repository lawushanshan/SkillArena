import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createClaudeAdapter } from "../agent-adapter.js";
import { parseClaudeTrace, runClaudeExec } from "./claude-adapter.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-claude-adapter-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createClaudeAdapter", () => {
  it("returns an adapter with name 'claude'", () => {
    const adapter = createClaudeAdapter();
    expect(adapter.name).toBe("claude");
  });

  it("declares expected capabilities", () => {
    const adapter = createClaudeAdapter();
    expect(adapter.capabilities.has("skill_read_trace")).toBe(true);
    expect(adapter.capabilities.has("command_trace")).toBe(true);
    expect(adapter.capabilities.has("file_change_detection")).toBe(true);
  });

  it("exposes execute, parseTrace, and detectVersion methods", () => {
    const adapter = createClaudeAdapter();
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.parseTrace).toBe("function");
    expect(typeof adapter.detectVersion).toBe("function");
  });
});

describe("runClaudeExec", () => {
  it("captures stdout JSONL, stderr, and exit code", async () => {
    const dir = await makeTempDir();
    const scriptPath = await createFakeClaude(
      dir,
      `console.log(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "ok" }] } }));`,
    );
    const rawOutputPath = join(dir, "raw.json");
    const stderrPath = join(dir, "stderr.txt");

    const result = await runClaudeExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath,
      stderrPath,
      timeoutMs: 5000,
      claudeCommand: process.execPath,
      claudeCommandArgs: [scriptPath],
    });

    expect(result.command[0]).toBe(process.execPath);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(await readFile(rawOutputPath, "utf8")).toContain('"type":"assistant"');
    expect(await readFile(stderrPath, "utf8")).toContain("warn");
    expect(result.stdoutBytes).toBeGreaterThan(0);
    expect(result.stderrBytes).toBeGreaterThan(0);
    expect(result.command).toContain("--print");
    expect(result.command).toContain("--output-format");
    expect(result.command).toContain("stream-json");
    expect(result.command).toContain("--verbose");
  });

  it("adds an absolute Claude command directory to the child PATH", async () => {
    const dir = await makeTempDir();
    const scriptPath = await createFakeClaude(
      dir,
      `console.log(process.env.PATH ?? process.env.Path ?? "");`,
    );
    const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
    const originalPath = process.env[pathKey];
    process.env[pathKey] = "";

    try {
      const result = await runClaudeExec({
        prompt: "Do a task.",
        cwd: dir,
        rawOutputPath: join(dir, "raw.json"),
        stderrPath: join(dir, "stderr.txt"),
        timeoutMs: 5000,
        claudeCommand: process.execPath,
        claudeCommandArgs: [scriptPath],
      });

      expect(result.exitCode).toBe(0);
      expect((await readFile(result.rawOutputPath, "utf8")).trim().split(delimiter)).toContain(
        dirname(process.execPath),
      );
    } finally {
      if (originalPath === undefined) {
        delete process.env[pathKey];
      } else {
        process.env[pathKey] = originalPath;
      }
    }
  });

  it("marks timed out executions", async () => {
    const dir = await makeTempDir();
    await createFakeClaude(dir, `setTimeout(() => {}, 10000);`);

    const result = await runClaudeExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath: join(dir, "raw.json"),
      stderrPath: join(dir, "stderr.txt"),
      timeoutMs: 50,
      claudeCommand: process.execPath,
      claudeCommandArgs: [join(dir, "fake-claude.js")],
    });

    expect(result.timedOut).toBe(true);
  });

  it("returns an execution error when the command cannot be spawned", async () => {
    const dir = await makeTempDir();

    const result = await runClaudeExec({
      prompt: "Do a task.",
      cwd: dir,
      rawOutputPath: join(dir, "raw.json"),
      stderrPath: join(dir, "stderr.txt"),
      timeoutMs: 5000,
      claudeCommand: "definitely-missing-claude-command",
    });

    expect(result.exitCode).toBeNull();
    expect(result.error).toBeTruthy();
    expect(await readFile(result.stderrPath, "utf8")).toContain(
      "definitely-missing-claude-command",
    );
  });
});

describe("parseClaudeTrace", () => {
  it("normalizes a typical Claude stream-json trace", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: ".codex/skills/code-audit/SKILL.md" } },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [
              { type: "tool_result", tool_use_id: "toolu_1", content: "skill content here" },
            ],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "npm test" } },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [
              { type: "tool_result", tool_use_id: "toolu_2", content: "tests passed" },
            ],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_3", name: "Write", input: { file_path: "audit-report.md", content: "# Audit Report" } },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [
              { type: "tool_result", tool_use_id: "toolu_3", content: "File written" },
            ],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_4", name: "Read", input: { file_path: "config.json" } },
            ],
          },
        }),
        JSON.stringify({
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Done. Report created." }],
          },
        }),
        JSON.stringify({ type: "result", subtype: "success", result: "Done.", is_error: false }),
        "{not-json",
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.source).toBe("claude");
    expect(parsed.stats.rawEvents).toBe(9);
    expect(parsed.stats.parseErrors).toBe(1);
    expect(parsed.events.map((e) => e.type)).toEqual([
      "skill_read",
      "command_finished",
      "command_started",
      "command_finished",
      "file_changed",
      "command_finished",
      "file_read",
      "assistant_message",
      "assistant_message",
    ]);

    const skillRead = parsed.events[0];
    expect(skillRead.type).toBe("skill_read");
    expect(skillRead).toMatchObject({ skillName: "code-audit" });
    expect((skillRead as { path: string }).path).toContain("SKILL.md");

    expect(parsed.events[2]).toMatchObject({
      type: "command_started",
      command: "npm test",
    });

    expect(parsed.events[4]).toMatchObject({
      type: "file_changed",
      path: "audit-report.md",
    });

    expect(parsed.events[6]).toMatchObject({
      type: "file_read",
      path: "config.json",
    });
  });

  it("detects run errors from the result event", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({ type: "result", subtype: "error", is_error: true, result: "API rate limit exceeded" }),
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0]).toMatchObject({
      type: "run_error",
      message: "API rate limit exceeded",
    });
  });

  it("handles Edit tool as file_changed", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "src/app.ts", old_string: "old", new_string: "new" } },
            ],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.events).toContainEqual(
      expect.objectContaining({ type: "file_changed", path: "src/app.ts" }),
    );
  });

  it("handles tool_result errors as run_error events", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "npm test" } },
            ],
          },
        }),
        JSON.stringify({
          type: "user",
          message: {
            content: [
              { type: "tool_result", tool_use_id: "toolu_1", is_error: true, content: "Command failed with exit code 1" },
            ],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    const errorEvents = parsed.events.filter((e) => e.type === "run_error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toMatchObject({
      message: "Command failed with exit code 1",
    });

    const commandFinished = parsed.events.filter((e) => e.type === "command_finished");
    expect(commandFinished).toHaveLength(1);
    expect(commandFinished[0]).toMatchObject({ exitCode: 1 });
  });

  it("handles empty and non-object lines gracefully", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(rawPath, "\n\n{not-json\n\n{}\n\n", "utf8");

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.stats.rawEvents).toBe(1);
    expect(parsed.stats.parseErrors).toBe(1);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].type).toBe("unknown");
  });

  it("handles Windows-style SKILL.md paths", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: ".codex\\skills\\security-scan\\SKILL.md" } },
            ],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toMatchObject({
      type: "skill_read",
      skillName: "security-scan",
    });
  });

  it("normalizes NotebookEdit as file_changed", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            content: [
              { type: "tool_use", id: "toolu_1", name: "NotebookEdit", input: { notebook_path: "analysis.ipynb" } },
            ],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const parsed = await parseClaudeTrace(rawPath);

    expect(parsed.events).toContainEqual(
      expect.objectContaining({ type: "file_changed", path: "analysis.ipynb" }),
    );
  });
});

async function createFakeClaude(dir: string, body: string): Promise<string> {
  const scriptPath = join(dir, "fake-claude.js");
  await writeFile(
    scriptPath,
    `const args = process.argv.slice(2);
if (!args.includes("--print")) process.exit(2);
if (!args.includes("--verbose")) process.exit(2);
${body}
console.error("warn");
`,
    "utf8",
  );
  await chmod(scriptPath, 0o755);
  return scriptPath;
}
