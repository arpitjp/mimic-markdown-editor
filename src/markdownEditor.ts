import * as vscode from "vscode";
import * as path from "path";
import { Message } from "./global";

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  /**
   *  This matches "contributes.customEditors.viewType" in package.json
   */
  static readonly #viewType = "mimic-markdown-editor.WYSIWYG";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MarkdownEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(MarkdownEditorProvider.#viewType, provider);
		return providerRegistration;
  }

  #textDoc!: vscode.TextDocument;

  #webviewPanel!: vscode.WebviewPanel;

  constructor(
		private readonly context: vscode.ExtensionContext
  ) { }


  /**
	 * Called when the custom editor is opened.
	 */
	async resolveCustomTextEditor(
		textDoc: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
  ): Promise<void> {
    this.#textDoc = textDoc;
    this.#webviewPanel = webviewPanel;

		// Setup initial content for the webview
    this.#webviewPanel.webview.options = {
			enableScripts: true,
		};
    this.#webviewPanel.webview.html = this.#getHtmlForWebview();
    
    // Listen for textDoc changes and send them to webview
    this.#setupTextDocEventListeners();
  }
  
  #getHtmlForWebview(): string {
    const toUri = (f: string) =>
      this.#webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, f));
    const toMediaPath = (f: string) => `dist/webview/${f}`;
    const jsFiles = ["index.js"].map(toMediaPath).map(toUri);
    const cssFiles = ["index.css"].map(toMediaPath).map(toUri);
    
    return `
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${cssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join("\n")}
      <title>Mimic Markdown Editor</title>
    </head>

    <body>
      <div id="webview-vditor"></div>

      ${jsFiles.map((f) => `<script type="module" src="${f}"></script>`).join("\n")}
    </body>

    </html>
    `;
  }

  #setupTextDocEventListeners() {
    const openDocumentSubscription = vscode.workspace.onDidChangeTextDocument(this.#updateTextInWebView);
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(this.#updateTextInWebView);

		// Dispose off listener when the editor is closed.
    this.#webviewPanel.onDidDispose(() => {
      openDocumentSubscription.dispose();
			changeDocumentSubscription.dispose();
		});
  }


  #updateTextInWebView(e: vscode.TextDocumentChangeEvent) {
    // A single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)
    if (e.document.uri.toString() === this.#textDoc.uri.toString() || true) {
      this.#sendMsgToWebView({
				type: "update",
				text: this.#textDoc.getText(),
			});
    }
  }

  #sendMsgToWebView(msg: Message) {
    this.#webviewPanel.webview.postMessage(msg);
  }

  #receiveMsgFromWebView(webview: vscode.Webview) {

  }
}