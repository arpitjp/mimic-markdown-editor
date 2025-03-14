/**
 * Message obj will be passed from VSCode extension to Webview
 */
export interface ExtensionMessage {
  type: "updateText";
  [key: string]: any; // Allows additional properties of any type
}

/**
 * Message obj will be passed from Webview to VSCode extension
 */
export interface WebviewMessage {
  type: "updateText";
  [key: string]: any;  // Allows additional properties of any type
}