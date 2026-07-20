import type { EvalCase } from "../core/eval/eval-schema.js";

export const ADAPTER_CAPABILITIES = [
  "skill_read_trace",
  "command_trace",
  "file_change_detection"
] as const;

export type AdapterCapability = (typeof ADAPTER_CAPABILITIES)[number];

export const CODEX_ADAPTER_CAPABILITIES: ReadonlySet<AdapterCapability> = new Set(
  ADAPTER_CAPABILITIES
);

export function requiredCapabilities(testCase: EvalCase): AdapterCapability[] {
  const capabilities = new Set<AdapterCapability>();
  const { expect } = testCase;

  if (expect.skill_used || expect.skill_not_used) {
    capabilities.add("skill_read_trace");
  }

  if (
    expect.commands.length > 0 ||
    expect.commands_not_run.length > 0 ||
    expect.commands_succeeded !== undefined
  ) {
    capabilities.add("command_trace");
  }

  if (
    expect.files_created.length > 0 ||
    expect.files_changed.length > 0 ||
    expect.files_deleted.length > 0 ||
    expect.files_unchanged.length > 0 ||
    expect.file_snapshots.length > 0 ||
    expect.judge !== undefined
  ) {
    capabilities.add("file_change_detection");
  }

  return [...capabilities];
}

export function missingCapabilities(
  testCase: EvalCase,
  availableCapabilities: ReadonlySet<AdapterCapability>
): AdapterCapability[] {
  return requiredCapabilities(testCase).filter(
    (capability) => !availableCapabilities.has(capability)
  );
}
