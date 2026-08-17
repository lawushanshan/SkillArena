import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute } from "node:path";
import { promisify } from "node:util";
import spawn from "cross-spawn";
import type {
  NormalizedEvent,
  ParsedTrace,
} from "../../core/trace/normalized-events.js";
import type { AgentExecResult } from "../agent-adapter.js";

const execFileAsync = promisify(execFile);

export interface ClaudeExecOptions {
  prompt: string;
  cwd: string;
  rawOutputPath: string;
  stderrPath: string;
  timeoutMs: number;
  claudeCommand?: string;
  claudeCommandArgs?: string[];
}

/**
 * Execute a prompt against the Claude Code CLI and capture raw output.
 *
 * Claude Code (`claude`) supports `--print` for non-interactive execution and
 * `--output-format stream-json` for structured JSONL trace output. The
 * `--verbose` flag ensures all tool calls are emitted in the stream.
 */
export async function runClaudeExec(options: ClaudeExecOptions): Promise<AgentExecResult> {
  const startedAt = Date.now();
  const claudeCommand = options.claudeCommand ?? "claude";
  const claudeCommandArgs = options.claudeCommandArgs ?? [];
  const env = createClaudeEnvironment(claudeCommand);
  const args = [
    ...claudeCommandArgs,
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    options.prompt,
  ];
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const result = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    error?: string;
  }>((resolve) => {
    let settled = false;
    const child = spawn(claudeCommand, args, {
      cwd: options.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);

    if (!child.stdout || !child.stderr) {
      clearTimeout(timeout);
      settled = true;
      resolve({
        exitCode: null,
        signal: null,
        error: "Failed to capture Claude stdout or stderr.",
      });
      return;
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      stderr += error.message;
      resolve({ exitCode: null, signal: null, error: error.message });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      resolve({ exitCode, signal });
    });
  });

  await writeFile(options.rawOutputPath, stdout, "utf8");
  await writeFile(options.stderrPath, stderr, "utf8");

  return {
    command: [claudeCommand, ...args],
    cwd: options.cwd,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut,
    error: result.error,
    durationMs: Date.now() - startedAt,
    rawOutputPath: options.rawOutputPath,
    stderrPath: options.stderrPath,
    stdoutBytes: Buffer.byteLength(stdout, "utf8"),
    stderrBytes: Buffer.byteLength(stderr, "utf8"),
  };
}

function createClaudeEnvironment(claudeCommand: string): NodeJS.ProcessEnv {
  if (!isAbsolute(claudeCommand)) {
    return process.env;
  }

  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  const existingPath = process.env[pathKey];

  return {
    ...process.env,
    [pathKey]: existingPath
      ? `${dirname(claudeCommand)}${delimiter}${existingPath}`
      : dirname(claudeCommand),
  };
}

