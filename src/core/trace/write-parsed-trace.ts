import { writeFile } from "node:fs/promises";

import type { ParsedTrace } from "./normalized-events.js";

export async function writeParsedTrace(path: string, trace: ParsedTrace): Promise<void> {
  await writeFile(path, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
}

