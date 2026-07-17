import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import type { SkillReference } from "../config/config-schema.js";
import type { SkillArenaProject } from "../project/project.js";
import type { LoadedEvalSuite } from "../run/run-plan.js";
import type { RunStore } from "../run/run-store.js";
import { prepareWorkspaces } from "./prepare-workspaces.js";
import { createStablePathSegment, sanitizePathSegment } from "./sanitize-path-segment.js";

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

  it("rejects fixture paths outside the configured fixtures directory", async () => {
    const root = await makeTempDir();
    const workspacesDir = join(root, ".skillarena", "runs", "run-1", "workspaces");
    await mkdir(workspacesDir, { recursive: true });

    await expect(
      prepareWorkspaces(
        createProject(root),
        createRunStore(root, workspacesDir),
        createSuites("sample suite", "case-1", "../")
      )
    ).rejects.toThrow("Fixture path must resolve inside the configured fixtures directory");
  });

  it("keeps workspaces separate when sanitized suite names collide", async () => {
    const root = await makeTempDir();
    const fixtureDir = join(root, "fixtures", "basic");
    const workspacesDir = join(root, ".skillarena", "runs", "run-1", "workspaces");
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(workspacesDir, { recursive: true });
    await writeFile(join(fixtureDir, "README.md"), "# Fixture\n", "utf8");

    const workspaces = await prepareWorkspaces(
      createProject(root),
      createRunStore(root, workspacesDir),
      [
        ...createSuites("suite/name", "case-1", "fixtures/basic"),
        ...createSuites("suite-name", "case-1", "fixtures/basic")
      ]
    );

    expect(workspaces).toHaveLength(2);
    expect(workspaces[0]!.path).not.toBe(workspaces[1]!.path);
  });

  it("provisions the suite skill into every case workspace", async () => {
    const root = await makeTempDir();
    const skillDir = join(root, ".codex", "skills", "code-audit");
    const fixtureDir = join(root, "fixtures", "basic");
    const workspacesDir = join(root, ".skillarena", "runs", "run-1", "workspaces");
    await mkdir(skillDir, { recursive: true });
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(workspacesDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "# Code Audit\n", "utf8");

    const workspaces = await prepareWorkspaces(
      createProject(root),
      createRunStore(root, workspacesDir),
      createSuites("sample suite", "case-1", "fixtures/basic", {
        name: "code-audit",
        path: ".codex/skills/code-audit"
      })
    );

    expect(workspaces[0]!.skill).toMatchObject({
      name: "code-audit",
      sourcePath: skillDir
    });
    await expect(
      readFile(join(workspaces[0]!.path, ".codex", "skills", "code-audit", "SKILL.md"), "utf8")
    ).resolves.toBe("# Code Audit\n");
  });

  it("rejects a suite skill without SKILL.md", async () => {
    const root = await makeTempDir();
    const skillDir = join(root, ".codex", "skills", "incomplete");
    const fixtureDir = join(root, "fixtures", "basic");
    const workspacesDir = join(root, ".skillarena", "runs", "run-1", "workspaces");
    await mkdir(skillDir, { recursive: true });
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(workspacesDir, { recursive: true });

    await expect(
      prepareWorkspaces(
        createProject(root),
        createRunStore(root, workspacesDir),
        createSuites("sample suite", "case-1", "fixtures/basic", {
          name: "incomplete",
          path: ".codex/skills/incomplete"
        })
      )
    ).rejects.toThrow("Skill directory must contain SKILL.md");
  });
});

describe("sanitizePathSegment", () => {
  it("keeps workspace paths filesystem-friendly", () => {
    expect(sanitizePathSegment("suite/name with spaces")).toBe("suite-name-with-spaces");
    expect(sanitizePathSegment("")).toBe("unnamed");
  });

  it("adds a stable hash suffix to avoid path collisions", () => {
    expect(createStablePathSegment("suite/name")).toBe(createStablePathSegment("suite/name"));
    expect(createStablePathSegment("suite/name")).not.toBe(createStablePathSegment("suite-name"));
    expect(createStablePathSegment("suite/name")).toMatch(/^suite-name-[a-f0-9]{8}$/);
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
        snapshots: "snapshots",
        runs: ".skillarena/runs"
      },
      skills: []
    },
    evalsDir: resolve(root, "evals"),
    fixturesDir: resolve(root, "fixtures"),
    snapshotsDir: resolve(root, "snapshots"),
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

function createSuites(
  suiteName: string,
  caseId: string,
  fixture: string,
  skill?: SkillReference
): LoadedEvalSuite[] {
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
            commands_not_run: [],
            files_created: [],
            files_changed: [],
            files_deleted: [],
            files_unchanged: [],
            file_snapshots: []
          }
        }
      ],
      suite: {
        name: suiteName,
        agent: "codex",
        skill,
        cases: []
      }
    }
  ];
}
