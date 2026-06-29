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

    events.push(normalizeCodexEvent(raw, line));
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

function normalizeCodexEvent(raw: unknown, line: number): NormalizedEvent {
  const rawType = findStringField(raw, ["type", "event", "event_type", "kind"]);
  const typeKey = rawType?.toLowerCase() ?? "";
  const path = findStringField(raw, ["path", "file", "file_path", "filePath", "filename"]);
  const command = findStringField(raw, ["command", "cmd", "shell_command"]);
  const message = findStringField(raw, ["message", "text", "content", "error"]);
  const base = {
    source: "codex" as const,
    line,
    rawType
  };

  if (isSkillPath(path) || typeKey.includes("skill")) {
    return {
      ...base,
      type: "skill_read",
      skillName: findStringField(raw, ["skill", "skill_name", "skillName", "name"]) ?? deriveSkillName(path),
      path
    };
  }

  if (isCommandStarted(typeKey)) {
    return {
      ...base,
      type: "command_started",
      command: command ?? stringifyCompact(raw)
    };
  }

  if (isCommandFinished(typeKey)) {
    return {
      ...base,
      type: "command_finished",
      command,
      exitCode: findNumberField(raw, ["exit_code", "exitCode", "code", "status"])
    };
  }

  if (path && isFileChanged(typeKey)) {
    return {
      ...base,
      type: "file_changed",
      path
    };
  }

  if (path && isFileRead(typeKey)) {
    return {
      ...base,
      type: "file_read",
      path
    };
  }

  if (typeKey.includes("error") || findStringField(raw, ["error"])) {
    return {
      ...base,
      type: "run_error",
      message: message ?? stringifyCompact(raw)
    };
  }

  if (isAssistantMessage(typeKey) && message) {
    return {
      ...base,
      type: "assistant_message",
      text: message
    };
  }

  return {
    ...base,
    type: "unknown"
  };
}

function isCommandStarted(typeKey: string): boolean {
  return (
    typeKey.includes("exec_command_begin") ||
    typeKey.includes("command_started") ||
    typeKey.includes("command.start") ||
    typeKey.includes("command_begin") ||
    typeKey.includes("tool_call")
  );
}

function isCommandFinished(typeKey: string): boolean {
  return (
    typeKey.includes("exec_command_end") ||
    typeKey.includes("command_finished") ||
    typeKey.includes("command.end") ||
    typeKey.includes("command_completed") ||
    typeKey.includes("tool_result")
  );
}

function isFileRead(typeKey: string): boolean {
  return typeKey.includes("file") && (typeKey.includes("read") || typeKey.includes("open"));
}

function isFileChanged(typeKey: string): boolean {
  return (
    typeKey.includes("file") &&
    (typeKey.includes("change") ||
      typeKey.includes("write") ||
      typeKey.includes("edit") ||
      typeKey.includes("create"))
  );
}

function isAssistantMessage(typeKey: string): boolean {
  return (
    typeKey.includes("assistant") ||
    typeKey.includes("agent_message") ||
    typeKey.includes("message")
  );
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

