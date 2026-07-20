import { z } from "zod";

import { AgentSchema, SkillReferenceSchema } from "../config/config-schema.js";

const PathListSchema = z.array(z.string().min(1)).default([]);

export const CommandExpectationSchema = z
  .object({
    contains: z.string().min(1).optional(),
    exact: z.string().min(1).optional(),
    exit_code: z.number().int().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.contains && !value.exact) {
      context.addIssue({
        code: "custom",
        message: "command expectation must include either contains or exact"
      });
    }
  });

export const FileSnapshotExpectationSchema = z
  .object({
    path: z.string().min(1),
    snapshot: z.string().min(1)
  })
  .strict();

export const RubricCriterionSchema = z
  .object({
    criterion: z.string().min(1),
    description: z.string().min(1),
    weight: z.number().positive().default(1)
  })
  .strict();

export const RubricJudgeExpectationSchema = z
  .object({
    rubric: z.array(RubricCriterionSchema).min(1),
    min_score: z.number().min(0).max(100),
    files: z.array(z.string().min(1)).default([])
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();

    for (const item of value.rubric) {
      if (seen.has(item.criterion)) {
        context.addIssue({
          code: "custom",
          path: ["rubric"],
          message: `duplicate rubric criterion: ${item.criterion}`
        });
      }

      seen.add(item.criterion);
    }
  });

export const CaseExpectationSchema = z
  .object({
    skill_used: z.string().min(1).optional(),
    skill_not_used: z.string().min(1).optional(),
    commands: z.array(CommandExpectationSchema).default([]),
    commands_not_run: z.array(CommandExpectationSchema).default([]),
    commands_succeeded: z.boolean().optional(),
    files_created: PathListSchema,
    files_changed: PathListSchema,
    files_deleted: PathListSchema,
    files_unchanged: PathListSchema,
    file_snapshots: z.array(FileSnapshotExpectationSchema).default([]),
    judge: RubricJudgeExpectationSchema.optional(),
    exit_code: z.number().int().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.skill_used && value.skill_not_used && value.skill_used === value.skill_not_used) {
      context.addIssue({
        code: "custom",
        message: "skill_used and skill_not_used cannot reference the same skill"
      });
    }
  });

export const EvalCaseSchema = z
  .object({
    id: z.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    prompt: z.string().min(1),
    workspace: z
      .object({
        fixture: z.string().min(1).optional()
      })
      .strict()
      .default({}),
    expect: CaseExpectationSchema.default({
      commands: [],
      commands_not_run: [],
      files_created: [],
      files_changed: [],
      files_deleted: [],
      files_unchanged: [],
      file_snapshots: []
    })
  })
  .strict();

export const EvalSuiteSchema = z
  .object({
    name: z.string().min(1),
    agent: AgentSchema.default("codex"),
    skill: SkillReferenceSchema.optional(),
    cases: z.array(EvalCaseSchema).min(1)
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();

    for (const testCase of value.cases) {
      if (seen.has(testCase.id)) {
        context.addIssue({
          code: "custom",
          path: ["cases"],
          message: `duplicate case id: ${testCase.id}`
        });
      }

      seen.add(testCase.id);
    }
  });

export type CommandExpectation = z.infer<typeof CommandExpectationSchema>;
export type FileSnapshotExpectation = z.infer<typeof FileSnapshotExpectationSchema>;
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type RubricJudgeExpectation = z.infer<typeof RubricJudgeExpectationSchema>;
export type CaseExpectation = z.infer<typeof CaseExpectationSchema>;
export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalSuite = z.infer<typeof EvalSuiteSchema>;
