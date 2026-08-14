import type { ParsedTrace } from "../core/trace/normalized-events.js";
import type { AdapterCapability } from "./adapter-capabilities.js";
import type { CodexExecOptions } from "./codex/codex-adapter.js";

/**
 * Contract for a coding-agent adapter.
 *
 * An adapter knows how to run a prompt against a specific agent (Codex, Claude
 * Code, etc.) and convert the raw output into SkillArena's normalized trace
 * model. The runner uses the adapter's declared capabilities to block eval
 * cases that require trace events the adapter cannot produce.
 *
 * To add support for a new agent, implement this interface and register it in
 * the runner. The Codex adapter is the reference implementation.
 */
export interface AgentAdapter {
  /** Agent identifier matching the `agent` field in eval suites and config. */
  readonly name: string;

  /** Trace capabilities this adapter can produce. */
  readonly capabilities: ReadonlySet<AdapterCapability>;

  /**
   * Execute a single prompt against the agent and capture raw output.
   * Returns paths to the raw output and stderr files for later parsing.
   */
  execute(options: AgentExecOptions): Promise<AgentExecResult>;

  /**
   * Parse the raw agent output into SkillArena's normalized trace model.
   */
  parseTrace(rawPath: string): Promise<ParsedTrace>;
}

/** Agent-agnostic execution options. */
export interface AgentExecOptions {
  prompt: string;
  cwd: string;
  rawOutputPath: string;
  stderrPath: string;
  timeoutMs: number;
  /** Agent-specific command override (e.g. a custom codex binary path). */
  command?: string;
  /** Additional command-line arguments for the agent binary. */
  commandArgs?: string[];
}

/** Agent-agnostic execution result. */
export interface AgentExecResult {
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

/**
 * Create the built-in Codex adapter.
 *
 * This is the reference implementation. It wraps `runCodexExec` and
 * `parseCodexJsonlTrace` behind the `AgentAdapter` contract.
 */
export function createCodexAdapter(extras?: {
  codexCommand?: string;
  codexCommandArgs?: string[];
}): AgentAdapter {
  const codexCommand = extras?.codexCommand;
  const codexCommandArgs = extras?.codexCommandArgs;
  return {
    name: "codex",
    capabilities: new Set<AdapterCapability>([
      "skill_read_trace",
      "command_trace",
      "file_change_detection",
    ]),

    async execute(options: AgentExecOptions): Promise<AgentExecResult> {
      const codexOptions: CodexExecOptions = {
        prompt: options.prompt,
        cwd: options.cwd,
        rawOutputPath: options.rawOutputPath,
        stderrPath: options.stderrPath,
        timeoutMs: options.timeoutMs,
        codexCommand: codexCommand ?? options.command,
        codexCommandArgs: codexCommandArgs ?? options.commandArgs,
      };
      const { runCodexExec } = await import("./codex/codex-adapter.js");
      return runCodexExec(codexOptions);
    },

    async parseTrace(rawPath: string): Promise<ParsedTrace> {
      const { parseCodexJsonlTrace } = await import("../core/trace/codex-jsonl-parser.js");
      return parseCodexJsonlTrace(rawPath);
    },
  };
}
