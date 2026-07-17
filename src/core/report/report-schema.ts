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

export interface ReportCase {
  id: string;
  prompt: string;
  status: CaseStatus;
  workspace?: {
    path: string;
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
