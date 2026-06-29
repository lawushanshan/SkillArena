import { z } from "zod";

export const AgentSchema = z.enum(["codex"]);

export const SkillReferenceSchema = z
  .object({
    name: z.string().min(1),
    path: z.string().min(1)
  })
  .strict();

export const PathConfigSchema = z
  .object({
    evals: z.string().min(1).default("evals"),
    fixtures: z.string().min(1).default("fixtures"),
    runs: z.string().min(1).default(".skillarena/runs")
  })
  .strict();

export const SkillArenaConfigSchema = z
  .object({
    schemaVersion: z.literal("0.1").default("0.1"),
    agent: AgentSchema.default("codex"),
    paths: PathConfigSchema.default({
      evals: "evals",
      fixtures: "fixtures",
      runs: ".skillarena/runs"
    }),
    skills: z.array(SkillReferenceSchema).default([])
  })
  .strict();

export type AgentName = z.infer<typeof AgentSchema>;
export type SkillReference = z.infer<typeof SkillReferenceSchema>;
export type SkillArenaConfig = z.infer<typeof SkillArenaConfigSchema>;

