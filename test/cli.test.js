/**
 * Integration tests for the typed-fetch CLI (dist/cli.js).
 *
 * Each test spawns the CLI as a subprocess via spawnSync so the tests are
 * isolated from each other and from the host process. Covers: init, generate,
 * check, clean, export, import. The watch command is long-running and is
 * excluded here.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const CLI = path.resolve(__dirname, "../dist/cli.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tfetch-cli-test-"));
}

function cli(args, cwd, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 15_000,
  });
}

/**
 * Writes a minimal registry file and a typed-fetch config to `dir`.
 * Returns { registryPath, generatedPath, configPath }.
 */
function scaffoldWithRegistry(dir) {
  const registryPath = path.join(dir, ".typed-fetch", "registry.json");
  const generatedPath = path.join(dir, "typed-fetch.d.ts");
  const configPath = path.join(dir, "typed-fetch.config.json");

  fs.mkdirSync(path.dirname(registryPath), { recursive: true });

  const registry = {
    version: 2,
    endpoints: {
      "GET /users/:id": {
        responses: {
          200: {
            kind: "object",
            fields: { id: { shape: { kind: "number" } } },
          },
        },
        meta: {
          seenCount: 1,
          lastSeenAt: new Date().toISOString(),
          observedPaths: [],
        },
      },
    },
  };
  fs.writeFileSync(registryPath, `${JSON.stringify(registry)}\n`, "utf8");

  const config = {
    registryPath: ".typed-fetch/registry.json",
    generatedPath: "typed-fetch.d.ts",
    observerMode: "none",
  };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return { registryPath, generatedPath, configPath };
}

// ─── init ─────────────────────────────────────────────────────────────────────

test("cli init: creates typed-fetch.config.json in an empty directory", () => {
  const dir = makeTempDir();
  const result = cli(["init"], dir);

  assert.equal(
    result.status,
    0,
    `init exited with ${result.status}. stderr: ${result.stderr}`,
  );
  assert.ok(
    fs.existsSync(path.join(dir, "typed-fetch.config.json")),
    "config file should be created",
  );
});

test("cli init: running init twice does not overwrite existing config", () => {
  const dir = makeTempDir();
  cli(["init"], dir); // First run.
  const originalContent = fs.readFileSync(
    path.join(dir, "typed-fetch.config.json"),
    "utf8",
  );

  const result = cli(["init"], dir); // Second run.
  assert.equal(result.status, 0, "second init should not error");
  const afterContent = fs.readFileSync(
    path.join(dir, "typed-fetch.config.json"),
    "utf8",
  );
  assert.equal(
    afterContent,
    originalContent,
    "config file should not be overwritten on second init",
  );
});

// ─── generate ─────────────────────────────────────────────────────────────────

test("cli generate: creates .d.ts file from registry", () => {
  const dir = makeTempDir();
  const { generatedPath, configPath } = scaffoldWithRegistry(dir);

  const result = cli(["generate", "--config", configPath], dir);
  assert.equal(result.status, 0, `generate failed. stderr: ${result.stderr}`);
  assert.ok(fs.existsSync(generatedPath), "generated .d.ts should exist");
  const dts = fs.readFileSync(generatedPath, "utf8");
  assert.ok(
    dts.includes("GET /users/:id"),
    "generated file should contain the endpoint key",
  );
});

test("cli generate: exits 0 when registry is empty (produces minimal types file)", () => {
  const dir = makeTempDir();
  const configPath = path.join(dir, "typed-fetch.config.json");
  const config = {
    registryPath: ".typed-fetch/registry.json",
    generatedPath: "typed-fetch.d.ts",
    observerMode: "none",
  };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const result = cli(["generate", "--config", configPath], dir);
  assert.equal(
    result.status,
    0,
    `generate with empty registry should exit 0. stderr: ${result.stderr}`,
  );
});

// ─── check ────────────────────────────────────────────────────────────────────

