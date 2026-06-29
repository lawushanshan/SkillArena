import { writeFile } from "node:fs/promises";
import spawn from "cross-spawn";

export interface CodexExecOptions {
  prompt: string;
  cwd: string;
  rawOutputPath: string;
  stderrPath: string;
  timeoutMs: number;
  codexCommand?: string;
  codexCommandArgs?: string[];
}

export interface CodexExecResult {
  command: string[];
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  error?: string;
  durationMs: number;
  rawOutputPath: string;
  stderrPath: string;
  stdoutBytes: number;
  stderrBytes: number;
}

export async function runCodexExec(options: CodexExecOptions): Promise<CodexExecResult> {
  const startedAt = Date.now();
  const codexCommand = options.codexCommand ?? "codex";
  const codexCommandArgs = options.codexCommandArgs ?? [];
  const args = [
    ...codexCommandArgs,
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--cd",
    options.cwd,
    options.prompt
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
    const child = spawn(codexCommand, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
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
        error: "Failed to capture Codex stdout or stderr."
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
      if (settled) {
        return;
      }
      settled = true;
      stderr += error.message;
      resolve({
        exitCode: null,
        signal: null,
        error: error.message
      });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      resolve({ exitCode, signal });
    });
  });

  await writeFile(options.rawOutputPath, stdout, "utf8");
  await writeFile(options.stderrPath, stderr, "utf8");

  return {
    command: [codexCommand, ...args],
    cwd: options.cwd,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut,
    error: result.error,
    durationMs: Date.now() - startedAt,
    rawOutputPath: options.rawOutputPath,
    stderrPath: options.stderrPath,
    stdoutBytes: Buffer.byteLength(stdout, "utf8"),
    stderrBytes: Buffer.byteLength(stderr, "utf8")
  };
}
