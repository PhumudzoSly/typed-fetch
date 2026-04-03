#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { join } from "path";
import { loadConfig, getDefaultConfig } from "./core/config";
import { checkTypes, cleanArtifacts, generateTypes } from "./generator";
import {
  loadRegistry,
  mergeRegistryIntoPath,
  observeManyToRegistryPath,
  parseRegistryJson,
} from "./core/registry";
import type { ShapeNode } from "./core/types";

function readCliVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const packageJsonPath = join(__dirname, "..", "package.json");
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      version?: string;
    };
    if (parsed.version && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // fallback below
  }
  return "0.0.0";
}

function initProject(
  force: boolean,
  configPath?: string,
): { configPath: string; created: boolean } {
  const targetPath = configPath ?? "typed-fetch.config.json";
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (fs.existsSync(targetPath) && !force) {
    return { configPath: targetPath, created: false };
  }

  const config = getDefaultConfig();
  fs.writeFileSync(
    `${targetPath}`,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );

  const gitignorePath = ".gitignore";
  const registryIgnoreLine = ".typed-fetch/";
  const existingIgnore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  if (!existingIgnore.split(/\r?\n/).includes(registryIgnoreLine)) {
    const next =
      existingIgnore.length > 0 && !existingIgnore.endsWith("\n")
        ? `${existingIgnore}\n${registryIgnoreLine}\n`
        : `${existingIgnore}${registryIgnoreLine}\n`;
    fs.writeFileSync(gitignorePath, next, "utf8");
  }

  return { configPath: targetPath, created: true };
}

