import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { parseCodexJsonlTrace } from "./codex-jsonl-parser.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-trace-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("parseCodexJsonlTrace", () => {
  it("normalizes common trace signals", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({ type: "file_read", path: ".codex/skills/code-audit/SKILL.md" }),
        JSON.stringify({ type: "exec_command_begin", command: "node scripts/audit.js" }),
        JSON.stringify({ type: "exec_command_end", command: "node scripts/audit.js", exit_code: 0 }),
        JSON.stringify({ type: "assistant_message", message: "Done" }),
        "{not-json"
      ].join("\n"),
      "utf8"
    );

    const parsed = await parseCodexJsonlTrace(rawPath);

    expect(parsed.stats.rawEvents).toBe(4);
    expect(parsed.stats.parseErrors).toBe(1);
    expect(parsed.events.map((event) => event.type)).toEqual([
      "skill_read",
      "command_started",
      "command_finished",
      "assistant_message"
    ]);
    expect(parsed.events[0]).toMatchObject({
      type: "skill_read",
      skillName: "code-audit"
    });
  });

  it("normalizes command and message items emitted by current Codex JSONL output", async () => {
    const dir = await makeTempDir();
    const rawPath = join(dir, "trace.jsonl");
    await writeFile(
      rawPath,
      [
        JSON.stringify({
          type: "item.started",
          item: {
            type: "command_execution",
            command: "Get-Content .codex/skills/code-audit/SKILL.md"
          }
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            type: "command_execution",
            command: "Get-Content .codex/skills/code-audit/SKILL.md",
            exit_code: 0
          }
        }),
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "Done" }
        }),
        JSON.stringify({ type: "turn.failed", error: "request failed" })
      ].join("\n"),
      "utf8"
    );

    const parsed = await parseCodexJsonlTrace(rawPath);

    expect(parsed.events.map((event) => event.type)).toEqual([
      "command_started",
      "skill_read",
      "command_finished",
      "assistant_message",
      "run_error"
    ]);
    expect(parsed.events[1]).toMatchObject({
      skillName: "code-audit",
      path: ".codex/skills/code-audit/SKILL.md"
    });
    expect(parsed.events[2]).toMatchObject({
      command: "Get-Content .codex/skills/code-audit/SKILL.md",
      exitCode: 0
    });
  });

  it("parses a sanitized golden fixture captured from Codex JSONL", async () => {
    const fixturePath = fileURLToPath(new URL("./fixtures/codex-0.144-item-events.jsonl", import.meta.url));

    const parsed = await parseCodexJsonlTrace(fixturePath);

    expect(parsed.stats).toMatchObject({
      rawEvents: 7,
      normalizedEvents: 9,
      parseErrors: 0
    });
    expect(parsed.events.map((event) => event.type)).toEqual([
      "unknown",
      "assistant_message",
      "command_started",
      "skill_read",
      "command_finished",
      "unknown",
      "file_changed",
      "file_changed",
      "unknown"
    ]);
    expect(parsed.events[3]).toMatchObject({
      skillName: "code-audit",
      path: ".codex\\skills\\code-audit\\SKILL.md"
    });
    expect(parsed.events.filter((event) => event.type === "file_changed")).toEqual([
      expect.objectContaining({ path: "README.md" }),
      expect.objectContaining({ path: "audit-report.md" })
    ]);
  });

  it("parses a sanitized Windows fixture captured from Codex 0.145", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/codex-0.145-windows-item-events.jsonl", import.meta.url)
    );

    const parsed = await parseCodexJsonlTrace(fixturePath);

    expect(parsed.stats).toMatchObject({
      rawEvents: 10,
      normalizedEvents: 12,
      parseErrors: 0
    });
    expect(parsed.events.map((event) => event.type)).toEqual([
      "unknown",
      "unknown",
      "assistant_message",
      "command_started",
      "skill_read",
      "command_finished",
      "command_started",
      "command_finished",
      "file_changed",
      "file_changed",
      "assistant_message",
      "unknown"
    ]);
    expect(parsed.events[4]).toMatchObject({
      skillName: "code-audit",
      path: ".\\.codex\\skills\\code-audit\\SKILL.md"
    });
    expect(parsed.events[8]).toMatchObject({ path: "README.md" });
    expect(parsed.events[9]).toMatchObject({ path: "audit-report.md" });
  });
});
