import { collectRunMetadata } from "../metadata/metadata.js";
import { loadProject, type SkillArenaProject } from "../project/project.js";
import { createDryRunReport } from "../report/create-dry-run-report.js";
import type { SkillArenaReport } from "../report/report-schema.js";
import { writeReport } from "../report/write-report.js";
import { prepareWorkspaces, type PreparedWorkspace } from "../workspace/prepare-workspaces.js";
import { createRunPlan, type LoadedEvalSuite } from "./run-plan.js";
import { createRunStore, type RunStore } from "./run-store.js";

export interface DryRunOptions {
  cwd: string;
  evalFile?: string;
  caseId?: string;
  command?: string[];
  skillarenaVersion: string;
}

export interface DryRunResult {
  project: SkillArenaProject;
  runStore: RunStore;
  report: SkillArenaReport;
  workspaces: PreparedWorkspace[];
  suites: LoadedEvalSuite[];
  totalCases: number;
  warnings: string[];
}

export async function runDryRun(options: DryRunOptions): Promise<DryRunResult> {
  const startedAt = new Date();
  const { project, suites, totalCases, warnings } = await createRunPlan(options);

  const runStore = await createRunStore(project);
  const workspaces = await prepareWorkspaces(project, runStore, suites);
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
    workspaces,
    warnings
  });

  await writeReport(runStore, report);

  return {
    project,
    runStore,
    report,
    workspaces,
    suites,
    totalCases,
    warnings
  };
}
