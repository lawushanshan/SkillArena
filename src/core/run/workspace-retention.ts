import { rm } from "node:fs/promises";

import type { RunStore } from "./run-store.js";

export async function removeWorkspaces(runStore: RunStore): Promise<void> {
  await rm(runStore.workspacesDir, { recursive: true, force: true });
}
