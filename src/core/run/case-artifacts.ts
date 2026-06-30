import { resolve } from "node:path";

import { createStablePathSegment } from "../workspace/sanitize-path-segment.js";
import type { RunStore } from "./run-store.js";

export function createCaseArtifactBase(runStore: RunStore, suiteName: string, caseId: string): string {
  return `${createStablePathSegment(suiteName)}__${createStablePathSegment(caseId)}`;
}

export function createRawTracePath(runStore: RunStore, suiteName: string, caseId: string): string {
  return resolve(runStore.rawDir, `${createCaseArtifactBase(runStore, suiteName, caseId)}.jsonl`);
}

export function createStderrPath(runStore: RunStore, suiteName: string, caseId: string): string {
  return resolve(runStore.rawDir, `${createCaseArtifactBase(runStore, suiteName, caseId)}.stderr.txt`);
}

export function createParsedTracePath(runStore: RunStore, suiteName: string, caseId: string): string {
  return resolve(runStore.parsedDir, `${createCaseArtifactBase(runStore, suiteName, caseId)}.json`);
}
