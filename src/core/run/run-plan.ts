import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { SkillArenaError } from "../errors.js";
import { loadEvalSuite } from "../eval/load-eval-suite.js";
import type { EvalCase, EvalSuite } from "../eval/eval-schema.js";
import { listEvalFiles } from "../project/list-eval-files.js";
import {
  isRelativeWorkspacePath,
  resolveEvalFilePath,
  resolveFixturePath,
  resolveSnapshotPath
} from "../project/path-safety.js";
import { loadProject, type SkillArenaProject } from "../project/project.js";

export interface RunSelectionOptions {
  cwd: string;
  evalFile?: string;
  suiteName?: string;
  caseId?: string;
  maxCases?: number;
}

export interface LoadedEvalSuite {
  path: string;
  suite: EvalSuite;
  selectedCases: EvalCase[];
  selectedCaseCount: number;
}

export interface RunPlan {
  project: SkillArenaProject;
  suites: LoadedEvalSuite[];
  totalCases: number;
  warnings: string[];
}

export async function createRunPlan(options: RunSelectionOptions): Promise<RunPlan> {
  const project = await loadProject(options.cwd);
  const evalFiles = await resolveEvalFiles(project, options);
  const suites: LoadedEvalSuite[] = [];
  const warnings: string[] = [];
  let totalCases = 0;
  let matchedSuite = false;

  if (evalFiles.length === 0) {
    throw new SkillArenaError(`No eval files found in ${project.evalsDir}`);
  }

  for (const evalPath of evalFiles) {
    const suite = await loadEvalSuite(evalPath);

    if (options.suiteName && suite.name !== options.suiteName) {
      continue;
    }

    matchedSuite = true;

    const candidateCases = options.caseId
      ? suite.cases.filter((testCase) => testCase.id === options.caseId)
      : suite.cases;
    const remainingCases =
      options.maxCases === undefined ? undefined : Math.max(options.maxCases - totalCases, 0);
    const selectedCases =
      remainingCases === undefined ? candidateCases : candidateCases.slice(0, remainingCases);

    if (options.caseId && candidateCases.length === 0) {
      continue;
    }

    if (selectedCases.length === 0) {
      break;
    }

    validateReferences(project, suite, selectedCases, warnings);

    suites.push({
      path: evalPath,
      suite,
      selectedCases,
      selectedCaseCount: selectedCases.length
    });
    totalCases += selectedCases.length;
  }

  if (options.suiteName && !matchedSuite) {
    throw new SkillArenaError(`No eval suite found with name: ${options.suiteName}`);
  }

  if (options.caseId && totalCases === 0) {
    throw new SkillArenaError(`No eval case found with id: ${options.caseId}`);
  }

  return {
    project,
    suites,
    totalCases,
    warnings
  };
}

async function resolveEvalFiles(
  project: SkillArenaProject,
  options: RunSelectionOptions
): Promise<string[]> {
  if (options.evalFile) {
    return [resolveEvalFilePath(options.cwd, project.root, project.evalsDir, options.evalFile)];
  }

  if (!existsSync(project.evalsDir)) {
    throw new SkillArenaError(`Eval directory does not exist: ${project.evalsDir}`);
  }

  return listEvalFiles(project.evalsDir);
}

function validateReferences(
  project: SkillArenaProject,
  suite: EvalSuite,
  selectedCases: EvalCase[],
  warnings: string[]
): void {
  if (suite.skill) {
    const skillPath = resolve(project.root, suite.skill.path);

    if (!existsSync(skillPath)) {
      warnings.push(`Skill path does not exist yet: ${suite.skill.path}`);
    }
  }

  for (const testCase of selectedCases) {
    for (const expectation of testCase.expect.file_snapshots) {
      if (!isRelativeWorkspacePath(expectation.path)) {
        throw new SkillArenaError(
          `Snapshot target path must be relative to the workspace: ${expectation.path}`
        );
      }

      const snapshotPath = resolveSnapshotPath(project.snapshotsDir, expectation.snapshot);

      if (!existsSync(snapshotPath)) {
        throw new SkillArenaError(
          `Snapshot does not exist for case ${testCase.id}: ${expectation.snapshot}`
        );
      }
    }

    for (const path of testCase.expect.judge?.files ?? []) {
      if (!isRelativeWorkspacePath(path)) {
        throw new SkillArenaError(
          `Judge artifact path must be relative to the workspace: ${path}`
        );
      }
    }

    if (!testCase.workspace.fixture) {
      continue;
    }

    const fixturePath = resolveFixturePath(
      project.root,
      project.fixturesDir,
      testCase.workspace.fixture
    );

    if (!existsSync(fixturePath)) {
      throw new SkillArenaError(
        `Fixture does not exist for case ${testCase.id}: ${testCase.workspace.fixture}`
      );
    }
  }
}
