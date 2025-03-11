import vditor from "vditor";
import "vditor/dist/index.css";
import "./index.css";
import { Message } from "../global";

const initVditor = () => {
  window.vditor = new vditor("webview-vditor", {
    width: "100%",
    height: "100%",
    lang: "en_US",
    value: "",
    mode: "ir",
    // value: "",
    // cache: { enable: false },
    toolbarConfig: { pin: true },
    // after() { },
    // input() { },
    // upload: {},
  });
};

const updateContentInVditor = (text: string) => {
  window.vditor.setValue(text);
  // Then persist state information.
  // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
  window.vscode.setState({ text });
};

const setupEventListeners = () => {
  window.addEventListener("message", ({ data: message }: { data: Message }) => {
		switch (message.type) {
			case "update":
				updateContentInVditor(message.text);
				return;
		}
	});
};

// IIAF
(() => {
  // Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.
	// @ts-ignore
  window.vscode = acquireVsCodeApi();

  initVditor();
  setupEventListeners();

  // Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = window.vscode.getState();
	if (state) {
		updateContentInVditor(state.text);
	}
})();