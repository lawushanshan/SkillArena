import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
});

