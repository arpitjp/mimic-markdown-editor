import {
  CodeBlockLanguageSelector,
  EmojiSelector,
  ImageEditTool,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  Muya,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu,
  en,
} from "@muyajs/core";
import "@muyajs/core/lib/style.css";
import "./index.css";
import { ExtensionMessage, WebviewMessage } from "../global";
import { fileToBase64, fixTextOperations, getFormattedDate, handleInternalLinkClick, debug, fixImageBaseHref } from "./utils";
import { debounce } from "../utils";

// let editor: vditor;
let muya: Muya;
let vscode: any;
let configs: any = {};

const sendMsgToExtension = (msg: WebviewMessage) => {
  vscode.postMessage(msg);
};

const syncTextEdit = () => {
  sendMsgToExtension({ type: "updateText", text: muya.getMarkdown() });
};

/**
 * Prevents vditor from wrapping multi-line text in code block
 */
// const fixTextPaste = () => {
//   editor.vditor.ir?.element.addEventListener("paste", (e) => {
//     const clipboardData = e.clipboardData || (window as any).clipboardData;
//     if (!clipboardData?.types?.includes("text")) {
//       return;
//     }

//     // only skip default vditor behavior for text paste
//     e.preventDefault();
//     e.stopPropagation();
//     e.stopImmediatePropagation();
//     const text = clipboardData?.getData("text/plain");
//     text && editor.insertValue(text);
//   }, true);
// };

const initMuya = () => {
  // Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
  const state = vscode.getState();
   
  const isDarkTheme = document.body.classList.contains("vscode-dark");
  // const theme = isDarkTheme ? "dark" : "classic";
  debug("isDarktheme", isDarkTheme);

  if (muya) {
    muya.destroy();
  }

  Muya.use(CodeBlockLanguageSelector);
  Muya.use(EmojiSelector);
  Muya.use(ImageEditTool);
  Muya.use(ImageResizeBar);
  Muya.use(ImageToolBar);
  Muya.use(InlineFormatToolbar);
  Muya.use(ParagraphFrontButton);
  Muya.use(ParagraphFrontMenu);
  Muya.use(ParagraphQuickInsertMenu);
  Muya.use(PreviewToolBar);
  Muya.use(TableColumnToolbar);
  Muya.use(ParagraphQuickInsertMenu);
  Muya.use(TableDragBar);
  Muya.use(TableRowColumMenu);
  Muya.use(PreviewToolBar);

  const container = document.querySelector("#editor") as HTMLElement;
  muya = new Muya(container, {
      markdown: state?.text || "# Hello World",
  });
  muya.locale(en);
  muya.init();

  // fix image src
  muya.editor.inlineRenderer.renderer.urlMap.get = function (key) {
    const baseUri = (window as any).vscodeBaseHref;
    const val = Map.prototype.get.call(this, key);
    return baseUri + val;
  };

  // sync text in muya with actual file in extension
  muya.on("json-change", debounce(syncTextEdit));
};

// const initVditor = () => {
//   if (editor) {
//     editor.destroy();
//   }

//   // Webviews are normally torn down when not visible and re-created when they become visible again.
// 	// State lets us save information across these re-loads
//   const state = vscode.getState();
 
//   configs = ((window as any)?.extensionConfigs);
  
//   const isDarkTheme = document.body.classList.contains("vscode-dark");
//   const theme = isDarkTheme ? "dark" : "classic";
//   debug("isDarktheme", isDarkTheme);

//   editor = new vditor("editor", {
//     width: "100%",
//     height: "100%",
//     lang: "en_US",
//     theme,
//     preview: {
//       actions: [],
//       hljs: {
//         style: `github${isDarkTheme ? "-dark" : ""}`,
//       },
//       mode: "both",
//       theme: {
//         current: theme,
//       },
//     },
//     value: state?.text || "",
//     outline: {
//       enable: true,
//       position: configs?.tableOfContents?.position,
//     },
//     mode: "ir",
//     cache: { enable: false },
//     toolbarConfig: { pin: true },
//     input: debounce(syncTextEdit),
//     after() {
//       fixTextPaste();
//     },
//     upload: {
//       // Pasting an image without url parameters cannot be uploaded see: https://github.com/Vanessa219/vditor/blob/d7628a0a7cfe5d28b055469bf06fb0ba5cfaa1b2/src/ts/util/fixBrowserBehavior.ts#L1409
//       url: "/dummy",
//       async handler(filesList) {
//         const files = await Promise.all(
//           filesList.map(async (f) => ({
//             base64: await fileToBase64(f),
//             name: `${getFormattedDate()}_${f.name}`.replace(
//               /[^\w-_.]+/,
//               "_"
//             ),
//           }))
//         );
//         sendMsgToExtension({
//           type: "upload",
//           files,
//         });
//         return null;
//       },
//     },
//   });
// };

