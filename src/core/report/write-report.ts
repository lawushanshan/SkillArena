import { type RunStore, writeRunFile } from "../run/run-store.js";
import { renderMarkdownReport } from "./render-markdown-report.js";
import type { SkillArenaReport } from "./report-schema.js";

export async function writeReport(runStore: RunStore, report: SkillArenaReport): Promise<void> {
  await writeRunFile(runStore.reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeRunFile(runStore.reportMarkdownPath, renderMarkdownReport(report));
}
