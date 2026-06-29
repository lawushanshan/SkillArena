import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { SkillArenaError } from "../errors.js";
import { loadEvalSuite } from "../eval/load-eval-suite.js";
import type { EvalCase, EvalSuite } from "../eval/eval-schema.js";
import { collectRunMetadata } from "../metadata/metadata.js";
import { listEvalFiles } from "../project/list-eval-files.js";
import { loadProject, type SkillArenaProject } from "../project/project.js";
import { createDryRunReport } from "../report/create-dry-run-report.js";
import type { SkillArenaReport } from "../report/report-schema.js";
import { writeReport } from "../report/write-report.js";
import { createRunStore, type RunStore } from "./run-store.js";

export interface DryRunOptions {
  cwd: string;
  evalFile?: string;
  caseId?: string;
  command?: string[];
  skillarenaVersion: string;
}

export interface LoadedEvalSuite {
  path: string;
  suite: EvalSuite;
  selectedCases: EvalCase[];
  selectedCaseCount: number;
}

export interface DryRunResult {
  project: SkillArenaProject;
  runStore: RunStore;
  report: SkillArenaReport;
  suites: LoadedEvalSuite[];
  totalCases: number;
  warnings: string[];
}

export async function runDryRun(options: DryRunOptions): Promise<DryRunResult> {
  const startedAt = new Date();
  const project = await loadProject(options.cwd);
  const evalFiles = await resolveEvalFiles(project, options);
  const suites: LoadedEvalSuite[] = [];
  const warnings: string[] = [];
  let totalCases = 0;

  if (evalFiles.length === 0) {
    throw new SkillArenaError(`No eval files found in ${project.evalsDir}`);
  }

  for (const evalPath of evalFiles) {
    const suite = await loadEvalSuite(evalPath);
    const selectedCases = options.caseId
      ? suite.cases.filter((testCase) => testCase.id === options.caseId)
      : suite.cases;

    if (options.caseId && selectedCases.length === 0) {
      continue;
    }

    validateReferences(project, suite, warnings);

    suites.push({
      path: evalPath,
      suite,
      selectedCases,
      selectedCaseCount: selectedCases.length
    });
    totalCases += selectedCases.length;
  }

  if (options.caseId && totalCases === 0) {
    throw new SkillArenaError(`No eval case found with id: ${options.caseId}`);
  }

  const runStore = await createRunStore(project);
  const metadata = await collectRunMetadata({
    project,
    suites,
    startedAt,
    command: options.command ?? [],
    skillarenaVersion: options.skillarenaVersion
  });
  const finishedAt = new Date();
  const report = createDryRunReport({
    runId: runStore.runId,
    runDir: runStore.runDir,
    startedAt,
    finishedAt,
    metadata,
    suites,
    warnings
  });

  await writeReport(runStore, report);

  return {
    project,
    runStore,
    report,
    suites,
    totalCases,
    warnings
  };
}

async function resolveEvalFiles(project: SkillArenaProject, options: DryRunOptions): Promise<string[]> {
  if (options.evalFile) {
    return [resolve(options.cwd, options.evalFile)];
  }

  if (!existsSync(project.evalsDir)) {
    throw new SkillArenaError(`Eval directory does not exist: ${project.evalsDir}`);
  }

  return listEvalFiles(project.evalsDir);
}

function validateReferences(
  project: SkillArenaProject,
  suite: EvalSuite,
  warnings: string[]
): void {
  if (suite.skill) {
    const skillPath = resolve(project.root, suite.skill.path);

    if (!existsSync(skillPath)) {
      warnings.push(`Skill path does not exist yet: ${suite.skill.path}`);
    }
  }

  for (const testCase of suite.cases) {
    if (!testCase.workspace.fixture) {
      continue;
    }

    const fixturePath = resolve(project.root, testCase.workspace.fixture);

    if (!existsSync(fixturePath)) {
      throw new SkillArenaError(
        `Fixture does not exist for case ${testCase.id}: ${testCase.workspace.fixture}`
      );
    }
  }
}
