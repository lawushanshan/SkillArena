import type { RunMetadata } from "../metadata/metadata.js";

export type CheckStatus = "pass" | "fail" | "unsupported" | "warn";
export type CaseStatus = "pass" | "fail" | "blocked";
export type SuiteStatus = "pass" | "fail" | "blocked";
export type FailureCategory =
  | "setup_error"
  | "adapter_error"
  | "timeout"
  | "skill_not_triggered"
  | "skill_misfire"
  | "command_failed"
  | "artifact_mismatch"
  | "judge_failed";

export interface ReportCheck {
  name: string;
  status: CheckStatus;
  message: string;
  category?: FailureCategory;
}

export interface FailureTraceSummary {
  category?: FailureCategory;
  skillsRead: string[];
  failedCommands: Array<{
    command: string;
    exitCode?: number;
  }>;
  runErrors: string[];
  parseErrors: Array<{
    line: number;
    message: string;
  }>;
}

export interface ReportCase {
  id: string;
  prompt: string;
  status: CaseStatus;
  workspace?: {
    path: string;
    preserved: boolean;
    fixture?: string;
    skill?: {
      name: string;
      sourcePath: string;
      workspacePath: string;
    };
  };
  artifacts?: {
    rawTrace?: string;
    stderr?: string;
    parsedTrace?: string;
  };
  judge?: {
    status: "completed" | "error";
    model?: string;
    promptVersion: string;
    minimumScore: number;
    score?: number;
    summary?: string;
    criteria?: Array<{
      criterion: string;
      score: number;
      reason: string;
    }>;
    artifacts: Array<{
      path: string;
      characters: number;
      truncated: boolean;
      available: boolean;
    }>;
    error?: string;
  };
  failureTraceSummary?: FailureTraceSummary;
  checks: ReportCheck[];
}

export interface ReportSuite {
  name: string;
  path: string;
  status: SuiteStatus;
  cases: ReportCase[];
}

export interface SkillArenaReport {
  schemaVersion: "0.1";
  tool: "skillarena";
  mode: "dry-run" | "run";
  run: {
    id: string;
    dir: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  };
  metadata: RunMetadata;
  summary: {
    suites: number;
    cases: number;
    passed: number;
    failed: number;
    blocked: number;
    warnings: number;
  };
  suites: ReportSuite[];
  warnings: string[];
}
