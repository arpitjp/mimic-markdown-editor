import vditor from "vditor";
import "vditor/dist/index.css";
import "./index.css";
import { ExtensionMessage, WebviewMessage } from "../global";
import { fileToBase64, fixTextOperations, getFormattedDate, handleInternalLinkClick, debug } from "./utils";
import { debounce } from "../utils";

let editor: vditor;
let vscode: any;
let configs: any = {};

const sendMsgToExtension = (msg: WebviewMessage) => {
  vscode.postMessage(msg);
};

const syncTextEdit = () => {
  sendMsgToExtension({ type: "updateText", text: editor.getValue() });
};

/**
 * Prevents vditor from wrapping multi-line text in code block
 */
const fixTextPaste = () => {
  editor.vditor.ir?.element.addEventListener("paste", (e) => {
    const clipboardData = e.clipboardData || (window as any).clipboardData;
    if (!clipboardData?.types?.includes("text")) {
      return;
    }

    // only skip default vditor behavior for text paste
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const text = clipboardData?.getData("text/plain");
    text && editor.insertValue(text);
  }, true);
};

const initVditor = () => {
  if (editor) {
    editor.destroy();
  }

  // Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
  const state = vscode.getState();
 
  configs = ((window as any)?.extensionConfigs);
  
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
      position: configs?.tableOfContents?.position,
    },
    mode: "ir",
    cache: { enable: false },
    toolbarConfig: { pin: true },
    input: debounce(syncTextEdit),
    after() {
      fixTextPaste();
    },
    upload: {
      // Pasting an image without url parameters cannot be uploaded see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
      url: "/dummy",
      async handler(filesList) {
        const files = await Promise.all(
          filesList.map(async (f) => ({
            base64: await fileToBase64(f),
            type: f.type,
            name: `${getFormattedDate()}_${f.name}`.replace(
              /[^\w-_.]+/,
              "_"
            ),
          }))
        );
        sendMsgToExtension({
          type: "upload",
          files,
        });
        return null;
      },
    },
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
      
      case "uploadComplete": {
        message.files.forEach((file: any) => {
          const { path, type, name } = file;

          if (type.startsWith("audio")) {
            editor.insertValue(
              `\n\n<audio controls="controls" src="${path}"></audio>\n\n`
            );
          } else if (type.startsWith("image")) {
            const i = new Image();
            i.src = path;

            i.onload = () => {
              const { width, height } = configs?.imageDefaultConfig || {};
              const w = width ? `width="${width}"` : "";
              const h = height ? `height="${height}"` : "";
              editor.insertMD(
                `\n\n<img src="${path}" ${w} ${h} />\n\n`,
              );
            };
            
            i.onerror = () => {
              editor.insertValue(`\n\n[${name}](${path})\n\n`);
            };
          } else {
            editor.insertValue(`\n\n[${name}](${path})\n\n`);
          }
        });
        break;
      }
		}
	});
};

const setCSSVars = () => {
  document.documentElement.style.setProperty("--vditor-toolbar-display", configs?.showToolbar ? "initial" : "none");
  document.documentElement.style.setProperty("--vditor-outline-width", configs?.tableOfContents?.width || 0);
};

const fixLinkClick = () => {
  const openLink = (href: string) => {
    // todo: internal links only work for now if outline is enabled in vditor
    // todo: internal link to an external file won't work huh..
    if (href.startsWith("#")) {
      configs?.tableOfContents?.show && handleInternalLinkClick(href);
      return;
    }
    sendMsgToExtension({ type: "open-link", href });
  };
  document.addEventListener("click", e => {
    let el = e.target as HTMLAnchorElement;
    if (el.tagName === "A") {
      openLink(el.href);
    }
  });
  (window as any).open = (url: string) => {
    openLink(url);
    return window;
  };
};

// IIAF
(() => {
  fixTextOperations();
  fixLinkClick();

  // Get a reference to the VS Code webview api.
	// @ts-ignore
  vscode = acquireVsCodeApi();
  initVditor();
  setCSSVars();
  setupEventListeners();
})();