test("cli check: exits 0 when generated file is up-to-date", () => {
  const dir = makeTempDir();
  const { configPath } = scaffoldWithRegistry(dir);

  // Generate first.
  cli(["generate", "--config", configPath], dir);

  const result = cli(["check", "--config", configPath], dir);
  assert.equal(
    result.status,
    0,
    `check should pass after generate. stderr: ${result.stderr}`,
  );
});

test("cli check: exits non-zero when generated file is stale", () => {
  const dir = makeTempDir();
  const { generatedPath, configPath } = scaffoldWithRegistry(dir);

  // Write a stale/wrong .d.ts.
  fs.writeFileSync(generatedPath, "// stale\n", "utf8");

  const result = cli(["check", "--config", configPath], dir);
  assert.notEqual(
    result.status,
    0,
    "check should fail when generated file is stale",
  );
});

// ─── clean ────────────────────────────────────────────────────────────────────

test("cli clean: removes both registry and generated file", () => {
  const dir = makeTempDir();
  const { registryPath, generatedPath, configPath } = scaffoldWithRegistry(dir);
  cli(["generate", "--config", configPath], dir); // Ensure .d.ts exists.

  const result = cli(["clean", "--config", configPath], dir);
  assert.equal(result.status, 0, `clean failed. stderr: ${result.stderr}`);
  assert.ok(!fs.existsSync(registryPath), "registry should be removed");
  assert.ok(!fs.existsSync(generatedPath), "generated file should be removed");
});

test("cli clean: is idempotent — running twice does not error", () => {
  const dir = makeTempDir();
  const { configPath } = scaffoldWithRegistry(dir);

  cli(["clean", "--config", configPath], dir);
  const result = cli(["clean", "--config", configPath], dir);
  assert.equal(result.status, 0, "second clean should not error");
});

// ─── export ───────────────────────────────────────────────────────────────────

test("cli export: outputs valid JSON to stdout", () => {
  const dir = makeTempDir();
  const { configPath } = scaffoldWithRegistry(dir);

  const result = cli(["export", "--config", configPath], dir);
  assert.equal(result.status, 0, `export failed. stderr: ${result.stderr}`);

  let exported;
  assert.doesNotThrow(() => {
    exported = JSON.parse(result.stdout);
  }, "export output should be valid JSON");
  assert.ok(exported.endpoints, "exported JSON should have an endpoints field");
  assert.ok(
    exported.endpoints["GET /users/:id"],
    "exported endpoints should include GET /users/:id",
  );
});

// ─── import ───────────────────────────────────────────────────────────────────

test("cli import: merges exported registry into a fresh registry", () => {
  const source = makeTempDir();
  const target = makeTempDir();

  const { configPath: sourceConfig } = scaffoldWithRegistry(source);
  const targetConfigPath = path.join(target, "typed-fetch.config.json");
  const targetConfig = {
    registryPath: ".typed-fetch/registry.json",
    generatedPath: "typed-fetch.d.ts",
    observerMode: "none",
  };
  fs.writeFileSync(
    targetConfigPath,
    `${JSON.stringify(targetConfig, null, 2)}\n`,
    "utf8",
  );

  // Export from source to a file.
  const exportResult = cli(["export", "--config", sourceConfig], source);
  assert.equal(exportResult.status, 0, "export should succeed");

  const exportedFile = path.join(target, "import-source.json");
  fs.writeFileSync(exportedFile, exportResult.stdout, "utf8");

  // Import into target.
  const importResult = cli(
    ["import", exportedFile, "--config", targetConfigPath],
    target,
  );
  assert.equal(
    importResult.status,
    0,
    `import failed. stderr: ${importResult.stderr}`,
  );

  // Verify that the target registry now has the endpoint from the source.
  const { loadRegistry } = require("../dist/core/registry");
  const registry = loadRegistry(
    path.join(target, ".typed-fetch", "registry.json"),
  );
  assert.ok(
    registry.endpoints["GET /users/:id"],
    "imported endpoint should be present in target registry",
  );
});
