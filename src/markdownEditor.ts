import * as vscode from "vscode";
import path from "path";
import { ExtensionMessage, WebviewMessage } from "./global";
import { EXTENSION_NAME, VIEW_TYPE } from "./constants";
import { debounce, debug, isDebugMode } from "./utils";

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      new MarkdownEditorProvider(context),
      {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: {
          retainContextWhenHidden: true // todo: Perf -- revisit retainContextWhenHIdden
        }, 
      }
    );
		return providerRegistration;
  }

  static get config() {
    return vscode.workspace.getConfiguration(EXTENSION_NAME);
  }

  #textDoc!: vscode.TextDocument;
  #docUri!: vscode.Uri;
  #webviewPanel!: vscode.WebviewPanel;

  constructor(
		private readonly context: vscode.ExtensionContext
  ) { }

  /**
	 * Called when the custom editor is opened.
	 */
  resolveCustomTextEditor = async (
    textDoc: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    // _token: vscode.CancellationToken
  ): Promise<void> => {
    this.#textDoc = textDoc;
    this.#webviewPanel = webviewPanel;
    this.#docUri = this.#textDoc.uri;

    // Setup initial content for the webview
    this.#webviewPanel.webview.options = {
      enableScripts: true,
    };
    this.#webviewPanel.webview.html = this.#getHtmlForWebview();
    
    // Listen for textDoc changes and send them to webview
    this.#setupTextDocEventListeners();

    // sync initial text with webview
    this.#sendMsgToWebView({
      type: "updateText",
      text: await this.#getDocText(),
    });
  };

  #getExtensionConfigs = () => {
    let a = "";
    return {
      isDebugMode: isDebugMode(),
      tableOfContents: MarkdownEditorProvider.config.get<any>("tableOfContents"),
      showToolbar: MarkdownEditorProvider.config.get<any>("showToolbar"),
      imageDefaultConfig: MarkdownEditorProvider.config.get<any>("imageDefaultConfig"),
    };
  };
  
  #getHtmlForWebview = (): string => {
    const toUri = (f: string) =>
      this.#webviewPanel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, f));
    const toMediaPath = (f: string) => `dist/webview/${f}`;
    const jsFiles = ["index.js"].map(toMediaPath).map(toUri);
    const cssFiles = ["index.css"].map(toMediaPath).map(toUri);
    const configs = this.#getExtensionConfigs();
    const baseHref =
      path.dirname(
        this.#webviewPanel.webview.asWebviewUri(vscode.Uri.file(this.#docUri.fsPath)).toString()
      ) + "/";
    debug("baseHref", baseHref);
    
    return `
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <title>Mimic Markdown Editor</title>

      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <base href="${baseHref}" />

      ${cssFiles.map((f) => `<link href="${f}" rel="stylesheet">`).join("\n")}
      <style>` +
        MarkdownEditorProvider.config.get<string>("customCss") +
      `</style>

      <script>
        window.extensionConfigs = JSON.parse('${JSON.stringify(configs)}');
      </script>
    </head>

    <body>
      <div id="webview-vditor"></div>

      ${jsFiles.map((f) => `<script type="module" src="${f}"></script>`).join("\n")}
    </body>

    </html>
    `;
  };

  #setupTextDocEventListeners = () => {
    const textChangeSubscription = vscode.workspace.onDidChangeTextDocument(
      debounce(this.#syncTextEdit));
    
    const messageSubscription = this.#webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.type) {
        case "updateText":
          this.#saveText(message.text);
          return;

        case "open-link": {
          let url = message.href;
          if (!/^http/.test(url)) {
            url = path.resolve(this.#docUri.fsPath, "..", url);
          }
          vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(url));
          break;
        }

        case "upload": {
          const assetsFolder = this.#getAssetsFolder();
          try {
            await vscode.workspace.fs.createDirectory(
              vscode.Uri.file(assetsFolder)
            );
          } catch (error) {
            vscode.window.showErrorMessage(`Cannot find original file to save: ${error}`);
          }
          await Promise.all(
            message.files.map(async (f: any) => {
              const content = Buffer.from(f.base64, "base64");
              return vscode.workspace.fs.writeFile(
                vscode.Uri.file(path.join(assetsFolder, f.name)),
                content
              );
            })
          );
          const files = message.files.map((f: any) =>
            path.relative(
              path.dirname(this.#docUri.fsPath),
              path.join(assetsFolder, f.name)
            ).replace(/\\/g, "/")
          );
          
          this.#sendMsgToWebView({
            type: "uploadComplete",
            files,
          });
          break;
        }
      }
    });

    // Dispose off listener when the editor is closed.
    this.#webviewPanel.onDidDispose(() => {
      messageSubscription.dispose();
      textChangeSubscription.dispose();
    });
  };

  #syncTextEdit = async (e: vscode.TextDocumentChangeEvent) => {
    // A single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)
    if (e.document.uri.toString() !== this.#textDoc.uri.toString()) {
      return;
    }

    // Prevent synchronization loops:  
    // When the webview panel is activated, ignore updates in the VS Code editor  
    // that were triggered by edits from the webview. 
    if (this.#webviewPanel.active) {
      return;
    }
    
    this.#sendMsgToWebView({
      type: "updateText",
      text: await this.#getDocText(),
    });
  };

  #saveText = async (text: string) => {
    if (this.#textDoc) {
      debug("Saving text via text doc");
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        this.#textDoc.uri,
        new vscode.Range(0, 0, this.#textDoc.lineCount, 0),
        text,
      );
      await vscode.workspace.applyEdit(edit);
    } else if (this.#docUri) {
      debug("Saving via fs, text doc not found");
      const uint8Array = new TextEncoder().encode(text);
      await vscode.workspace.fs.writeFile(this.#docUri, uint8Array);
    } else {
      vscode.window.showErrorMessage("Cannot find original file to save");
    }
  };

  #sendMsgToWebView = (msg: ExtensionMessage) => {
    this.#webviewPanel.webview.postMessage(msg);
  };

  #getDocText = async (): Promise<string> => {
    const text = this.#textDoc
      ? this.#textDoc.getText()
      : (await vscode.workspace.fs.readFile(this.#docUri)).toString();
    return text;
  };

  #getAssetsFolder = () => {
    const assetsFolder = (MarkdownEditorProvider.config.get<string>("assetsFolder") || "assets") 
      .replace(
        "${projectRoot}",
        vscode.workspace.getWorkspaceFolder(this.#docUri)?.uri.fsPath || ""
      )
      .replace("${file}", this.#docUri.fsPath)
      .replace(
        "${fileBasenameNoExtension}",
        path.basename(this.#docUri.fsPath, path.extname(this.#docUri.fsPath))
      )
      .replace("${dir}", path.dirname(this.#docUri.fsPath));
    
    return path.resolve(
      path.dirname(this.#docUri.fsPath),
      assetsFolder
    );
  };
}