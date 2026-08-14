import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL("../../", import.meta.url)));
const TEST_TMP = join(REPO_ROOT, ".pytest_tmp");

let initialized = false;

async function ensureTestTmp(): Promise<void> {
  if (initialized) return;
  await mkdir(TEST_TMP, { recursive: true });
  initialized = true;
}

export async function makeTempDir(prefix = "test"): Promise<string> {
  await ensureTestTmp();
  return mkdtemp(join(TEST_TMP, `${prefix}-`));
}

export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
