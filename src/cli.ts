#!/usr/bin/env node
import boxen from "boxen";
import { Command } from "commander";
import figlet from "figlet";
import pc from "picocolors";
import { join } from "path";
import { getDefaultConfig } from "./core/config";
import { checkTypes, cleanArtifacts, generateTypes } from "./generator";
import { startListener } from "./listener";

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

function initProject(force: boolean, configPath?: string): { configPath: string; created: boolean } {
  const targetPath = configPath ?? "typed-fetch.config.json";
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs") as typeof import("fs");
  if (fs.existsSync(targetPath) && !force) {
    return { configPath: targetPath, created: false };
  }

  const config = getDefaultConfig();
  fs.writeFileSync(`${targetPath}`, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  const gitignorePath = ".gitignore";
  const registryIgnoreLine = ".typed-fetch/";
  const existingIgnore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  if (!existingIgnore.split(/\r?\n/).includes(registryIgnoreLine)) {
    const next = existingIgnore.length > 0 && !existingIgnore.endsWith("\n")
      ? `${existingIgnore}\n${registryIgnoreLine}\n`
      : `${existingIgnore}${registryIgnoreLine}\n`;
    fs.writeFileSync(gitignorePath, next, "utf8");
  }

  return { configPath: targetPath, created: true };
}

function renderListenBanner(args: {
  host: string;
  port: number;
  allowNetwork: boolean;
  generateOnSync: boolean;
}): string {
  const title = figlet.textSync("typed-fetch", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  const heading = pc.cyan(title);
  const url = `http://${args.host}:${args.port}/sync`;
  const details = [
    `${pc.bold("Mode")}      Listener`,
    `${pc.bold("Sync URL")}  ${pc.green(url)}`,
    `${pc.bold("Scope")}     ${
      args.allowNetwork ? pc.yellow("Network-enabled") : pc.green("Localhost-only")
    }`,
    `${pc.bold("Typegen")}   ${
      args.generateOnSync ? pc.green("Auto-generate on sync") : pc.yellow("Manual generate")
    }`,
    `${pc.bold("Health")}    ${pc.green(`http://${args.host}:${args.port}/health`)}`,
    "",
    pc.dim("Press Ctrl+C to stop listener."),
  ].join("\n");

  return `${heading}\n${boxen(details, { padding: 1, borderStyle: "round", borderColor: "cyan" })}`;
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
          }. Run "typed-fetch generate".\n`
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
    .action((options: { config?: string; generated?: boolean; registry?: boolean }) => {
      cleanArtifacts(
        {},
        { configPath: options.config },
        {
          generated: Boolean(options.generated),
          registry: Boolean(options.registry),
        }
      );
      process.stdout.write(`${pc.green("Clean complete.")}\n`);
    });

  program
    .command("listen")
    .description("Start sync listener for browser/server observation")
    .option("--config <path>", "Path to config file")
    .option("--port <number>", "Listener port", "43111")
    .option("--host <host>", "Listener host", "127.0.0.1")
    .option("--allow-network", "Allow non-loopback clients")
    .option("--no-generate", "Disable auto type generation on sync")
    .action(
      async (options: {
        config?: string;
        port: string;
        host: string;
        allowNetwork?: boolean;
        generate?: boolean;
      }) => {
      const port = Number(options.port);
      if (!Number.isFinite(port) || port < 0 || port > 65535) {
        process.stderr.write(`${pc.red("Invalid port")} "${options.port}"\n`);
        process.exit(1);
      }

      try {
        const listener = await startListener({
          port,
          host: options.host,
          configPath: options.config,
          allowNetwork: Boolean(options.allowNetwork),
          generateOnSync: options.generate !== false,
        });
        process.stdout.write(
          `${renderListenBanner({
            host: options.host,
            port: listener.port,
            allowNetwork: Boolean(options.allowNetwork),
            generateOnSync: options.generate !== false,
          })}\n`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        process.stderr.write(`${pc.red("Failed to start listener")}: ${message}\n`);
        process.exit(1);
      }
      }
    );

  program
    .command("init")
    .description("Create typed-fetch config and gitignore entries")
    .option("--config <path>", "Path to config file")
    .option("--force", "Overwrite existing config")
    .action((options: { config?: string; force?: boolean }) => {
      const result = initProject(Boolean(options.force), options.config);
      if (!result.created) {
        process.stdout.write(
          `${pc.yellow("Config exists")}: ${result.configPath}. Use --force to overwrite.\n`
        );
        return;
      }
      process.stdout.write(`${pc.green("Initialized")} ${result.configPath}\n`);
    });

  await program.parseAsync(process.argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${pc.red("CLI error")}: ${message}\n`);
  process.exit(1);
});
