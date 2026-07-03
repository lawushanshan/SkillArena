import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { SkillArenaError } from "../errors.js";
import { loadProject } from "../project/project.js";
import { loadReport } from "../report/load-report.js";
import type { ReportCase, ReportCheck, SkillArenaReport } from "../report/report-schema.js";

export interface CompareRunsOptions {
  cwd: string;
  baselineRunDir?: string;
  candidateRunDir?: string;
}

export interface RunComparisonMetrics {
  runId: string;
  runDir: string;
  cases: number;
  passed: number;
  failed: number;
  blocked: number;
  passRate: number;
  triggerRate: number;
  falsePositiveRate: number;
  durationMs: number;
  skillUsedChecks: CheckMetrics;
  skillNotUsedChecks: CheckMetrics;
}

export interface CheckMetrics {
  total: number;
  passed: number;
  failed: number;
}

export interface CaseStatusComparison {
  common: number;
  improved: number;
  regressed: number;
  unchanged: number;
  added: number;
  removed: number;
  improvedCases: CaseStatusChange[];
  regressedCases: CaseStatusChange[];
  addedCases: CaseStatusChange[];
  removedCases: CaseStatusChange[];
}

export interface CaseStatusChange {
  suiteName: string;
  caseId: string;
  baselineStatus?: ReportCase["status"];
  candidateStatus?: ReportCase["status"];
}

export interface RunComparison {
  verdict: ComparisonVerdict;
  hasRegression: boolean;
  baseline: RunComparisonMetrics;
  candidate: RunComparisonMetrics;
  delta: {
    passRatePoints: number;
    triggerRatePoints: number;
    falsePositiveRatePoints: number;
    passed: number;
    failed: number;
    blocked: number;
    durationMs: number;
    skillUsedPassed: number;
    skillUsedFailed: number;
    skillNotUsedPassed: number;
    skillNotUsedFailed: number;
  };
  cases: CaseStatusComparison;
}

export type ComparisonVerdict = "improved" | "regressed" | "mixed" | "unchanged";

export async function runCompareCommand(options: CompareRunsOptions): Promise<RunComparison> {
  const runDirs = await resolveComparisonRunDirs(options);
  const baseline = await loadRunReport(runDirs.baselineRunDir);
  const candidate = await loadRunReport(runDirs.candidateRunDir);

  return compareReports(baseline, candidate);
}

export function compareReports(
  baseline: SkillArenaReport,
  candidate: SkillArenaReport
): RunComparison {
  const baselineMetrics = createRunMetrics(baseline);
  const candidateMetrics = createRunMetrics(candidate);
  const caseComparison = compareCaseStatuses(baseline, candidate);
  const delta = {
    passRatePoints: candidateMetrics.passRate - baselineMetrics.passRate,
    triggerRatePoints: candidateMetrics.triggerRate - baselineMetrics.triggerRate,
    falsePositiveRatePoints:
      candidateMetrics.falsePositiveRate - baselineMetrics.falsePositiveRate,
    passed: candidateMetrics.passed - baselineMetrics.passed,
    failed: candidateMetrics.failed - baselineMetrics.failed,
    blocked: candidateMetrics.blocked - baselineMetrics.blocked,
    durationMs: candidateMetrics.durationMs - baselineMetrics.durationMs,
    skillUsedPassed:
      candidateMetrics.skillUsedChecks.passed - baselineMetrics.skillUsedChecks.passed,
    skillUsedFailed:
      candidateMetrics.skillUsedChecks.failed - baselineMetrics.skillUsedChecks.failed,
    skillNotUsedPassed:
      candidateMetrics.skillNotUsedChecks.passed - baselineMetrics.skillNotUsedChecks.passed,
    skillNotUsedFailed:
      candidateMetrics.skillNotUsedChecks.failed - baselineMetrics.skillNotUsedChecks.failed
  };
  const verdict = determineVerdict(delta, caseComparison);

  return {
    verdict,
    hasRegression: verdict === "regressed" || verdict === "mixed",
    baseline: baselineMetrics,
    candidate: candidateMetrics,
    delta,
    cases: caseComparison
  };
}

