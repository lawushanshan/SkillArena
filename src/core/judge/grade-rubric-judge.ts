import type { RubricJudgeExpectation } from "../eval/eval-schema.js";
import type { ReportCheck } from "../report/report-schema.js";
import type { RubricJudgeResult } from "./rubric-judge.js";

export function gradeRubricJudge(
  expectation: RubricJudgeExpectation,
  result: RubricJudgeResult | undefined
): ReportCheck[] {
  if (!result) {
    return [
      {
        name: "expect.judge",
        status: "warn",
        message: "Rubric judge was skipped because Codex execution did not complete."
      }
    ];
  }

  if (result.status === "error") {
    return [
      {
        name: "expect.judge",
        status: "fail",
        message: result.message,
        category: "judge_failed"
      }
    ];
  }

  const passed = result.score >= expectation.min_score;
  return [
    {
      name: "expect.judge",
      status: passed ? "pass" : "fail",
      message: `score=${result.score}, minimum=${expectation.min_score}`,
      category: passed ? undefined : "judge_failed"
    }
  ];
}
