import { describe, expect, it } from "vitest";

import { EvalSuiteSchema } from "./eval-schema.js";

describe("EvalSuiteSchema", () => {
  it("applies defaults for optional expectation lists", () => {
    const result = EvalSuiteSchema.parse({
      name: "example",
      cases: [
        {
          id: "case-1",
          prompt: "Do a task."
        }
      ]
    });

    expect(result.agent).toBe("codex");
    expect(result.cases[0]?.expect.files_changed).toEqual([]);
    expect(result.cases[0]?.expect.commands).toEqual([]);
    expect(result.cases[0]?.expect.commands_not_run).toEqual([]);
    expect(result.cases[0]?.expect.file_snapshots).toEqual([]);
  });

  it("rejects command expectations without a matcher", () => {
    const result = EvalSuiteSchema.safeParse({
      name: "example",
      cases: [
        {
          id: "case-1",
          prompt: "Do a task.",
          expect: {
            commands: [{ exit_code: 0 }]
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects disallowed command expectations without a matcher", () => {
    const result = EvalSuiteSchema.safeParse({
      name: "example",
      cases: [
        {
          id: "case-1",
          prompt: "Do a task.",
          expect: {
            commands_not_run: [{ exit_code: 0 }]
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("accepts rubric judge expectations and rejects duplicate criteria", () => {
    const valid = EvalSuiteSchema.safeParse({
      name: "example",
      cases: [
        {
          id: "case-1",
          prompt: "Do a task.",
          expect: {
            judge: {
              min_score: 80,
              files: ["report.md"],
              rubric: [{ criterion: "correctness", description: "The result is correct." }]
            }
          }
        }
      ]
    });
    const duplicate = EvalSuiteSchema.safeParse({
      name: "example",
      cases: [
        {
          id: "case-1",
          prompt: "Do a task.",
          expect: {
            judge: {
              min_score: 80,
              rubric: [
                { criterion: "correctness", description: "One." },
                { criterion: "correctness", description: "Two." }
              ]
            }
          }
        }
      ]
    });

    expect(valid.success).toBe(true);
    expect(duplicate.success).toBe(false);
  });
});
