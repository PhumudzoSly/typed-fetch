const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { loadRegistry, parseRegistryJson } = require("../dist/core/registry");

test("loadRegistry resets on corrupt registry file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-corrupt-"));
  const registryPath = path.join(tempDir, "registry.json");
  fs.writeFileSync(registryPath, "{ broken json", "utf8");

  const registry = loadRegistry(registryPath);
  assert.equal(registry.version, 2);
  assert.deepEqual(registry.endpoints, {});

  // Corrupt file is deleted, not backed up.
  assert.equal(fs.existsSync(registryPath), false);
});

test("loadRegistry resets on outdated registry version", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typed-fetch-old-"));
  const registryPath = path.join(tempDir, "registry.json");
  fs.writeFileSync(registryPath, JSON.stringify({ version: 1, endpoints: {} }), "utf8");

  const registry = loadRegistry(registryPath);
  assert.equal(registry.version, 2);
  assert.deepEqual(registry.endpoints, {});
  assert.equal(fs.existsSync(registryPath), false);
});

test("parseRegistryJson returns null for malformed or invalid data", () => {
  assert.equal(parseRegistryJson("{ bad json"), null);
  assert.equal(parseRegistryJson(JSON.stringify({ version: 1, endpoints: {} })), null);
  assert.equal(parseRegistryJson(JSON.stringify({ version: 2, endpoints: [] })), null);
});

test("parseRegistryJson returns registry for valid structure", () => {
  const parsed = parseRegistryJson(JSON.stringify({ version: 2, endpoints: {} }));
  assert.deepEqual(parsed, { version: 2, endpoints: {} });
});
