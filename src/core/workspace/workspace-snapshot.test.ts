import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { diffWorkspaceSnapshots, snapshotWorkspace } from "./workspace-snapshot.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-snapshot-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("workspace snapshots", () => {
  it("detects created, changed, deleted, and unchanged files", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "README.md"), "before\n", "utf8");
    await writeFile(join(root, "src", "app.js"), "same\n", "utf8");
    await writeFile(join(root, "delete-me.txt"), "remove\n", "utf8");

    const before = await snapshotWorkspace(root);
    await writeFile(join(root, "README.md"), "after\n", "utf8");
    await writeFile(join(root, "created.txt"), "new\n", "utf8");
    await rm(join(root, "delete-me.txt"));
    const after = await snapshotWorkspace(root);

    expect(diffWorkspaceSnapshots(before, after)).toEqual({
      created: ["created.txt"],
      changed: ["README.md"],
      deleted: ["delete-me.txt"],
      unchanged: ["src/app.js"]
    });
  });
});

