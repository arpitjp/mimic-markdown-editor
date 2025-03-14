import * as vscode from "vscode";
import { MarkdownEditorProvider } from "./markdownEditor";
import { makeDefaultEditor } from "./makeDefaultEditor";
import { debug, setDebugMode } from "./utils";

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
  setDebugMode(context.extensionMode === vscode.ExtensionMode.Development);
  debug(`${context.extension.id} is active..!!`);

  context.subscriptions.push(MarkdownEditorProvider.register(context));
  
  makeDefaultEditor();
}

// This method is called when your extension is deactivated
export function deactivate() {}
