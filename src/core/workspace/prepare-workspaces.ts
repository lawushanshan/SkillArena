import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { EvalCase } from "../eval/eval-schema.js";
import { SkillArenaError } from "../errors.js";
import { resolveFixturePath } from "../project/path-safety.js";
import type { SkillArenaProject } from "../project/project.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { RunStore } from "../run/run-store.js";
import { sanitizePathSegment } from "./sanitize-path-segment.js";

export interface PreparedWorkspace {
  suiteName: string;
  caseId: string;
  path: string;
  fixture?: string;
}

export async function prepareWorkspaces(
  project: SkillArenaProject,
  runStore: RunStore,
  suites: LoadedEvalSuite[]
): Promise<PreparedWorkspace[]> {
  const workspaces: PreparedWorkspace[] = [];

  for (const loadedSuite of suites) {
    for (const testCase of loadedSuite.selectedCases) {
      workspaces.push(await prepareCaseWorkspace(project, runStore, loadedSuite.suite.name, testCase));
    }
  }

  return workspaces;
}

async function prepareCaseWorkspace(
  project: SkillArenaProject,
  runStore: RunStore,
  suiteName: string,
  testCase: EvalCase
): Promise<PreparedWorkspace> {
  const workspacePath = resolve(
    runStore.workspacesDir,
    sanitizePathSegment(suiteName),
    sanitizePathSegment(testCase.id)
  );

  await mkdir(workspacePath, { recursive: true });

  if (!testCase.workspace.fixture) {
    return {
      suiteName,
      caseId: testCase.id,
      path: workspacePath
    };
  }

  const fixturePath = resolveFixturePath(project.root, project.fixturesDir, testCase.workspace.fixture);

  if (!existsSync(fixturePath)) {
    throw new SkillArenaError(
      `Fixture does not exist for case ${testCase.id}: ${testCase.workspace.fixture}`
    );
  }

  await cp(fixturePath, workspacePath, {
    recursive: true,
    force: false,
    errorOnExist: false
  });

  return {
    suiteName,
    caseId: testCase.id,
    path: workspacePath,
    fixture: testCase.workspace.fixture
  };
}