export async function getClaudeVersion(): Promise<string | undefined> {
  try {
    const result = await execFileAsync("claude", ["--version"], {
      timeout: 1000,
    });
    return result.stdout.trim() || result.stderr.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse Claude Code CLI stream-json output into SkillArena's normalized trace model.
 *
 * Claude Code `--output-format stream-json --verbose` produces JSONL with
 * `assistant` events (containing `tool_use` blocks) and `user` events
 * (containing `tool_result` blocks), plus a final `result` event.
 */
export async function parseClaudeTrace(rawPath: string): Promise<ParsedTrace> {
  const text = await readFile(rawPath, "utf8");
  const events: NormalizedEvent[] = [];
  const parseErrors: ParsedTrace["parseErrors"] = [];
  let rawEvents = 0;

  for (const [index, lineText] of text.split(/\r?\n/).entries()) {
    const line = index + 1;
    const trimmed = lineText.trim();

    if (!trimmed) continue;

    let raw: unknown;

    try {
      raw = JSON.parse(trimmed);
      rawEvents += 1;
    } catch (error) {
      parseErrors.push({
        line,
        message: error instanceof Error ? error.message : String(error),
        text: trimmed,
      });
      continue;
    }

    events.push(...normalizeClaudeEvent(raw, line));
  }

  return {
    schemaVersion: "0.1",
    source: "claude",
    rawPath,
    events,
    parseErrors,
    stats: { rawEvents, normalizedEvents: events.length, parseErrors: parseErrors.length },
  };
}

function normalizeClaudeEvent(raw: unknown, line: number): NormalizedEvent[] {
  if (!raw || typeof raw !== "object") {
    return [{ type: "unknown", source: "claude", line }];
  }

  const record = raw as Record<string, unknown>;
  const rawType = typeof record.type === "string" ? record.type : "";
  const base = { source: "claude" as const, line, rawType };

  if (rawType === "result") {
    const events: NormalizedEvent[] = [];
    if (record.is_error === true) {
      events.push({
        ...base,
        type: "run_error",
        message: stringField(record, ["result", "error"]) ?? "Claude run ended with error",
      });
    }
    const resultText = stringField(record, ["result"]);
    if (resultText) {
      events.push({ ...base, type: "assistant_message", text: resultText });
    }
    return events.length > 0 ? events : [{ ...base, type: "unknown" }];
  }

  if (rawType === "assistant") {
    return normalizeAssistantEvent(record, base);
  }

  if (rawType === "user") {
    return normalizeUserEvent(record, base);
  }

  return [{ ...base, type: "unknown" }];
}

function normalizeAssistantEvent(
  record: Record<string, unknown>,
  base: { source: "claude"; line: number; rawType?: string },
): NormalizedEvent[] {
  const message = record.message;
  if (!message || typeof message !== "object") return [{ ...base, type: "unknown" }];

  const msg = message as Record<string, unknown>;
  const content = msg.content;
  if (!Array.isArray(content)) return [{ ...base, type: "unknown" }];

  const events: NormalizedEvent[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const blockType = stringField(b, ["type"]) ?? "";

    if (blockType === "text") {
      const text = stringField(b, ["text"]);
      if (text) {
        events.push({ ...base, type: "assistant_message", text });
      }
    }

    if (blockType === "tool_use") {
      const toolName = stringField(b, ["name"]);
      const toolInput = b.input;
      if (!toolInput || typeof toolInput !== "object") continue;
      const input = toolInput as Record<string, unknown>;

      if (toolName === "Bash") {
        events.push({
          ...base,
          type: "command_started",
          command: stringField(input, ["command"]) ?? "",
        });
      }

      if (toolName === "Read") {
        const filePath = stringField(input, ["file_path"]);
        events.push({
          ...base,
          type: isSkillPath(filePath) ? "skill_read" : "file_read",
          path: filePath ?? "",
          ...(isSkillPath(filePath) ? { skillName: deriveSkillName(filePath) } : {}),
        });
      }

      if (toolName === "Write" || toolName === "Edit" || toolName === "NotebookEdit") {
        const filePath =
          stringField(input, ["file_path"]) ?? stringField(input, ["notebook_path"]);
        if (filePath) {
          events.push({ ...base, type: "file_changed", path: filePath });
        }
      }
    }
  }

  return events.length > 0 ? events : [{ ...base, type: "unknown" }];
}

function normalizeUserEvent(
  record: Record<string, unknown>,
  base: { source: "claude"; line: number; rawType?: string },
): NormalizedEvent[] {
  const message = record.message;
  if (!message || typeof message !== "object") return [];

  const msg = message as Record<string, unknown>;
  const content = msg.content;
  if (!Array.isArray(content)) return [];

  const events: NormalizedEvent[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const blockType = stringField(b, ["type"]) ?? "";

    if (blockType === "tool_result") {
      const resultContent = extractToolResultText(b.content);
      const isError = b.is_error === true;
      const toolUseId = stringField(b, ["tool_use_id"]) ?? "";

      if (isError) {
        events.push({
          ...base,
          type: "run_error",
          message: resultContent ?? `Tool error for ${toolUseId}`,
        });
      }

      if (toolUseId) {
        events.push({
          ...base,
          type: "command_finished",
          command: undefined,
          exitCode: isError ? 1 : 0,
        });
      }
    }
  }

  return events;
}

function extractToolResultText(content: unknown): string | undefined {
  if (typeof content === "string") {
    return content.trim() || undefined;
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object") {
        const text = stringField(block as Record<string, unknown>, ["text"]);
        if (text) return text;
      }
    }
  }

  return undefined;
}

function isSkillPath(path: string | undefined): boolean {
  return Boolean(path && /(^|[\\/])SKILL\.md$/i.test(path));
}

function deriveSkillName(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const parts = path.split(/[\\/]/).filter(Boolean);
  const idx = parts.findIndex((p) => p.toLowerCase() === "skill.md");
  if (idx <= 0) return undefined;
  return parts[idx - 1];
}

function stringField(
  value: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const v = value[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}
