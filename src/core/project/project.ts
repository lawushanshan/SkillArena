import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SkillArenaError } from "../errors.js";
import { loadConfig } from "../config/load-config.js";
import type { SkillArenaConfig } from "../config/config-schema.js";

export interface SkillArenaProject {
  root: string;
  configPath: string;
  config: SkillArenaConfig;
  evalsDir: string;
  fixturesDir: string;
  snapshotsDir: string;
  runsDir: string;
}

export function findProjectRoot(startDir: string): string | undefined {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(resolve(current, "skillarena.yaml"))) {
      return current;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export async function loadProject(startDir: string): Promise<SkillArenaProject> {
  const root = findProjectRoot(startDir);

  if (!root) {
    throw new SkillArenaError(
      "Could not find skillarena.yaml. Run `skillarena init` from your project root first."
    );
  }

  const configPath = resolve(root, "skillarena.yaml");
  const config = await loadConfig(configPath);

  return {
    root,
    configPath,
    config,
    evalsDir: resolve(root, config.paths.evals),
    fixturesDir: resolve(root, config.paths.fixtures),
    snapshotsDir: resolve(root, config.paths.snapshots),
    runsDir: resolve(root, config.paths.runs)
  };
}
