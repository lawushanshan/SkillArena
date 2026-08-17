import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute } from "node:path";
import { promisify } from "node:util";
import spawn from "cross-spawn";
import type { ParsedTrace } from "../../core/trace/normalized-events.js";
import type { AgentExecResult } from "../agent-adapter.js";

const execFileAsync = promisify(execFile);

export interface GeminiExecOptions {
  prompt: string;
  cwd: string;
  rawOutputPath: string;
  stderrPath: string;
  timeoutMs: number;
  geminiCommand?: string;
  geminiCommandArgs?: string[];
}

/**
 * Execute a prompt against the Gemini CLI and capture raw output.
 *
 * The Gemini CLI (`gemini`) supports a `--prompt` flag for non-interactive
 * execution. Output format and trace capabilities are still being validated.
 */
export async function runGeminiExec(options: GeminiExecOptions): Promise<AgentExecResult> {
  const startedAt = Date.now();
  const geminiCommand = options.geminiCommand ?? "gemini";
  const geminiCommandArgs = options.geminiCommandArgs ?? [];
  const env = createGeminiEnvironment(geminiCommand);
  const args = [...geminiCommandArgs, "--prompt", options.prompt];
  let stdout = "";
  let stderr = "";
  let timedOut = false;

  const result = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    error?: string;
  }>((resolve) => {
    let settled = false;
    const child = spawn(geminiCommand, args, {
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
        error: "Failed to capture Gemini stdout or stderr.",
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
    command: [geminiCommand, ...args],
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

function createGeminiEnvironment(geminiCommand: string): NodeJS.ProcessEnv {
  if (!isAbsolute(geminiCommand)) {
    return process.env;
  }

  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
  const existingPath = process.env[pathKey];

  return {
    ...process.env,
    [pathKey]: existingPath
      ? `${dirname(geminiCommand)}${delimiter}${existingPath}`
      : dirname(geminiCommand),
  };
}

export async function getGeminiVersion(): Promise<string | undefined> {
  try {
    const result = await execFileAsync("gemini", ["--version"], {
      timeout: 1000,
    });
    return result.stdout.trim() || result.stderr.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse Gemini CLI output into SkillArena's normalized trace model.
 *
 * TODO: The Gemini CLI output format is not yet stabilized. This initial
 * implementation returns an empty event list. Update once the output schema
 * is documented and stable.
 */
export async function parseGeminiTrace(rawPath: string): Promise<ParsedTrace> {
  return {
    schemaVersion: "0.1",
    source: "gemini",
    rawPath,
    events: [],
    parseErrors: [],
    stats: { rawEvents: 0, normalizedEvents: 0, parseErrors: 0 },
  };
}
