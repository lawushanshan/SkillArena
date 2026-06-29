import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface InitProjectResult {
  created: string[];
  skipped: string[];
}

const CONFIG_TEMPLATE = `schemaVersion: "0.1"
agent: codex
paths:
  evals: evals
  fixtures: fixtures
  runs: .skillarena/runs
skills:
  - name: sample-skill
    path: .codex/skills/sample-skill
`;

const EVAL_TEMPLATE = `name: sample-skill
agent: codex
skill:
  name: sample-skill
  path: .codex/skills/sample-skill
cases:
  - id: sample-dry-run
    prompt: "Summarize README.md and mention the project name."
    workspace:
      fixture: fixtures/sample-workspace
    expect:
      commands_succeeded: true
      files_unchanged:
        - README.md
`;

const FIXTURE_README = `# Sample Workspace

This fixture is used by SkillArena's generated sample eval.
`;

export async function initProject(rootDir: string): Promise<InitProjectResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  await ensureDir(resolve(rootDir, "evals"), created);
  await ensureDir(resolve(rootDir, "fixtures", "sample-workspace"), created);
  await ensureDir(resolve(rootDir, ".skillarena", "runs"), created);

  await writeIfMissing(resolve(rootDir, "skillarena.yaml"), CONFIG_TEMPLATE, created, skipped);
  await writeIfMissing(resolve(rootDir, "evals", "sample-skill.yaml"), EVAL_TEMPLATE, created, skipped);
  await writeIfMissing(
    resolve(rootDir, "fixtures", "sample-workspace", "README.md"),
    FIXTURE_README,
    created,
    skipped
  );

  return { created, skipped };
}

async function ensureDir(path: string, created: string[]): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
    created.push(path);
    return;
  }

  await mkdir(path, { recursive: true });
}

async function writeIfMissing(
  path: string,
  content: string,
  created: string[],
  skipped: string[]
): Promise<void> {
  if (existsSync(path)) {
    skipped.push(path);
    return;
  }

  await writeFile(path, content, "utf8");
  created.push(path);
}

