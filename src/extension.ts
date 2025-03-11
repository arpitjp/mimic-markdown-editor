import * as vscode from "vscode";
import { MarkdownEditorProvider } from "./markdownEditor";

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(MarkdownEditorProvider.register(context));
}

// This method is called when your extension is deactivated
export function deactivate() {}
