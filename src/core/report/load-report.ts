import { readFile } from "node:fs/promises";
import { z } from "zod";

import { SkillArenaError } from "../errors.js";
import { formatZodIssues } from "../schema/format-zod-error.js";
import type { SkillArenaReport } from "./report-schema.js";

const ReportSchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    tool: z.literal("skillarena"),
    mode: z.enum(["dry-run", "run"]),
    run: z
      .object({
        id: z.string(),
        dir: z.string(),
        startedAt: z.string(),
        finishedAt: z.string(),
        durationMs: z.number()
      })
      .passthrough(),
    metadata: z.object({}).passthrough(),
    summary: z
      .object({
        suites: z.number(),
        cases: z.number(),
        passed: z.number(),
        failed: z.number(),
        blocked: z.number(),
        warnings: z.number()
      })
      .passthrough(),
    suites: z.array(z.object({}).passthrough()),
    warnings: z.array(z.string())
  })
  .passthrough();

export async function loadReport(reportPath: string): Promise<SkillArenaReport> {
  let rawText: string;

  try {
    rawText = await readFile(reportPath, "utf8");
  } catch (error) {
    throw new SkillArenaError(`Unable to read report file: ${reportPath}\n${String(error)}`);
  }

  let raw: unknown;

  try {
    raw = JSON.parse(rawText);
  } catch (error) {
    throw new SkillArenaError(`Invalid JSON report: ${reportPath}\n${String(error)}`);
  }

  const result = ReportSchema.safeParse(raw);

  if (!result.success) {
    throw new SkillArenaError(
      `Invalid SkillArena report: ${reportPath}\n${formatZodIssues(result.error.issues)}`
    );
  }

  return result.data as unknown as SkillArenaReport;
}
