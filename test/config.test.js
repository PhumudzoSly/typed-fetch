const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getDefaultConfig, loadConfig } = require("../dist/core/config");

test("loadConfig sanitizes invalid override values", () => {
  const defaults = getDefaultConfig();
  const config = loadConfig({
    maxDepth: -1,
    maxArraySample: 0,
    include: ["/allowed", 123],
    exclude: "not-array",
    dynamicSegmentPatterns: ["numeric", "invalid"],
    observerMode: "weird",
    strictPrivacyMode: "yes",
    ignoreFieldNames: ["SECRET", 42],
    syncTimeoutMs: -20,
    browserStorageKey: "",
  });

  assert.equal(config.maxDepth, defaults.maxDepth);
  assert.equal(config.maxArraySample, defaults.maxArraySample);
  assert.deepEqual(config.include, ["/allowed"]);
  assert.deepEqual(config.exclude, defaults.exclude);
  assert.deepEqual(config.dynamicSegmentPatterns, ["numeric"]);
  assert.equal(config.observerMode, defaults.observerMode);
  assert.equal(config.strictPrivacyMode, defaults.strictPrivacyMode);
  assert.deepEqual(config.ignoreFieldNames, ["secret"]);
  assert.equal(config.syncTimeoutMs, defaults.syncTimeoutMs);
  assert.equal(config.browserStorageKey, defaults.browserStorageKey);
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
