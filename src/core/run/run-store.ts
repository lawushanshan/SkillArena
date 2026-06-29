import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { SkillArenaProject } from "../project/project.js";
import { createRunId } from "./run-id.js";

export interface RunStore {
  runId: string;
  runDir: string;
  rawDir: string;
  parsedDir: string;
  workspacesDir: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
}

export async function createRunStore(project: SkillArenaProject): Promise<RunStore> {
  const runId = createRunId();
  const runDir = resolve(project.runsDir, runId);
  const rawDir = resolve(runDir, "raw");
  const parsedDir = resolve(runDir, "parsed");
  const workspacesDir = resolve(runDir, "workspaces");

  await mkdir(rawDir, { recursive: true });
  await mkdir(parsedDir, { recursive: true });
  await mkdir(workspacesDir, { recursive: true });

  return {
    runId,
    runDir,
    rawDir,
    parsedDir,
    workspacesDir,
    reportJsonPath: resolve(runDir, "report.json"),
    reportMarkdownPath: resolve(runDir, "report.md")
  };
}

export async function writeRunFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, "utf8");
}
