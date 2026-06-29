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
  - name: sample-audit
    path: .codex/skills/sample-audit
`;

const EVAL_TEMPLATE = `name: sample-audit
agent: codex
skill:
  name: sample-audit
  path: .codex/skills/sample-audit
cases:
  - id: creates-audit-report
    prompt: "Review this small project, create audit-report.md, add an Audit Notes section to README.md, and leave package.json unchanged."
    workspace:
      fixture: fixtures/sample-workspace
    expect:
      commands_succeeded: true
      files_created:
        - audit-report.md
      files_changed:
        - README.md
      files_unchanged:
        - package.json
`;

const FIXTURE_README = `# Sample Workspace

This fixture is used by SkillArena's generated sample audit eval.
`;

const FIXTURE_PACKAGE_JSON = `{
  "name": "sample-workspace",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node src/app.js"
  }
}
`;

const FIXTURE_APP_JS = `const secret = process.env.SAMPLE_TOKEN || "development-token";

console.log("sample workspace", secret.length);
`;

export async function initProject(rootDir: string): Promise<InitProjectResult> {
  const created: string[] = [];
  const skipped: string[] = [];

  await ensureDir(resolve(rootDir, "evals"), created);
  await ensureDir(resolve(rootDir, "fixtures", "sample-workspace"), created);
  await ensureDir(resolve(rootDir, "fixtures", "sample-workspace", "src"), created);
  await ensureDir(resolve(rootDir, ".skillarena", "runs"), created);

  await writeIfMissing(resolve(rootDir, "skillarena.yaml"), CONFIG_TEMPLATE, created, skipped);
  await writeIfMissing(resolve(rootDir, "evals", "sample-audit.yaml"), EVAL_TEMPLATE, created, skipped);
  await writeIfMissing(
    resolve(rootDir, "fixtures", "sample-workspace", "README.md"),
    FIXTURE_README,
    created,
    skipped
  );
  await writeIfMissing(
    resolve(rootDir, "fixtures", "sample-workspace", "package.json"),
    FIXTURE_PACKAGE_JSON,
    created,
    skipped
  );
  await writeIfMissing(
    resolve(rootDir, "fixtures", "sample-workspace", "src", "app.js"),
    FIXTURE_APP_JS,
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
