import { readFile } from "node:fs/promises";

import type { NormalizedEvent, ParsedTrace } from "./normalized-events.js";

export async function parseCodexJsonlTrace(rawPath: string): Promise<ParsedTrace> {
  const text = await readFile(rawPath, "utf8");
  const events: NormalizedEvent[] = [];
  const parseErrors: ParsedTrace["parseErrors"] = [];
  let rawEvents = 0;

  for (const [index, lineText] of text.split(/\r?\n/).entries()) {
    const line = index + 1;
    const trimmed = lineText.trim();

    if (!trimmed) {
      continue;
    }

    let raw: unknown;

    try {
      raw = JSON.parse(trimmed);
      rawEvents += 1;
    } catch (error) {
      parseErrors.push({
        line,
        message: error instanceof Error ? error.message : String(error),
        text: trimmed
      });
      continue;
    }

    events.push(...normalizeCodexEvent(raw, line));
  }

  return {
    schemaVersion: "0.1",
    source: "codex",
    rawPath,
    events,
    parseErrors,
    stats: {
      rawEvents,
      normalizedEvents: events.length,
      parseErrors: parseErrors.length
    }
  };
}

function normalizeCodexEvent(raw: unknown, line: number): NormalizedEvent[] {
  const rawType = findStringField(raw, ["type", "event", "event_type", "kind"]);
  const typeKey = rawType?.toLowerCase() ?? "";
  const itemType = findItemType(raw);
  const path = findStringField(raw, ["path", "file", "file_path", "filePath", "filename"]);
  const command = findStringField(raw, ["command", "cmd", "shell_command"]);
  const message = findStringField(raw, ["message", "text", "content", "error"]);
  const base = {
    source: "codex" as const,
    line,
    rawType
  };
  const events: NormalizedEvent[] = [];
  const skillPath = isSkillPath(path) ? path : extractSkillPathFromCommand(command);
  const commandFinished = isCommandFinished(typeKey, itemType);
  const skillReadCompleted = commandFinished && findNumberField(raw, ["exit_code", "exitCode"]) === 0;

  if ((skillPath && (!itemType || skillReadCompleted)) || typeKey.includes("skill")) {
    events.push({
      ...base,
      type: "skill_read",
      skillName:
        findStringField(raw, ["skill", "skill_name", "skillName", "name"]) ??
        deriveSkillName(skillPath),
      path: skillPath
    });
  }

  if (isCommandStarted(typeKey, itemType)) {
    events.push({
      ...base,
      type: "command_started",
      command: command ?? stringifyCompact(raw)
    });
  }

  if (commandFinished) {
    events.push({
      ...base,
      type: "command_finished",
      command,
      exitCode: findNumberField(raw, ["exit_code", "exitCode", "code", "status"])
    });
  }

  const changedPaths = findChangedPaths(raw, path);
  if (isFileChanged(typeKey, itemType) && changedPaths.length > 0) {
    for (const changedPath of changedPaths) {
      events.push({
        ...base,
        type: "file_changed",
        path: changedPath
      });
    }
  }

  if (path && !skillPath && isFileRead(typeKey, itemType)) {
    events.push({
      ...base,
      type: "file_read",
      path
    });
  }

  if (isRunError(typeKey) || findStringField(raw, ["error"])) {
    events.push({
      ...base,
      type: "run_error",
      message: message ?? stringifyCompact(raw)
    });
  }

  if (isAssistantMessage(typeKey, itemType) && message) {
    events.push({
      ...base,
      type: "assistant_message",
      text: message
    });
  }

  return events.length > 0 ? events : [{ ...base, type: "unknown" }];
}

function isCommandStarted(typeKey: string, itemType: string | undefined): boolean {
  return (
    (typeKey === "item.started" && itemType === "command_execution") ||
    typeKey.includes("exec_command_begin") ||
    typeKey.includes("command_started") ||
    typeKey.includes("command.start") ||
    typeKey.includes("command_begin") ||
    typeKey.includes("tool_call")
  );
}

