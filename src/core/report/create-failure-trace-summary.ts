import type { ParsedTrace } from "../trace/normalized-events.js";
import type { FailureCategory, FailureTraceSummary, ReportCheck } from "./report-schema.js";

const MAX_SUMMARY_ITEMS = 5;

export function createFailureTraceSummary(
  checks: ReportCheck[],
  parsedTrace: ParsedTrace | undefined
): FailureTraceSummary | undefined {
  const failedCheck = checks.find((check) => check.status === "fail");

  if (!failedCheck) {
    return undefined;
  }

  const events = parsedTrace?.events ?? [];
  const skillsRead = unique(
    events
      .filter((event) => event.type === "skill_read")
      .map((event) => event.skillName ?? event.path ?? "unknown skill")
  );
  const failedCommands = events
    .flatMap((event) =>
      event.type === "command_finished" && event.exitCode !== undefined && event.exitCode !== 0
        ? [{ command: event.command ?? "unknown command", exitCode: event.exitCode }]
        : []
    )
    .slice(0, MAX_SUMMARY_ITEMS);
  const runErrors = unique(
    events.filter((event) => event.type === "run_error").map((event) => event.message)
  );

  return {
    category: failedCheck.category,
    skillsRead: skillsRead.slice(0, MAX_SUMMARY_ITEMS),
    failedCommands,
    runErrors: runErrors.slice(0, MAX_SUMMARY_ITEMS),
    parseErrors: (parsedTrace?.parseErrors ?? [])
      .slice(0, MAX_SUMMARY_ITEMS)
      .map((error) => ({ line: error.line, message: error.message }))
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
