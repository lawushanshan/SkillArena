import { cp, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { SkillReference } from "../config/config-schema.js";
import type { EvalCase } from "../eval/eval-schema.js";
import { SkillArenaError } from "../errors.js";
import { resolveFixturePath } from "../project/path-safety.js";
import type { SkillArenaProject } from "../project/project.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { RunStore } from "../run/run-store.js";
import { createStablePathSegment } from "./sanitize-path-segment.js";

export interface PreparedWorkspace {
  suiteName: string;
  caseId: string;
  path: string;
  fixture?: string;
  skill?: PreparedSkill;
}

export interface PreparedSkill {
  name: string;
  sourcePath: string;
  workspacePath: string;
}

export async function prepareWorkspaces(
  project: SkillArenaProject,
  runStore: RunStore,
  suites: LoadedEvalSuite[]
): Promise<PreparedWorkspace[]> {
  const workspaces: PreparedWorkspace[] = [];

  for (const loadedSuite of suites) {
    for (const testCase of loadedSuite.selectedCases) {
      workspaces.push(await prepareCaseWorkspace(project, runStore, loadedSuite, testCase));
    }
  }

  return workspaces;
}

async function prepareCaseWorkspace(
  project: SkillArenaProject,
  runStore: RunStore,
  loadedSuite: LoadedEvalSuite,
  testCase: EvalCase
): Promise<PreparedWorkspace> {
  const suiteName = loadedSuite.suite.name;
  const workspacePath = resolve(
    runStore.workspacesDir,
    createStablePathSegment(suiteName),
    createStablePathSegment(testCase.id)
  );

  await mkdir(workspacePath, { recursive: true });

  if (testCase.workspace.fixture) {
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
  }

  const skill = loadedSuite.suite.skill
    ? await provisionSkill(project.root, workspacePath, loadedSuite.suite.skill)
    : undefined;

  return {
    suiteName,
    caseId: testCase.id,
    path: workspacePath,
    fixture: testCase.workspace.fixture,
    skill
  };
}

async function provisionSkill(
  projectRoot: string,
  workspacePath: string,
  skill: SkillReference
): Promise<PreparedSkill> {
  const sourcePath = resolve(projectRoot, skill.path);

  if (!existsSync(sourcePath)) {
    throw new SkillArenaError(`Skill path does not exist: ${skill.path}`);
  }

  if (!(await stat(sourcePath)).isDirectory()) {
    throw new SkillArenaError(`Skill path must be a directory: ${skill.path}`);
  }

  if (!existsSync(resolve(sourcePath, "SKILL.md"))) {
    throw new SkillArenaError(`Skill directory must contain SKILL.md: ${skill.path}`);
  }

  const workspaceSkillPath = resolve(workspacePath, ".codex", "skills", skill.name);
  await mkdir(dirname(workspaceSkillPath), { recursive: true });
  await cp(sourcePath, workspaceSkillPath, {
    recursive: true,
    force: false,
    errorOnExist: true
  });

  return {
    name: skill.name,
    sourcePath,
    workspacePath: workspaceSkillPath
  };
}
