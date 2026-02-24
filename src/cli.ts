#!/usr/bin/env node
import boxen from "boxen";
import { Command } from "commander";
import figlet from "figlet";
import pc from "picocolors";
import { checkTypes, cleanArtifacts, generateTypes } from "./generator";
import { startListener } from "./listener";

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
    .version("0.0.1");

  program
    .command("generate")
    .description("Generate declaration types from registry")
    .action(() => {
      const result = generateTypes();
      process.stdout.write(`${pc.green("Generated")} ${result.outputPath}\n`);
    });

  program
    .command("check")
    .description("Check if generated types are up-to-date")
    .action(() => {
      const result = checkTypes();
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
    .option("--generated", "Remove generated file only")
    .option("--registry", "Remove registry only")
    .action((options: { generated?: boolean; registry?: boolean }) => {
      cleanArtifacts(
        {},
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
    .option("--port <number>", "Listener port", "43111")
    .option("--host <host>", "Listener host", "127.0.0.1")
    .option("--allow-network", "Allow non-loopback clients")
    .option("--no-generate", "Disable auto type generation on sync")
    .action(
      async (options: {
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

  await program.parseAsync(process.argv);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`${pc.red("CLI error")}: ${message}\n`);
  process.exit(1);
});
