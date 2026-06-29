import { describe, expect, it } from "vitest";

import type { CodexExecResult } from "../../adapters/codex/codex-adapter.js";
import type { CaseExpectation, EvalCase } from "../eval/eval-schema.js";
import type { ParsedTrace } from "../trace/normalized-events.js";
import { gradeDeterministicExpectations } from "./deterministic-grader.js";

describe("gradeDeterministicExpectations", () => {
  it("passes skill and command expectations when normalized events match", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        skill_used: "code-audit",
        commands: [{ contains: "scripts/audit.js", exit_code: 0 }],
        commands_succeeded: true,
        exit_code: 0
      }),
      codex: createCodexResult(0),
      parsedTrace: createParsedTrace()
    });

    expect(checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("fails missing expected skills", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        skill_used: "missing-skill"
      }),
      codex: createCodexResult(0),
      parsedTrace: createParsedTrace()
    });

    expect(checks[0]).toMatchObject({
      status: "fail",
      category: "skill_not_triggered"
    });
  });

  it("fails unexpected skill usage", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        skill_not_used: "code-audit"
      }),
      codex: createCodexResult(0),
      parsedTrace: createParsedTrace()
    });

    expect(checks[0]).toMatchObject({
      status: "fail",
      category: "skill_misfire"
    });
  });
});

function createCase(expect: Partial<CaseExpectation>): EvalCase {
  return {
    id: "case-1",
    prompt: "Do a task.",
    workspace: {},
    expect: {
      commands: [],
      files_created: [],
      files_changed: [],
      files_unchanged: [],
      ...expect
    }
  };
}

function createCodexResult(exitCode: number): CodexExecResult {
  return {
    command: ["codex", "exec"],
    cwd: "/tmp/workspace",
    exitCode,
    signal: null,
    timedOut: false,
    durationMs: 1,
    rawOutputPath: "/tmp/raw.jsonl",
    stderrPath: "/tmp/stderr.txt",
    stdoutBytes: 1,
    stderrBytes: 0
  };
}

function createParsedTrace(): ParsedTrace {
  return {
    schemaVersion: "0.1",
    source: "codex",
    rawPath: "/tmp/raw.jsonl",
    parseErrors: [],
    stats: {
      rawEvents: 3,
      normalizedEvents: 3,
      parseErrors: 0
    },
    events: [
      {
        type: "skill_read",
        source: "codex",
        line: 1,
        rawType: "file_read",
        skillName: "code-audit",
        path: ".codex/skills/code-audit/SKILL.md"
      },
      {
        type: "command_started",
        source: "codex",
        line: 2,
        rawType: "exec_command_begin",
        command: "node scripts/audit.js"
      },
      {
        type: "command_finished",
        source: "codex",
        line: 3,
        rawType: "exec_command_end",
        command: "node scripts/audit.js",
        exitCode: 0
      }
    ]
  };
}
