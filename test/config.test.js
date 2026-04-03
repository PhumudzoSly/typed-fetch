const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig, loadConfig } = require("../dist/core/config");

test("loadConfig merges file config with defaults", () => {
  const defaults = getDefaultConfig();
  const config = loadConfig({ maxDepth: 4, strictPrivacyMode: false });

  assert.equal(config.maxDepth, 4);
  assert.equal(config.strictPrivacyMode, false);
  assert.equal(config.registryPath, defaults.registryPath);
  assert.deepEqual(config.ignoreFieldNames, defaults.ignoreFieldNames);
});

test("loadConfig uses defaults when no overrides provided", () => {
  const defaults = getDefaultConfig();
  const config = loadConfig();

  assert.deepEqual(config, defaults);
});

test("loadConfig supports explicit config file paths", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-config-"));
  const configPath = path.join(tempDir, "custom-config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        registryPath: "tmp/registry.json",
        generatedPath: "tmp/typed-fetch.d.ts",
        strictPrivacyMode: false,
      },
      null,
      2
    ),
    "utf8"
  );

  const config = loadConfig({}, { configPath });
  assert.equal(config.registryPath, "tmp/registry.json");
  assert.equal(config.generatedPath, "tmp/typed-fetch.d.ts");
  assert.equal(config.strictPrivacyMode, false);
});
