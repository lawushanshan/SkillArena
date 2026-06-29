import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { SkillArenaProject } from "../project/project.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import { hashDirectory, hashFile } from "./hash.js";

const execFileAsync = promisify(execFile);

export interface RunMetadata {
  skillarenaVersion: string;
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  codexVersion?: string;
  startedAt: string;
  command: string[];
  projectRoot: string;
  configPath: string;
  configHash: string;
  evals: Array<{
    path: string;
    hash: string;
  }>;
  skills: Array<{
    name: string;
    path: string;
    exists: boolean;
    hash?: string;
  }>;
  fixtures: Array<{
    path: string;
    hash: string;
  }>;
}

export interface CollectMetadataInput {
  project: SkillArenaProject;
  suites: LoadedEvalSuite[];
  startedAt: Date;
  command: string[];
  skillarenaVersion: string;
  detectCodexVersion?: boolean;
}

export async function collectRunMetadata(input: CollectMetadataInput): Promise<RunMetadata> {
  const fixturePaths = new Set<string>();

  for (const loadedSuite of input.suites) {
    for (const testCase of loadedSuite.suite.cases) {
      if (testCase.workspace.fixture) {
        fixturePaths.add(testCase.workspace.fixture);
      }
    }
  }

  return {
    skillarenaVersion: input.skillarenaVersion,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    codexVersion: input.detectCodexVersion === false ? undefined : await getCodexVersion(),
    startedAt: input.startedAt.toISOString(),
    command: input.command,
    projectRoot: input.project.root,
    configPath: input.project.configPath,
    configHash: await hashFile(input.project.configPath),
    evals: await Promise.all(
      input.suites.map(async (loadedSuite) => ({
        path: loadedSuite.path,
        hash: await hashFile(loadedSuite.path)
      }))
    ),
    skills: await Promise.all(
      input.project.config.skills.map(async (skill) => {
        const skillPath = resolve(input.project.root, skill.path);
        const exists = existsSync(skillPath);

        return {
          name: skill.name,
          path: skill.path,
          exists,
          hash: exists ? await hashDirectory(skillPath) : undefined
        };
      })
    ),
    fixtures: await Promise.all(
      [...fixturePaths].sort().map(async (fixturePath) => ({
        path: fixturePath,
        hash: await hashDirectory(resolve(input.project.root, fixturePath))
      }))
    )
  };
}

async function getCodexVersion(): Promise<string | undefined> {
  try {
    const result = await execFileAsync("codex", ["--version"], { timeout: 1000 });
    return result.stdout.trim() || result.stderr.trim() || undefined;
  } catch {
    return undefined;
  }
}
