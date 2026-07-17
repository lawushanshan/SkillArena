import { describe, expect, it } from "vitest";

import type { ParsedTrace } from "../trace/normalized-events.js";
import { createFailureTraceSummary } from "./create-failure-trace-summary.js";

describe("createFailureTraceSummary", () => {
  it("summarizes the relevant signals from a failed case without command output", () => {
    const summary = createFailureTraceSummary(
      [{ name: "expect.files_created", status: "fail", message: "Missing report", category: "artifact_mismatch" }],
      createTrace()
    );

    expect(summary).toEqual({
      category: "artifact_mismatch",
      skillsRead: ["code-audit"],
      failedCommands: [{ command: "node scripts/audit.js", exitCode: 2 }],
      runErrors: ["tool unavailable"],
      parseErrors: [{ line: 8, message: "Unexpected token" }]
    });
  });

  it("does not create a summary when checks pass", () => {
    expect(
      createFailureTraceSummary([{ name: "expect.exit_code", status: "pass", message: "ok" }], createTrace())
    ).toBeUndefined();
  });
});

function createTrace(): ParsedTrace {
  return {
    schemaVersion: "0.1",
    source: "codex",
    rawPath: "/tmp/raw.jsonl",
    events: [
      { type: "skill_read", source: "codex", line: 1, skillName: "code-audit" },
      { type: "command_finished", source: "codex", line: 2, command: "node scripts/audit.js", exitCode: 2 },
      { type: "run_error", source: "codex", line: 3, message: "tool unavailable" }
    ],
    parseErrors: [{ line: 8, message: "Unexpected token", text: "{bad" }],
    stats: { rawEvents: 3, normalizedEvents: 3, parseErrors: 1 }
  };
}
