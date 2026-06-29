import { readFile } from "node:fs/promises";
import { parse } from "yaml";

import { SkillArenaError } from "../errors.js";
import { formatZodIssues } from "../schema/format-zod-error.js";
import { EvalSuiteSchema, type EvalSuite } from "./eval-schema.js";

export async function loadEvalSuite(evalPath: string): Promise<EvalSuite> {
  let rawText: string;

  try {
    rawText = await readFile(evalPath, "utf8");
  } catch (error) {
    throw new SkillArenaError(`Unable to read eval file: ${evalPath}\n${String(error)}`);
  }

  let raw: unknown;

  try {
    raw = parse(rawText);
  } catch (error) {
    throw new SkillArenaError(`Invalid YAML in eval file: ${evalPath}\n${String(error)}`);
  }

  const result = EvalSuiteSchema.safeParse(raw);

  if (!result.success) {
    throw new SkillArenaError(
      `Invalid eval suite: ${evalPath}\n${formatZodIssues(result.error.issues)}`
    );
  }

  return result.data;
}

