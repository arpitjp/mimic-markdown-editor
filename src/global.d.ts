import vditor from "vditor";

// extending window with vditor instance
declare global {
  interface Window {
    vditor: vditor;
    vscode: any;
  }
}

// Message object will to passed b/w VSCode text document & webview
export interface Message {
  type: "update",
  [key: string]: any; // Allows additional properties of any type
}