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

function isPathWithin(parent: string, child: string): boolean {
  const relativePath = relative(resolve(parent), resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
