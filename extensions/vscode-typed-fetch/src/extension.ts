import * as vscode from "vscode";
import { ChildProcess, exec, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);
let listenerProcess: ChildProcess | undefined;

function getWorkspaceFolderForActiveFile(): vscode.WorkspaceFolder | undefined {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (folder) return folder;
  }
  return vscode.workspace.workspaceFolders?.[0];
}

function getWorkspaceRoot(): string | undefined {
  return getWorkspaceFolderForActiveFile()?.uri.fsPath;
}

function createOutput(): vscode.OutputChannel {
  return vscode.window.createOutputChannel("Typed Fetch Tools");
}

async function runCommand(
  command: string,
  cwd: string,
  output: vscode.OutputChannel,
): Promise<void> {
  output.appendLine(`> ${command}`);
  const { stdout, stderr } = await execAsync(command, { cwd });
  if (stdout) output.appendLine(stdout.trimEnd());
  if (stderr) output.appendLine(stderr.trimEnd());
}

function showFailure(message: string, output: vscode.OutputChannel): void {
  output.show(true);
  vscode.window.showErrorMessage(message);
}

async function generateTypes(output: vscode.OutputChannel): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  try {
    await runCommand("npx typed-fetch generate", root, output);
    vscode.window.showInformationMessage("Typed Fetch: types generated.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showFailure(`Typed Fetch generate failed: ${message}`, output);
  }
}

function startListener(output: vscode.OutputChannel): void {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }
  if (listenerProcess && !listenerProcess.killed) {
    vscode.window.showWarningMessage("Typed Fetch listener is already running.");
    return;
  }

  const config = vscode.workspace.getConfiguration("typedFetchTools");
  const port = Number(config.get("listenPort", 43111));
  const allowNetwork = Boolean(config.get("allowNetwork", false));

  const args = ["typed-fetch", "listen", "--port", String(port)];
  if (allowNetwork) args.push("--allow-network");

  output.appendLine(`> npx ${args.join(" ")}`);
  listenerProcess = spawn("npx", args, {
    cwd: root,
    shell: true,
    windowsHide: true,
  });

  listenerProcess.stdout?.on("data", (d) => output.append(d.toString()));
  listenerProcess.stderr?.on("data", (d) => output.append(d.toString()));
  listenerProcess.on("error", (error) => {
    showFailure(`Typed Fetch listener failed to start: ${error.message}`, output);
    listenerProcess = undefined;
  });
  listenerProcess.on("exit", (code) => {
    output.appendLine(`listener exited with code ${code ?? 0}`);
    listenerProcess = undefined;
  });

  vscode.window.showInformationMessage("Typed Fetch listener started.");
}

function stopListener(output: vscode.OutputChannel): void {
  if (!listenerProcess || listenerProcess.killed) {
    vscode.window.showInformationMessage("Typed Fetch listener is not running.");
    return;
  }

  const pid = listenerProcess.pid;
  if (pid) {
    if (process.platform === "win32") {
      exec(`taskkill /pid ${pid} /t /f`);
    } else {
      listenerProcess.kill("SIGTERM");
    }
  }

  output.appendLine("listener stop requested");
  vscode.window.showInformationMessage("Typed Fetch listener stopped.");
}

async function runCurrentFileAndGenerate(output: vscode.OutputChannel): Promise<void> {
  const root = getWorkspaceRoot();
  const editor = vscode.window.activeTextEditor;
  if (!root || !editor) {
    vscode.window.showErrorMessage("Open a JS/TS file in a workspace first.");
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === ".ts") {
      await runCommand(`npx tsx \"${filePath}\"`, root, output);
    } else {
      await runCommand(`node \"${filePath}\"`, root, output);
    }
    await generateTypes(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showFailure(`Run+Generate failed: ${message}`, output);
  }
}

class TypedFetchCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const regex = /\b(?:typedFetch|tFetch)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
      const pos = document.positionAt(match.index);
      const range = new vscode.Range(pos, pos);
      lenses.push(
        new vscode.CodeLens(range, {
          title: "Typed Fetch: Generate",
          command: "typedFetch.generate",
        }),
      );
      lenses.push(
        new vscode.CodeLens(range, {
          title: "Typed Fetch: Run File + Generate",
          command: "typedFetch.runAndGenerate",
        }),
      );
    }

    return lenses;
  }
}

class TypedFetchHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /typedFetch|tFetch/);
    if (!range) return;

    const word = document.getText(range);
    if (word !== "typedFetch" && word !== "tFetch") return;

    const md = new vscode.MarkdownString(
      [
        "**Typed Fetch Actions**",
        "",
        "- [Generate Types](command:typedFetch.generate)",
        "- [Start Listener](command:typedFetch.listenerStart)",
        "- [Stop Listener](command:typedFetch.listenerStop)",
        "- [Run Current File + Generate](command:typedFetch.runAndGenerate)",
      ].join("\n"),
      true,
    );
    md.isTrusted = true;

    return new vscode.Hover(md, range);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = createOutput();
  output.appendLine("Typed Fetch Tools active");

  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("typedFetch.generate", () => generateTypes(output)),
    vscode.commands.registerCommand("typedFetch.listenerStart", () => startListener(output)),
    vscode.commands.registerCommand("typedFetch.listenerStop", () => stopListener(output)),
    vscode.commands.registerCommand("typedFetch.runAndGenerate", () => runCurrentFileAndGenerate(output)),
    vscode.languages.registerCodeLensProvider(
      [{ language: "typescript" }, { language: "javascript" }],
      new TypedFetchCodeLensProvider(),
    ),
    vscode.languages.registerHoverProvider(
      [{ language: "typescript" }, { language: "javascript" }],
      new TypedFetchHoverProvider(),
    ),
  );
}

export function deactivate(): void {
  if (listenerProcess && !listenerProcess.killed) {
    const pid = listenerProcess.pid;
    if (pid && process.platform === "win32") {
      exec(`taskkill /pid ${pid} /t /f`);
    } else {
      listenerProcess.kill("SIGTERM");
    }
  }
}