function isCommandFinished(typeKey: string, itemType: string | undefined): boolean {
  return (
    (typeKey === "item.completed" && itemType === "command_execution") ||
    typeKey.includes("exec_command_end") ||
    typeKey.includes("command_finished") ||
    typeKey.includes("command.end") ||
    typeKey.includes("command_completed") ||
    typeKey.includes("tool_result")
  );
}

function isFileRead(typeKey: string, itemType: string | undefined): boolean {
  const type = itemType ?? typeKey;
  return type.includes("file") && (type.includes("read") || type.includes("open"));
}

function isFileChanged(typeKey: string, itemType: string | undefined): boolean {
  if (itemType === "file_change") {
    return typeKey === "item.completed";
  }

  const type = itemType ?? typeKey;
  return (
    type.includes("file") &&
    (type.includes("change") ||
      type.includes("write") ||
      type.includes("edit") ||
      type.includes("create"))
  );
}

function isAssistantMessage(typeKey: string, itemType: string | undefined): boolean {
  return (
    itemType === "agent_message" ||
    typeKey.includes("assistant") ||
    typeKey.includes("agent_message") ||
    typeKey.includes("message")
  );
}

function isRunError(typeKey: string): boolean {
  return typeKey.includes("error") || typeKey.endsWith(".failed") || typeKey === "failed";
}

function isSkillPath(path: string | undefined): boolean {
  return Boolean(path && /(^|[\\/])SKILL\.md$/i.test(path));
}

function deriveSkillName(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const parts = path.split(/[\\/]/).filter(Boolean);
  const skillFileIndex = parts.findIndex((part) => part.toLowerCase() === "skill.md");

  if (skillFileIndex <= 0) {
    return undefined;
  }

  return parts[skillFileIndex - 1];
}

function findItemType(value: unknown): string | undefined {
  const item = findItem(value);

  if (!item) {
    return undefined;
  }

  const type = item.type;
  return typeof type === "string" && type.trim().length > 0 ? type.toLowerCase() : undefined;
}

function findChangedPaths(value: unknown, fallbackPath: string | undefined): string[] {
  const item = findItem(value);
  const changes = item?.changes;

  if (!Array.isArray(changes)) {
    return fallbackPath ? [fallbackPath] : [];
  }

  const paths = changes.flatMap((change) => {
    if (!change || typeof change !== "object") {
      return [];
    }

    const path = (change as Record<string, unknown>).path;
    return typeof path === "string" && path.trim().length > 0 ? [path] : [];
  });

  return paths.length > 0 ? paths : fallbackPath ? [fallbackPath] : [];
}

function findItem(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = (value as Record<string, unknown>).item;
  return item && typeof item === "object" ? (item as Record<string, unknown>) : undefined;
}

function extractSkillPathFromCommand(command: string | undefined): string | undefined {
  if (!command || !/(^|[\\/])SKILL\.md\b/i.test(command)) {
    return undefined;
  }

  const match = command.match(/[^\s"']*(?:[\\/][^\s"']*)?[\\/]SKILL\.md\b/i);
  return match?.[0];
}

function findStringField(value: unknown, keys: string[]): string | undefined {
  return findField(value, keys, (candidate) =>
    typeof candidate === "string" && candidate.trim().length > 0 ? candidate : undefined
  );
}

function findNumberField(value: unknown, keys: string[]): number | undefined {
  return findField(value, keys, (candidate) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined
  );
}

function findField<T>(
  value: unknown,
  keys: string[],
  convert: (candidate: unknown) => T | undefined
): T | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const lowerKeyMap = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));

  for (const key of keys) {
    const actualKey = lowerKeyMap.get(key.toLowerCase());

    if (!actualKey) {
      continue;
    }

    const converted = convert(record[actualKey]);

    if (converted !== undefined) {
      return converted;
    }
  }

  for (const child of Object.values(record)) {
    if (!child || typeof child !== "object") {
      continue;
    }

    const converted = findField(child, keys, convert);

    if (converted !== undefined) {
      return converted;
    }
  }

  return undefined;
}

function stringifyCompact(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
