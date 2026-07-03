import type { CodexExecResult } from "../../adapters/codex/codex-adapter.js";
import type { EvalCase } from "../eval/eval-schema.js";
import type { ReportCheck } from "../report/report-schema.js";
import type { ParsedTrace } from "../trace/normalized-events.js";
import type { WorkspaceDiff } from "../workspace/workspace-snapshot.js";

export interface GradeCaseInput {
  testCase: EvalCase;
  codex: CodexExecResult;
  parsedTrace?: ParsedTrace;
  workspaceDiff?: WorkspaceDiff;
}

export function gradeDeterministicExpectations(input: GradeCaseInput): ReportCheck[] {
  const checks: ReportCheck[] = [];
  const expect = input.testCase.expect;

  if (expect.exit_code !== undefined) {
    checks.push({
      name: "expect.exit_code",
      status: input.codex.exitCode === expect.exit_code ? "pass" : "fail",
      message: `expected=${expect.exit_code}, actual=${input.codex.exitCode ?? "null"}`,
      category: input.codex.exitCode === expect.exit_code ? undefined : "adapter_error"
    });
  }

  if (expect.commands_succeeded !== undefined) {
    const commandFailures = getCommandFinishedEvents(input.parsedTrace).filter(
      (event) => event.exitCode !== undefined && event.exitCode !== 0
    );
    checks.push({
      name: "expect.commands_succeeded",
      status:
        expect.commands_succeeded && commandFailures.length === 0
          ? "pass"
          : !expect.commands_succeeded && commandFailures.length > 0
            ? "pass"
            : "fail",
      message: `failedCommands=${commandFailures.length}`,
      category: commandFailures.length === 0 ? undefined : "command_failed"
    });
  }

  if (expect.skill_used) {
    const expectedSkill = expect.skill_used;
    const matched = getSkillReadEvents(input.parsedTrace).some((event) =>
      matchesSkill(event.skillName, event.path, expectedSkill)
    );
    checks.push({
      name: "expect.skill_used",
      status: matched ? "pass" : "fail",
      message: matched
        ? `Skill was observed: ${expect.skill_used}`
        : `Skill was not observed: ${expect.skill_used}`,
      category: matched ? undefined : "skill_not_triggered"
    });
  }

  if (expect.skill_not_used) {
    const expectedSkill = expect.skill_not_used;
    const matched = getSkillReadEvents(input.parsedTrace).some((event) =>
      matchesSkill(event.skillName, event.path, expectedSkill)
    );
    checks.push({
      name: "expect.skill_not_used",
      status: matched ? "fail" : "pass",
      message: matched
        ? `Skill was unexpectedly observed: ${expect.skill_not_used}`
        : `Skill was not observed: ${expect.skill_not_used}`,
      category: matched ? "skill_misfire" : undefined
    });
  }

  for (const [index, commandExpectation] of (expect.commands ?? []).entries()) {
    const matched =
      commandExpectation.exit_code === undefined
        ? [...getCommandStartedEvents(input.parsedTrace), ...getCommandFinishedEvents(input.parsedTrace)].some(
            (event) => commandMatchesExpectation(event.command, commandExpectation)
          )
        : getCommandFinishedEvents(input.parsedTrace).some(
            (event) =>
              commandMatchesExpectation(event.command, commandExpectation) &&
              event.exitCode === commandExpectation.exit_code
          );

    checks.push({
      name: `expect.commands[${index}]`,
      status: matched ? "pass" : "fail",
      message: matched ? "Command expectation matched." : "Command expectation did not match.",
      category: matched ? undefined : "command_failed"
    });
  }

  checks.push(...gradeFileList("expect.files_created", expect.files_created, input.workspaceDiff?.created));
  checks.push(...gradeFileList("expect.files_changed", expect.files_changed, input.workspaceDiff?.changed));
  checks.push(...gradeFileList("expect.files_deleted", expect.files_deleted, input.workspaceDiff?.deleted));
  checks.push(
    ...gradeFileList("expect.files_unchanged", expect.files_unchanged, input.workspaceDiff?.unchanged)
  );

  return checks;
}

function gradeFileList(name: string, expectedPaths: string[], actualPaths: string[] | undefined): ReportCheck[] {
  if (expectedPaths.length === 0) {
    return [];
  }

  if (!actualPaths) {
    return [
      {
        name,
        status: "fail",
        message: "Workspace diff is not available.",
        category: "artifact_mismatch"
      }
    ];
  }

  const actualSet = new Set(actualPaths.map(normalizePath));
  const missing = expectedPaths.filter((path) => !actualSet.has(normalizePath(path)));

  return [
    {
      name,
      status: missing.length === 0 ? "pass" : "fail",
      message:
        missing.length === 0
          ? `Matched ${expectedPaths.length} expected path(s).`
          : `Missing expected path(s): ${missing.join(", ")}`,
      category: missing.length === 0 ? undefined : "artifact_mismatch"
    }
  ];
}

function getSkillReadEvents(parsedTrace: ParsedTrace | undefined) {
  return parsedTrace?.events.filter((event) => event.type === "skill_read") ?? [];
}

function getCommandStartedEvents(parsedTrace: ParsedTrace | undefined) {
  return parsedTrace?.events.filter((event) => event.type === "command_started") ?? [];
}

function getCommandFinishedEvents(parsedTrace: ParsedTrace | undefined) {
  return parsedTrace?.events.filter((event) => event.type === "command_finished") ?? [];
}

function matchesSkill(skillName: string | undefined, path: string | undefined, expected: string): boolean {
  const normalizedExpected = expected.toLowerCase();
  return Boolean(
    skillName?.toLowerCase() === normalizedExpected ||
      path?.toLowerCase().includes(`/${normalizedExpected}/skill.md`) ||
      path?.toLowerCase().includes(`\\${normalizedExpected}\\skill.md`)
  );
}

function commandMatchesExpectation(
  command: string | undefined,
  expectation: { contains?: string; exact?: string }
): boolean {
  const value = command ?? "";
  return expectation.exact ? value === expectation.exact : value.includes(expectation.contains ?? "");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