export function renderCompareSummary(comparison: RunComparison): string {
  return [
    "SkillArena compare",
    `Verdict: ${comparison.verdict}`,
    `Baseline: ${comparison.baseline.runId}`,
    `Candidate: ${comparison.candidate.runId}`,
    `Pass rate: ${formatPercent(comparison.baseline.passRate)} -> ${formatPercent(
      comparison.candidate.passRate
    )} (${formatSignedPercentPoints(comparison.delta.passRatePoints)})`,
    `Trigger rate: ${formatPercent(comparison.baseline.triggerRate)} -> ${formatPercent(
      comparison.candidate.triggerRate
    )} (${formatSignedPercentPoints(comparison.delta.triggerRatePoints)})`,
    `False-positive rate: ${formatPercent(
      comparison.baseline.falsePositiveRate
    )} -> ${formatPercent(comparison.candidate.falsePositiveRate)} (${formatSignedPercentPoints(
      comparison.delta.falsePositiveRatePoints
    )})`,
    `Passed: ${comparison.baseline.passed} -> ${comparison.candidate.passed} (${formatSignedInteger(
      comparison.delta.passed
    )})`,
    `Failed: ${comparison.baseline.failed} -> ${comparison.candidate.failed} (${formatSignedInteger(
      comparison.delta.failed
    )})`,
    `Blocked: ${comparison.baseline.blocked} -> ${comparison.candidate.blocked} (${formatSignedInteger(
      comparison.delta.blocked
    )})`,
    `Case changes: ${comparison.cases.improved} improved, ${comparison.cases.regressed} regressed, ${comparison.cases.unchanged} unchanged, ${comparison.cases.added} added, ${comparison.cases.removed} removed`,
    `Skill used checks passed: ${comparison.baseline.skillUsedChecks.passed}/${comparison.baseline.skillUsedChecks.total} -> ${comparison.candidate.skillUsedChecks.passed}/${comparison.candidate.skillUsedChecks.total} (${formatSignedInteger(
      comparison.delta.skillUsedPassed
    )})`,
    `Skill misfire checks passed: ${comparison.baseline.skillNotUsedChecks.passed}/${comparison.baseline.skillNotUsedChecks.total} -> ${comparison.candidate.skillNotUsedChecks.passed}/${comparison.candidate.skillNotUsedChecks.total} (${formatSignedInteger(
      comparison.delta.skillNotUsedPassed
    )})`,
    `Duration: ${comparison.baseline.durationMs}ms -> ${comparison.candidate.durationMs}ms (${formatSignedInteger(
      comparison.delta.durationMs
    )}ms)`,
    ...formatCaseChangeLines("Improved cases", comparison.cases.improvedCases),
    ...formatCaseChangeLines("Regressed cases", comparison.cases.regressedCases),
    ...formatCaseChangeLines("Added cases", comparison.cases.addedCases),
    ...formatCaseChangeLines("Removed cases", comparison.cases.removedCases)
  ].join("\n");
}

async function resolveComparisonRunDirs(options: CompareRunsOptions): Promise<{
  baselineRunDir: string;
  candidateRunDir: string;
}> {
  if (options.baselineRunDir && options.candidateRunDir) {
    return {
      baselineRunDir: await resolveRunDir(options.cwd, options.baselineRunDir),
      candidateRunDir: await resolveRunDir(options.cwd, options.candidateRunDir)
    };
  }

  if (options.baselineRunDir || options.candidateRunDir) {
    throw new SkillArenaError(
      "Compare requires both baseline and candidate run directories, or neither to compare the latest two runs."
    );
  }

  return resolveLatestTwoRunDirs(options.cwd);
}

async function resolveRunDir(cwd: string, runDirOrId: string): Promise<string> {
  const cwdCandidate = resolve(cwd, runDirOrId);

  if (existsSync(resolve(cwdCandidate, "report.json"))) {
    return cwdCandidate;
  }

  const project = await loadProject(cwd);
  const projectRunCandidate = resolve(project.runsDir, runDirOrId);

  if (existsSync(resolve(projectRunCandidate, "report.json"))) {
    return projectRunCandidate;
  }

  return cwdCandidate;
}

async function resolveLatestTwoRunDirs(cwd: string): Promise<{
  baselineRunDir: string;
  candidateRunDir: string;
}> {
  const project = await loadProject(cwd);

  if (!existsSync(project.runsDir)) {
    throw new SkillArenaError(`Run directory does not exist: ${project.runsDir}`);
  }

  const entries = await readdir(project.runsDir, { withFileTypes: true });
  const runDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(project.runsDir, entry.name))
    .filter((runDir) => existsSync(resolve(runDir, "report.json")))
    .sort();

  if (runDirs.length < 2) {
    throw new SkillArenaError(
      `Need at least two SkillArena runs to compare. Found ${runDirs.length} in ${project.runsDir}`
    );
  }

  return {
    baselineRunDir: runDirs[runDirs.length - 2]!,
    candidateRunDir: runDirs[runDirs.length - 1]!
  };
}

async function loadRunReport(runDir: string): Promise<SkillArenaReport> {
  const reportPath = resolve(runDir, "report.json");

  if (!existsSync(reportPath)) {
    throw new SkillArenaError(`report.json does not exist: ${reportPath}`);
  }

  return loadReport(reportPath);
}

function createRunMetrics(report: SkillArenaReport): RunComparisonMetrics {
  const allChecks = report.suites.flatMap((suite) =>
    suite.cases.flatMap((testCase) => testCase.checks)
  );

  const skillUsedChecks = createCheckMetrics(allChecks, "expect.skill_used");
  const skillNotUsedChecks = createCheckMetrics(allChecks, "expect.skill_not_used");

  return {
    runId: report.run.id,
    runDir: report.run.dir,
    cases: report.summary.cases,
    passed: report.summary.passed,
    failed: report.summary.failed,
    blocked: report.summary.blocked,
    passRate: report.summary.cases === 0 ? 0 : report.summary.passed / report.summary.cases,
    triggerRate: skillUsedChecks.total === 0 ? 0 : skillUsedChecks.passed / skillUsedChecks.total,
    falsePositiveRate:
      skillNotUsedChecks.total === 0 ? 0 : skillNotUsedChecks.failed / skillNotUsedChecks.total,
    durationMs: report.run.durationMs,
    skillUsedChecks,
    skillNotUsedChecks
  };
}

