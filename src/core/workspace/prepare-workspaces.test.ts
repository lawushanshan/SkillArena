import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import type { SkillArenaProject } from "../project/project.js";
import type { LoadedEvalSuite } from "../run/dry-run.js";
import type { RunStore } from "../run/run-store.js";
import { prepareWorkspaces } from "./prepare-workspaces.js";
import { sanitizePathSegment } from "./sanitize-path-segment.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "skillarena-workspace-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("prepareWorkspaces", () => {
  it("copies fixture files into a per-case workspace", async () => {
    const root = await makeTempDir();
    const fixtureDir = join(root, "fixtures", "basic");
    const workspacesDir = join(root, ".skillarena", "runs", "run-1", "workspaces");
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(workspacesDir, { recursive: true });
    await writeFile(join(fixtureDir, "README.md"), "# Fixture\n", "utf8");

    const project = createProject(root);
    const runStore = createRunStore(root, workspacesDir);
    const suites = createSuites("sample suite", "case-1", "fixtures/basic");

    const workspaces = await prepareWorkspaces(project, runStore, suites);

    expect(workspaces).toHaveLength(1);
    expect(existsSync(join(workspaces[0]!.path, "README.md"))).toBe(true);
    await expect(readFile(join(workspaces[0]!.path, "README.md"), "utf8")).resolves.toBe(
      "# Fixture\n"
    );
  });
});

describe("sanitizePathSegment", () => {
  it("keeps workspace paths filesystem-friendly", () => {
    expect(sanitizePathSegment("suite/name with spaces")).toBe("suite-name-with-spaces");
    expect(sanitizePathSegment("")).toBe("unnamed");
  });
});

function createProject(root: string): SkillArenaProject {
  return {
    root,
    configPath: resolve(root, "skillarena.yaml"),
    config: {
      schemaVersion: "0.1",
      agent: "codex",
      paths: {
        evals: "evals",
        fixtures: "fixtures",
        runs: ".skillarena/runs"
      },
      skills: []
    },
    evalsDir: resolve(root, "evals"),
    fixturesDir: resolve(root, "fixtures"),
    runsDir: resolve(root, ".skillarena", "runs")
  };
}

function createRunStore(root: string, workspacesDir: string): RunStore {
  const runDir = resolve(root, ".skillarena", "runs", "run-1");
  return {
    runId: "run-1",
    runDir,
    rawDir: resolve(runDir, "raw"),
    parsedDir: resolve(runDir, "parsed"),
    workspacesDir,
    reportJsonPath: resolve(runDir, "report.json"),
    reportMarkdownPath: resolve(runDir, "report.md")
  };
}

function createSuites(suiteName: string, caseId: string, fixture: string): LoadedEvalSuite[] {
  return [
    {
      path: "evals/sample.yaml",
      selectedCaseCount: 1,
      selectedCases: [
        {
          id: caseId,
          prompt: "Do a task.",
          workspace: { fixture },
          expect: {
            commands: [],
            files_created: [],
            files_changed: [],
            files_unchanged: []
          }
        }
      ],
      suite: {
        name: suiteName,
        agent: "codex",
        cases: []
      }
    }
  ];
}

