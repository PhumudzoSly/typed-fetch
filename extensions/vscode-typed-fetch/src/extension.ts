import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";

const execAsync = promisify(exec);

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

function startWatch(): void {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const terminal = vscode.window.createTerminal({
    name: "Typed Fetch Watch",
    cwd: root,
  });
  terminal.show();
  terminal.sendText("npx typed-fetch watch");
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
      await runCommand(`npx tsx "${filePath}"`, root, output);
    } else {
      await runCommand(`node "${filePath}"`, root, output);
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
          title: "Typed Fetch: Watch",
          command: "typedFetch.watch",
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
        "- [Watch (auto-regenerate)](command:typedFetch.watch)",
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
    vscode.commands.registerCommand("typedFetch.watch", () => startWatch()),
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
  // No persistent processes to clean up.
}
