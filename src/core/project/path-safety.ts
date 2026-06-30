import { isAbsolute, relative, resolve } from "node:path";

import { SkillArenaError } from "../errors.js";

export function resolveFixturePath(projectRoot: string, fixturesDir: string, fixture: string): string {
  if (isAbsolute(fixture)) {
    throw new SkillArenaError(`Fixture path must be relative to the project root: ${fixture}`);
  }

  const resolved = resolve(projectRoot, fixture);

  if (!isPathWithin(fixturesDir, resolved)) {
    throw new SkillArenaError(
      `Fixture path must resolve inside the configured fixtures directory: ${fixture}`
    );
  }

  return resolved;
}

export function resolveEvalFilePath(
  cwd: string,
  projectRoot: string,
  evalsDir: string,
  evalFile: string
): string {
  const candidates = isAbsolute(evalFile)
    ? [resolve(evalFile)]
    : [resolve(cwd, evalFile), resolve(projectRoot, evalFile)];

  for (const candidate of candidates) {
    if (isPathWithin(evalsDir, candidate)) {
      return candidate;
    }
  }

  throw new SkillArenaError(
    `Eval file must resolve inside the configured evals directory: ${evalFile}`
  );
}

function isPathWithin(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