const updateTextInExtension = (text: string) => {
  // Persist state information.
  // This state is returned in the call to `vscode.getState` below when a webview is reloaded.
  vscode.setState({ text });
  muya.setContent(text);
};

const pasteInMuya = (text: string) => {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const newEvent = new ClipboardEvent("paste", {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
  });
  muya.editor.clipboard.pasteHandler(newEvent);
};

const setupMessageListeners = () => {
  window.addEventListener("message", ({ data: message }: { data: ExtensionMessage }) => {
		switch (message.type) {
			case "updateText":
				updateTextInExtension(message.text);
        return;
      
      case "uploadComplete": {
        message.files.forEach((file: any) => {
          const { path, type } = file;
          if (type.startsWith("image")) {
            const i = new Image();
            i.src = path;
            i.onload = () => {
              const { width, height } = configs?.imageDefaultConfig || {};
              const w = width ? `width="${width}"` : "";
              const h = height ? `height="${height}"` : "";
              pasteInMuya(`\n\n<img src="${path}" alt="${path.split("/").slice(-1)[0]}" ${w} ${h} />\n\n`);
            };
            i.onerror = () => {
              pasteInMuya(`\n\n[${path.split("/").slice(-1)[0]}](${path})\n\n`);
            };
          } else if (type.startsWith("audio")) {
            pasteInMuya(`\n\n<audio controls="controls" src="${path}"></audio>\n\n`);
          } else {
            pasteInMuya(`\n\n[${path.split("/").slice(-1)[0]}](${path})\n\n`);
          }
        });
        return;
      }
		}
	});
};

// const setCSSVars = () => {
//   document.documentElement.style.setProperty("--vditor-toolbar-display", configs?.showToolbar ? "initial" : "none");
//   document.documentElement.style.setProperty("--vditor-outline-width", configs?.tableOfContents?.width || 0);
// };

// const fixLinkClick = () => {
//   const openLink = (href: string) => {
//     // todo: internal links only work for now if outline is enabled in vditor
//     // todo: internal link to an external file won"t work huh..
//     if (href.startsWith("#")) {
//       configs?.tableOfContents?.show && handleInternalLinkClick(href);
//       return;
//     }
//     sendMsgToExtension({ type: "open-link", href });
//   };
//   document.addEventListener("click", e => {
//     let el = e.target as HTMLAnchorElement;
//     if (el.tagName === "A") {
//       openLink(el.href);
//     }
//   });
//   (window as any).open = (url: string) => {
//     openLink(url);
//     return window;
//   };
// };

const handleFilePaste = () => {
  document.querySelector("#editor")?.addEventListener("paste", async (_e: Event) => {
    const e = _e as ClipboardEvent;

    const filesList = Array.from(e.clipboardData?.files || []);
    if (!filesList.length) {
      return;
    }

    // stop default paste behavior of muya
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    // send file data to extension for upload
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
  
    // Create a new DataTransfer with the custom text
    // const data = new DataTransfer();
    // data.setData("text/plain", "Hello World");

    // // Pass a new ClipboardEvent to the pasteHandler
    // const newEvent = new ClipboardEvent("paste", {
    //   clipboardData: data,
    //   bubbles: true,
    //   cancelable: true,
    // });

    // muya.editor.clipboard.pasteHandler(newEvent);
  }, true);
};

// IIAF -- order of function calls matter
(() => {
  // fixTextOperations();
  // fixLinkClick();
  fixImageBaseHref();

  // Get a reference to the VS Code webview api.
	// @ts-ignore
  vscode = acquireVsCodeApi();
  configs = ((window as any)?.extensionConfigs);


  initMuya();

  handleFilePaste();

  setupMessageListeners();
})();
