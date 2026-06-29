import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

export async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);

  await new Promise<void>((resolvePromise, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise());
  });

  return hash.digest("hex");
}

export async function hashDirectory(path: string): Promise<string> {
  const hash = createHash("sha256");
  const files = await listFiles(path);

  for (const file of files) {
    const relativePath = relative(path, file).replace(/\\/g, "/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await hashFile(file));
    hash.update("\0");
  }

  return hash.digest("hex");
}

async function listFiles(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(path, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      const fileStat = await stat(fullPath);

      if (fileStat.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

