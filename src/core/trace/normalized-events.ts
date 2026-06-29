export type NormalizedEvent =
  | SkillReadEvent
  | CommandStartedEvent
  | CommandFinishedEvent
  | FileReadEvent
  | FileChangedEvent
  | AssistantMessageEvent
  | RunErrorEvent
  | UnknownTraceEvent;

export interface NormalizedEventBase {
  type: NormalizedEvent["type"];
  source: "codex";
  line: number;
  rawType?: string;
}

export interface SkillReadEvent extends NormalizedEventBase {
  type: "skill_read";
  skillName?: string;
  path?: string;
}

export interface CommandStartedEvent extends NormalizedEventBase {
  type: "command_started";
  command: string;
}

export interface CommandFinishedEvent extends NormalizedEventBase {
  type: "command_finished";
  command?: string;
  exitCode?: number;
}

export interface FileReadEvent extends NormalizedEventBase {
  type: "file_read";
  path: string;
}

export interface FileChangedEvent extends NormalizedEventBase {
  type: "file_changed";
  path: string;
}

export interface AssistantMessageEvent extends NormalizedEventBase {
  type: "assistant_message";
  text: string;
}

export interface RunErrorEvent extends NormalizedEventBase {
  type: "run_error";
  message: string;
}

export interface UnknownTraceEvent extends NormalizedEventBase {
  type: "unknown";
}

export interface TraceParseError {
  line: number;
  message: string;
  text: string;
}

export interface ParsedTrace {
  schemaVersion: "0.1";
  source: "codex";
  rawPath: string;
  events: NormalizedEvent[];
  parseErrors: TraceParseError[];
  stats: {
    rawEvents: number;
    normalizedEvents: number;
    parseErrors: number;
  };
}

