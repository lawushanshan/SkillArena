import { describe, expect, it } from "vitest";

import { gradeRubricJudge } from "./grade-rubric-judge.js";

const expectation = {
  min_score: 80,
  files: [],
  rubric: [{ criterion: "correctness", description: "The result is correct.", weight: 1 }]
};

describe("gradeRubricJudge", () => {
  it("passes a score that meets the threshold", () => {
    expect(
      gradeRubricJudge(expectation, {
        status: "completed",
        model: "test-model",
        promptVersion: "test",
        score: 80,
        summary: "Meets the rubric.",
        criteria: [{ criterion: "correctness", score: 80, reason: "Evidence is correct." }]
      })
    ).toEqual([expect.objectContaining({ status: "pass" })]);
  });

  it("classifies a score below the threshold as judge_failed", () => {
    expect(
      gradeRubricJudge(expectation, {
        status: "completed",
        model: "test-model",
        promptVersion: "test",
        score: 79,
        summary: "Does not meet the rubric.",
        criteria: [{ criterion: "correctness", score: 79, reason: "Evidence is incomplete." }]
      })
    ).toEqual([expect.objectContaining({ status: "fail", category: "judge_failed" })]);
  });
});