async function run(): Promise<void> {
  const program = new Command();

  program
    .name("typed-fetch")
    .description("Privacy-first status-aware typed fetch with type generation")
    .version(readCliVersion());

  program
    .command("generate")
    .description("Generate declaration types from registry")
    .option("--config <path>", "Path to config file")
    .action((options: { config?: string }) => {
      const result = generateTypes({}, { configPath: options.config });
      process.stdout.write(`${pc.green("Generated")} ${result.outputPath}\n`);
      for (const warning of result.warnings) {
        process.stdout.write(`${pc.yellow("Warning")} ${warning}\n`);
      }
    });

  program
    .command("check")
    .description("Check if generated types are up-to-date")
    .option("--config <path>", "Path to config file")
    .action((options: { config?: string }) => {
      const result = checkTypes({}, { configPath: options.config });
      if (!result.ok) {
        process.stderr.write(
          `${pc.red("Generated types are stale")}: ${
            result.outputPath
          }. Run "typed-fetch generate".\n`,
        );
        process.exit(1);
      }
      process.stdout.write(`${pc.green("Up-to-date")}: ${result.outputPath}\n`);
    });

  program
    .command("clean")
    .description("Remove generated files and/or registry")
    .option("--config <path>", "Path to config file")
    .option("--generated", "Remove generated file only")
    .option("--registry", "Remove registry only")
    .action(
      (options: {
        config?: string;
        generated?: boolean;
        registry?: boolean;
      }) => {
        cleanArtifacts(
          {},
          { configPath: options.config },
          {
            generated: Boolean(options.generated),
            registry: Boolean(options.registry),
          },
        );
        process.stdout.write(`${pc.green("Clean complete.")}\n`);
      },
    );

  program
    .command("watch")
    .description(
      "Watch registry for changes and regenerate types automatically",
    )
    .option("--config <path>", "Path to config file")
    .action((options: { config?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs") as typeof import("fs");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const http = require("http") as typeof import("http");
      const config = loadConfig({}, { configPath: options.config });
      const registryPath = config.registryPath;
      const observerPort = config.observerPort;

      process.stdout.write(`${pc.cyan("Watching")} ${registryPath}\n`);
      process.stdout.write(
        `${pc.cyan("Observer")} listening on http://localhost:${observerPort}\n`,
      );
      process.stdout.write(pc.dim("  Press Ctrl+C to stop.\n"));

      let debounceTimer: NodeJS.Timeout | null = null;

      function regen(): void {
        try {
          const result = generateTypes({}, { configPath: options.config });
          process.stdout.write(
            `${pc.green("Generated")} ${result.outputPath}\n`,
          );
          for (const warning of result.warnings) {
            process.stdout.write(`${pc.yellow("Warning")} ${warning}\n`);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          process.stderr.write(`${pc.red("Generate failed")}: ${message}\n`);
        }
      }

      function scheduleRegen(): void {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(regen, 150);
      }

      function startWatcher(): void {
        if (!fs.existsSync(registryPath)) {
          // Registry doesn't exist yet — poll until it appears.
          setTimeout(startWatcher, 500);
          return;
        }

        fs.watch(registryPath, scheduleRegen);
      }

      startWatcher();

      // HTTP observer server — receives observations from browser runtimes.
      const server = http.createServer((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === "POST" && req.url === "/__typed-fetch/observe") {
          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              const obs = JSON.parse(body) as {
                endpointKey: string;
                status: number;
                shape: ShapeNode;
                observedAt: string;
                rawPath?: string;
              };
              observeManyToRegistryPath({
                registryPath,
                observations: [
                  {
                    endpointKey: obs.endpointKey,
                    status: obs.status,
                    shape: obs.shape,
                    observedAt: new Date(obs.observedAt),
                    rawPath: obs.rawPath,
                  },
                ],
              });
              scheduleRegen();
              res.writeHead(204);
              res.end();
            } catch {
              res.writeHead(400);
              res.end();
            }
          });
          return;
        }

        res.writeHead(404);
        res.end();
      });

      server.listen(observerPort, "127.0.0.1");
    });

  program
    .command("init")
    .description("Create typed-fetch config and gitignore entries")
    .option("--config <path>", "Path to config file")
    .option("--force", "Overwrite existing config")
    .action((options: { config?: string; force?: boolean }) => {
      const result = initProject(Boolean(options.force), options.config);
      if (!result.created) {
        process.stdout.write(
          `${pc.yellow("Config exists")}: ${result.configPath}. Use --force to overwrite.\n`,
        );
        return;
      }
      process.stdout.write(`${pc.green("Initialized")} ${result.configPath}\n`);
    });

  program
    .command("export")
    .description("Export the registry as JSON (stdout or --output <path>)")
    .option("--config <path>", "Path to config file")
    .option("--output <path>", "Write to a file instead of stdout")
    .action((options: { config?: string; output?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs") as typeof import("fs");
      const config = loadConfig({}, { configPath: options.config });
      const registry = loadRegistry(config.registryPath);
      const json = `${JSON.stringify(registry, null, 2)}\n`;

      if (options.output) {
        fs.writeFileSync(options.output, json, "utf8");
        const count = Object.keys(registry.endpoints).length;
        process.stdout.write(
          `${pc.green("Exported")} ${count} endpoint(s) to ${options.output}\n`,
        );
      } else {
        process.stdout.write(json);
      }
    });

  program
    .command("import")
    .description("Merge a registry JSON file into the local registry")
    .argument("<file>", "Path to the registry JSON file to import")
    .option("--config <path>", "Path to config file")
    .action((file: string, options: { config?: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs") as typeof import("fs");
      if (!fs.existsSync(file)) {
        process.stderr.write(`${pc.red("File not found")}: ${file}\n`);
        process.exit(1);
      }

      const config = loadConfig({}, { configPath: options.config });
      const raw = fs.readFileSync(file, "utf8");
      const incoming = parseRegistryJson(raw);
      if (!incoming) {
        process.stderr.write(`${pc.red("Invalid registry file")}: ${file}\n`);
        process.exit(1);
      }
      const incomingCount = Object.keys(incoming.endpoints).length;

      if (incomingCount === 0) {
        process.stdout.write(
          `${pc.yellow("Nothing to import")}: ${file} is empty or invalid.\n`,
        );
        return;
      }

      mergeRegistryIntoPath(config.registryPath, incoming);

      process.stdout.write(
        `${pc.green("Merged")} ${incomingCount} endpoint(s) from ${file} into ${config.registryPath}\n`,
      );
    });

  await program.parseAsync(process.argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${pc.red("CLI error")}: ${message}\n`);
  process.exit(1);
});
