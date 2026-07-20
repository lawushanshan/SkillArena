const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

function runService(env) {
  return spawnSync(process.execPath, ["src/app.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env
  });
}

test("fails closed when API_TOKEN is missing", () => {
  const env = { ...process.env };
  delete env.API_TOKEN;

  const result = runService(env);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /development-token/);
});

test("starts without exposing a configured API_TOKEN", () => {
  const result = runService({ ...process.env, API_TOKEN: "test-secret-token" });

  assert.equal(result.status, 0);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /test-secret-token/);
});
