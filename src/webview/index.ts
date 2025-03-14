import vditor from "vditor";
import "vditor/dist/index.css";
import "./index.css";
import { ExtensionMessage, WebviewMessage } from "../global";
import { fixTextCut } from "./utils";
import { debounce, debug } from "../utils";

let editor: vditor;
let vscode: any;

const sendMsgToExtension = (msg: WebviewMessage) => {
  vscode.postMessage(msg);
};

const syncTextEdit = () => {
  sendMsgToExtension({ type: "updateText", text: editor.getValue() });
};

const initVditor = () => {
  if (editor) {
    editor.destroy();
  }

  // Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
  const state = vscode.getState();
  
  const isDarkTheme = document.body.classList.contains("vscode-dark");
  const theme = isDarkTheme ? "dark" : "classic";
  debug("isDarktheme", isDarkTheme);

  editor = new vditor("webview-vditor", {
    width: "100%",
    height: "100%",
    lang: "en_US",
    theme,
    preview: {
      actions: [],
      hljs: {
        style: `github${isDarkTheme ? "-dark" : ""}`,
      },
      mode: "both",
      theme: {
        current: theme,
      },
    },
    value: state?.text || "",
    outline: {
      enable: true,
      position: "right",
    },
    mode: "ir",
    cache: { enable: false },
    toolbarConfig: { pin: true },
    input: debounce(syncTextEdit),
  });
};

const updateContentInVditor = (text: string) => {
  // Persist state information.
  // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
  vscode.setState({ text });
  editor.setValue(text);
};

const setupEventListeners = () => {
  window.addEventListener("message", ({ data: message }: { data: ExtensionMessage }) => {
		switch (message.type) {
			case "updateText":
				updateContentInVditor(message.text);
				return;
		}
	});
};

// IIAF
(() => {
  fixTextCut();

  // Get a reference to the VS Code webview api.
	// @ts-ignore
  vscode = acquireVsCodeApi();

  initVditor();

  setupEventListeners();
})();