import { readFile } from "node:fs/promises";
import { parse } from "yaml";

import { SkillArenaError } from "../errors.js";
import { formatZodIssues } from "../schema/format-zod-error.js";
import { SkillArenaConfigSchema, type SkillArenaConfig } from "./config-schema.js";

export async function loadConfig(configPath: string): Promise<SkillArenaConfig> {
  let rawText: string;

  try {
    rawText = await readFile(configPath, "utf8");
  } catch (error) {
    throw new SkillArenaError(`Unable to read config file: ${configPath}\n${String(error)}`);
  }

  let raw: unknown;

  try {
    raw = parse(rawText);
  } catch (error) {
    throw new SkillArenaError(`Invalid YAML in config file: ${configPath}\n${String(error)}`);
  }

  const result = SkillArenaConfigSchema.safeParse(raw ?? {});

  if (!result.success) {
    throw new SkillArenaError(
      `Invalid SkillArena config: ${configPath}\n${formatZodIssues(result.error.issues)}`
    );
  }

  return result.data;
}

