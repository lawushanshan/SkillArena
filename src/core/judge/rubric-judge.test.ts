import { describe, expect, it } from "vitest";

import { OpenAiRubricJudge, type RubricJudgeInput } from "./rubric-judge.js";

const input: RubricJudgeInput = {
  promptVersion: "skillarena-rubric-v1",
  prompt: "Create a report.",
  rubric: [{ criterion: "correctness", description: "The report is correct.", weight: 1 }],
  artifacts: [],
  workspaceDiff: { created: ["report.md"], changed: [], deleted: [], unchanged: [] }
};

describe("OpenAiRubricJudge", () => {
  it("uses the Responses API structured-output contract", async () => {
    let request: RequestInit | undefined;
    const judge = new OpenAiRubricJudge({
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 1000,
      fetchImpl: async (_url, options) => {
        request = options;
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              score: 90,
              summary: "The report is correct.",
              criteria: [
                { criterion: "correctness", score: 90, reason: "The evidence supports it." }
              ]
            })
          }),
          { status: 200 }
        );
      }
    });

    await expect(judge.judge(input)).resolves.toMatchObject({
      status: "completed",
      model: "test-model",
      score: 90
    });
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "test-model",
      text: { format: { type: "json_schema", strict: true } }
    });
  });

  it("returns a case-safe error when credentials are unavailable", async () => {
    const judge = new OpenAiRubricJudge({ model: "test-model", timeoutMs: 1000 });

    await expect(judge.judge(input)).resolves.toMatchObject({
      status: "error",
      message: "OPENAI_API_KEY is not configured."
    });
  });
});
