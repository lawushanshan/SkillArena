import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { z } from "zod";

import type { RubricJudgeExpectation } from "../eval/eval-schema.js";
import type { WorkspaceDiff } from "../workspace/workspace-snapshot.js";

const PROMPT_VERSION = "skillarena-rubric-v1";
const MAX_ARTIFACT_CHARS = 16_000;
const MAX_TOTAL_ARTIFACT_CHARS = 64_000;

export interface JudgeArtifact {
  path: string;
  characters: number;
  truncated: boolean;
  available: boolean;
  content: string;
}

export interface RubricJudgeInput {
  promptVersion: string;
  prompt: string;
  rubric: RubricJudgeExpectation["rubric"];
  artifacts: JudgeArtifact[];
  workspaceDiff: Pick<WorkspaceDiff, "created" | "changed" | "deleted" | "unchanged">;
}

export interface RubricCriterionScore {
  criterion: string;
  score: number;
  reason: string;
}

export interface RubricJudgeSuccess {
  status: "completed";
  model: string;
  promptVersion: string;
  score: number;
  summary: string;
  criteria: RubricCriterionScore[];
}

export interface RubricJudgeError {
  status: "error";
  model?: string;
  promptVersion: string;
  message: string;
}

export type RubricJudgeResult = RubricJudgeSuccess | RubricJudgeError;

export interface RubricJudge {
  judge(input: RubricJudgeInput): Promise<RubricJudgeResult>;
}

export interface OpenAiRubricJudgeOptions {
  apiKey?: string;
  model?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

const JudgeResponseSchema = z
  .object({
    score: z.number().min(0).max(100),
    summary: z.string().min(1),
    criteria: z
      .array(
        z
          .object({
            criterion: z.string().min(1),
            score: z.number().min(0).max(100),
            reason: z.string().min(1)
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export class OpenAiRubricJudge implements RubricJudge {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiRubricJudgeOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async judge(input: RubricJudgeInput): Promise<RubricJudgeResult> {
    if (!this.options.apiKey) {
      return createError(this.options.model, "OPENAI_API_KEY is not configured.");
    }

    if (!this.options.model) {
      return createError(
        undefined,
        "No judge model is configured. Set --judge-model or SKILLARENA_JUDGE_MODEL."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.options.model,
          input: [
            {
              role: "system",
              content:
                "You are an exacting software-evaluation judge. Score only the supplied evidence. Return the required JSON without adding unsupported claims."
            },
            {
              role: "user",
              content: createJudgePrompt(input)
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "skillarena_rubric_judgment",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["score", "summary", "criteria"],
                properties: {
                  score: { type: "number", minimum: 0, maximum: 100 },
                  summary: { type: "string" },
                  criteria: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["criterion", "score", "reason"],
                      properties: {
                        criterion: { type: "string" },
                        score: { type: "number", minimum: 0, maximum: 100 },
                        reason: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        return createError(this.options.model, `OpenAI judge request failed with status ${response.status}.`);
      }

      const responseBody: unknown = await response.json();
      const outputText = extractOutputText(responseBody);

      if (!outputText) {
        return createError(this.options.model, "OpenAI judge response did not contain structured output.");
      }

      let rawResult: unknown;
      try {
        rawResult = JSON.parse(outputText);
      } catch {
        return createError(this.options.model, "OpenAI judge returned invalid structured output.");
      }

      const parsed = JudgeResponseSchema.safeParse(rawResult);
      if (!parsed.success || !hasExpectedCriteria(parsed.data.criteria, input.rubric)) {
        return createError(this.options.model, "OpenAI judge returned an invalid rubric result.");
      }

      return {
        status: "completed",
        model: this.options.model,
        promptVersion: input.promptVersion,
        ...parsed.data
      };
    } catch (error) {
      return createError(
        this.options.model,
        error instanceof Error && error.name === "AbortError"
          ? `OpenAI judge timed out after ${this.options.timeoutMs}ms.`
          : "OpenAI judge request failed."
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function createRubricJudgeInput(
  prompt: string,
  expectation: RubricJudgeExpectation,
  workspacePath: string,
  workspaceDiff: WorkspaceDiff
): Promise<RubricJudgeInput> {
  let remainingCharacters = MAX_TOTAL_ARTIFACT_CHARS;
  const artifacts: JudgeArtifact[] = [];

  for (const path of expectation.files) {
    const artifactPath = resolve(workspacePath, path);
    if (!isWorkspacePath(workspacePath, artifactPath)) {
      artifacts.push({ path, characters: 0, truncated: false, available: false, content: "" });
      continue;
    }

    try {
      const content = await readFile(artifactPath, "utf8");
      const maxCharacters = Math.min(MAX_ARTIFACT_CHARS, remainingCharacters);
      const truncated = content.length > maxCharacters;
      const visibleContent = content.slice(0, maxCharacters);
      remainingCharacters -= visibleContent.length;
      artifacts.push({
        path,
        characters: content.length,
        truncated,
        available: true,
        content: visibleContent
      });
    } catch {
      artifacts.push({ path, characters: 0, truncated: false, available: false, content: "" });
    }
  }

  return {
    promptVersion: PROMPT_VERSION,
    prompt,
    rubric: expectation.rubric,
    artifacts,
    workspaceDiff: {
      created: workspaceDiff.created,
      changed: workspaceDiff.changed,
      deleted: workspaceDiff.deleted,
      unchanged: workspaceDiff.unchanged
    }
  };
}

function createJudgePrompt(input: RubricJudgeInput): string {
  return JSON.stringify(
    {
      task: input.prompt,
      scoring: {
        instructions:
          "Score every rubric criterion from 0 to 100 using only the evidence. The overall score must be the weighted average of criterion scores, rounded to two decimals.",
        rubric: input.rubric
      },
      workspaceDiff: input.workspaceDiff,
      artifacts: input.artifacts.map(({ path, available, truncated, content }) => ({
        path,
        available,
        truncated,
        content
      }))
    },
    null,
    2
  );
}

function extractOutputText(response: unknown): string | undefined {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const candidate = response as { output_text?: unknown; output?: unknown };
  if (typeof candidate.output_text === "string") {
    return candidate.output_text;
  }

  if (!Array.isArray(candidate.output)) {
    return undefined;
  }

  for (const output of candidate.output) {
    if (!output || typeof output !== "object") {
      continue;
    }

    const content = (output as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const item of content) {
      if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
        return (item as { text: string }).text;
      }
    }
  }

  return undefined;
}

function hasExpectedCriteria(
  criteria: RubricCriterionScore[],
  rubric: RubricJudgeExpectation["rubric"]
): boolean {
  const expected = new Set(rubric.map((item) => item.criterion));
  return criteria.length === expected.size && criteria.every((item) => expected.has(item.criterion));
}

function createError(model: string | undefined, message: string): RubricJudgeError {
  return {
    status: "error",
    model,
    promptVersion: PROMPT_VERSION,
    message
  };
}

function isWorkspacePath(workspacePath: string, candidatePath: string): boolean {
  const pathToCandidate = relative(workspacePath, candidatePath);
  return pathToCandidate !== "" && !pathToCandidate.startsWith("..") && !pathToCandidate.includes("..\\");
}
