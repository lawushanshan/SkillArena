import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { initProject } from "./init-project.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-init-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("initProject", () => {
  it("creates the default project files", async () => {
    const root = await makeTempDir();

    const result = await initProject(root);

    expect(result.created.length).toBeGreaterThan(0);
    expect(existsSync(join(root, "skillarena.yaml"))).toBe(true);
    expect(existsSync(join(root, "evals", "sample-audit.yaml"))).toBe(true);
    expect(existsSync(join(root, "fixtures", "sample-workspace", "README.md"))).toBe(true);
    expect(existsSync(join(root, "fixtures", "sample-workspace", "package.json"))).toBe(true);
    expect(existsSync(join(root, "fixtures", "sample-workspace", "src", "app.js"))).toBe(true);
    expect(existsSync(join(root, "fixtures", "sample-workspace", "TODO.tmp"))).toBe(true);

    const config = await readFile(join(root, "skillarena.yaml"), "utf8");
    expect(config).toContain('schemaVersion: "0.1"');
    const evalFile = await readFile(join(root, "evals", "sample-audit.yaml"), "utf8");
    expect(evalFile).toContain("files_created");
    expect(evalFile).toContain("files_changed");
    expect(evalFile).toContain("files_deleted");
    expect(evalFile).toContain("files_unchanged");
  });

  it("does not overwrite existing files", async () => {
    const root = await makeTempDir();

    await initProject(root);
    const result = await initProject(root);

    expect(result.skipped).toEqual(
      expect.arrayContaining([
        join(root, "skillarena.yaml"),
        join(root, "evals", "sample-audit.yaml"),
        join(root, "fixtures", "sample-workspace", "README.md"),
        join(root, "fixtures", "sample-workspace", "package.json"),
        join(root, "fixtures", "sample-workspace", "src", "app.js"),
        join(root, "fixtures", "sample-workspace", "TODO.tmp")
      ])
    );
  });
});
