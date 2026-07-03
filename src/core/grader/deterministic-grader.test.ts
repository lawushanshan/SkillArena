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

  it("requires a finished command event when command expectations include exit_code", () => {
    const trace = createParsedTrace();
    trace.events = trace.events.filter((event) => event.type !== "command_finished");

    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        commands: [{ contains: "scripts/audit.js", exit_code: 0 }]
      }),
      codex: createCodexResult(0),
      parsedTrace: trace
    });

    expect(checks).toEqual([
      expect.objectContaining({
        name: "expect.commands[0]",
        status: "fail",
        category: "command_failed"
      })
    ]);
  });

  it("passes when disallowed commands are not observed", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        commands_not_run: [{ contains: "npm publish" }]
      }),
      codex: createCodexResult(0),
      parsedTrace: createParsedTrace()
    });

    expect(checks).toEqual([
      expect.objectContaining({
        name: "expect.commands_not_run[0]",
        status: "pass"
      })
    ]);
  });

  it("fails when disallowed commands are observed", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        commands_not_run: [{ contains: "scripts/audit.js" }]
      }),
      codex: createCodexResult(0),
      parsedTrace: createParsedTrace()
    });

    expect(checks).toEqual([
      expect.objectContaining({
        name: "expect.commands_not_run[0]",
        status: "fail",
        category: "command_failed"
      })
    ]);
  });


  it("passes deleted file expectations when workspace diff matches", () => {
    const checks = gradeDeterministicExpectations({
      testCase: createCase({
        files_deleted: ["delete-me.txt"]
      }),
      codex: createCodexResult(0),
      workspaceDiff: {
        created: [],
        changed: [],
        deleted: ["delete-me.txt"],
        unchanged: []
      }
    });

    expect(checks).toEqual([
      expect.objectContaining({
        name: "expect.files_deleted",
        status: "pass"
      })
    ]);
  });
});

function createCase(expect: Partial<CaseExpectation>): EvalCase {
  return {
    id: "case-1",
    prompt: "Do a task.",
    workspace: {},
    expect: {
      commands: [],
      commands_not_run: [],
      files_created: [],
      files_changed: [],
      files_deleted: [],
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
