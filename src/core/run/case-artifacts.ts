import { resolve } from "node:path";

import { sanitizePathSegment } from "../workspace/sanitize-path-segment.js";
import type { RunStore } from "./run-store.js";

export function createCaseArtifactBase(runStore: RunStore, suiteName: string, caseId: string): string {
  return `${sanitizePathSegment(suiteName)}__${sanitizePathSegment(caseId)}`;
}

export function createRawTracePath(runStore: RunStore, suiteName: string, caseId: string): string {
  return resolve(runStore.rawDir, `${createCaseArtifactBase(runStore, suiteName, caseId)}.jsonl`);
}

export function createStderrPath(runStore: RunStore, suiteName: string, caseId: string): string {
  return resolve(runStore.rawDir, `${createCaseArtifactBase(runStore, suiteName, caseId)}.stderr.txt`);
}