function determineVerdict(
  delta: RunComparison["delta"],
  cases: CaseStatusComparison
): ComparisonVerdict {
  const hasPositiveSignal =
    delta.passRatePoints > 0 ||
    delta.triggerRatePoints > 0 ||
    delta.falsePositiveRatePoints < 0 ||
    cases.improved > 0;
  const hasNegativeSignal =
    delta.passRatePoints < 0 ||
    delta.triggerRatePoints < 0 ||
    delta.falsePositiveRatePoints > 0 ||
    cases.regressed > 0;

  if (hasPositiveSignal && hasNegativeSignal) {
    return "mixed";
  }

  if (hasNegativeSignal) {
    return "regressed";
  }

  if (hasPositiveSignal) {
    return "improved";
  }

  return "unchanged";
}

function createCheckMetrics(checks: ReportCheck[], name: string): CheckMetrics {
  const matching = checks.filter((check) => check.name === name);

  return {
    total: matching.length,
    passed: matching.filter((check) => check.status === "pass").length,
    failed: matching.filter((check) => check.status === "fail").length
  };
}

function compareCaseStatuses(
  baseline: SkillArenaReport,
  candidate: SkillArenaReport
): CaseStatusComparison {
  const baselineCases = createCaseStatusMap(baseline);
  const candidateCases = createCaseStatusMap(candidate);
  let common = 0;
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  const improvedCases: CaseStatusChange[] = [];
  const regressedCases: CaseStatusChange[] = [];

  for (const [key, baselineCaseRef] of baselineCases) {
    const candidateCaseRef = candidateCases.get(key);

    if (!candidateCaseRef) {
      continue;
    }

    common += 1;

    const baselineScore = statusScore(baselineCaseRef.testCase.status);
    const candidateScore = statusScore(candidateCaseRef.testCase.status);

    if (candidateScore > baselineScore) {
      improved += 1;
      improvedCases.push(createCaseStatusChange(baselineCaseRef, candidateCaseRef));
    } else if (candidateScore < baselineScore) {
      regressed += 1;
      regressedCases.push(createCaseStatusChange(baselineCaseRef, candidateCaseRef));
    } else {
      unchanged += 1;
    }
  }

  const addedCases = [...candidateCases.entries()]
    .filter(([key]) => !baselineCases.has(key))
    .map(([, candidateCaseRef]) => createCaseStatusChange(undefined, candidateCaseRef));
  const removedCases = [...baselineCases.entries()]
    .filter(([key]) => !candidateCases.has(key))
    .map(([, baselineCaseRef]) => createCaseStatusChange(baselineCaseRef, undefined));

  return {
    common,
    improved,
    regressed,
    unchanged,
    added: addedCases.length,
    removed: removedCases.length,
    improvedCases,
    regressedCases,
    addedCases,
    removedCases
  };
}

interface CaseRef {
  suiteName: string;
  testCase: ReportCase;
}

function createCaseStatusMap(report: SkillArenaReport): Map<string, CaseRef> {
  const cases = new Map<string, CaseRef>();

  for (const suite of report.suites) {
    for (const testCase of suite.cases) {
      cases.set(`${suite.name}\0${testCase.id}`, {
        suiteName: suite.name,
        testCase
      });
    }
  }

  return cases;
}

function createCaseStatusChange(
  baselineCaseRef: CaseRef | undefined,
  candidateCaseRef: CaseRef | undefined
): CaseStatusChange {
  const caseRef = candidateCaseRef ?? baselineCaseRef;

  if (!caseRef) {
    throw new SkillArenaError("Cannot create a case status change without a case.");
  }

  return {
    suiteName: caseRef.suiteName,
    caseId: caseRef.testCase.id,
    baselineStatus: baselineCaseRef?.testCase.status,
    candidateStatus: candidateCaseRef?.testCase.status
  };
}

function statusScore(status: ReportCase["status"]): number {
  if (status === "pass") {
    return 2;
  }

  if (status === "fail") {
    return 1;
  }

  return 0;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercentPoints(value: number): string {
  return `${formatSignedNumber(value * 100)} pp`;
}

function formatSignedInteger(value: number): string {
  return formatSignedNumber(value);
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatCaseChangeLines(label: string, changes: CaseStatusChange[]): string[] {
  if (changes.length === 0) {
    return [];
  }

  return [
    `${label}:`,
    ...changes.map((change) => {
      const baselineStatus = change.baselineStatus ?? "none";
      const candidateStatus = change.candidateStatus ?? "none";
      return `  - ${change.suiteName}/${change.caseId}: ${baselineStatus} -> ${candidateStatus}`;
    })
  ];
}
