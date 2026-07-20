import { describe, expect, it } from "vitest";

import { EvalCaseSchema } from "../core/eval/eval-schema.js";
import { missingCapabilities, requiredCapabilities } from "./adapter-capabilities.js";

describe("adapter capabilities", () => {
  it("derives capabilities from deterministic expectations", () => {
    const testCase = EvalCaseSchema.parse({
      id: "requires-traces",
      prompt: "Test the skill.",
      expect: {
        skill_used: "code-audit",
        commands: [{ contains: "node scripts/audit.js" }],
        files_changed: ["audit-report.md"]
      }
    });

    expect(requiredCapabilities(testCase)).toEqual([
      "skill_read_trace",
      "command_trace",
      "file_change_detection"
    ]);
  });

  it("reports only unavailable required capabilities", () => {
    const testCase = EvalCaseSchema.parse({
      id: "requires-command-trace",
      prompt: "Run the check.",
      expect: {
        commands_succeeded: true
      }
    });

    expect(missingCapabilities(testCase, new Set())).toEqual(["command_trace"]);
    expect(missingCapabilities(testCase, new Set(["command_trace"]))).toEqual([]);
  });
});
