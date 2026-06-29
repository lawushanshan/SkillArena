import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export async function listEvalFiles(evalsDir: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await visit(evalsDir);
  return files.sort();
}

