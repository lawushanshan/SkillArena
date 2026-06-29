import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

export interface WorkspaceFileState {
  path: string;
  hash: string;
}

export interface WorkspaceSnapshot {
  root: string;
  files: WorkspaceFileState[];
}

export interface WorkspaceDiff {
  created: string[];
  changed: string[];
  deleted: string[];
  unchanged: string[];
}

export async function snapshotWorkspace(root: string): Promise<WorkspaceSnapshot> {
  const files = await listFiles(root);

  return {
    root,
    files: await Promise.all(
      files.map(async (filePath) => ({
        path: relative(root, filePath).replace(/\\/g, "/"),
        hash: await hashFile(filePath)
      }))
    )
  };
}

export function diffWorkspaceSnapshots(before: WorkspaceSnapshot, after: WorkspaceSnapshot): WorkspaceDiff {
  const beforeMap = new Map(before.files.map((file) => [file.path, file.hash]));
  const afterMap = new Map(after.files.map((file) => [file.path, file.hash]));
  const created: string[] = [];
  const changed: string[] = [];
  const deleted: string[] = [];
  const unchanged: string[] = [];

  for (const [path, afterHash] of afterMap) {
    const beforeHash = beforeMap.get(path);

    if (beforeHash === undefined) {
      created.push(path);
      continue;
    }

    if (beforeHash !== afterHash) {
      changed.push(path);
      continue;
    }

    unchanged.push(path);
  }

  for (const path of beforeMap.keys()) {
    if (!afterMap.has(path)) {
      deleted.push(path);
    }
  }

  return {
    created: created.sort(),
    changed: changed.sort(),
    deleted: deleted.sort(),
    unchanged: unchanged.sort()
  };
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);

  await new Promise<void>((resolvePromise, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise());
  });

  return hash.digest("hex");
}

