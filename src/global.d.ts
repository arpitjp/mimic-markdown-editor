/**
 * Message obj will be passed from VSCode extension to Webview
 */
export interface ExtensionMessage {
  type: "updateText" | "uploadComplete";
  [key: string]: any; // Allows additional properties of any type
}

/**
 * Message obj will be passed from Webview to VSCode extension
 */
export interface WebviewMessage {
  type: "updateText" | "upload" | "open-link";
  [key: string]: any;  // Allows additional properties of any type
}