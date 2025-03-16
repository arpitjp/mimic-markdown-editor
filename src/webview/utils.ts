export const fileToBase64 = async (file: Blob) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = function (evt) {
    res(evt?.target?.result?.toString().split(",")[1]);
  };
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

export const getFormattedDate = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0"); // Month is 0-based
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
};

/**
 * This fixes "cut" text operation not working on vscode webview.
 * 
 * Error: We don"t execute document.execCommand() this time, because it is called recursively.
 * Check issue: https://github.com/nwjs/nw.js/issues/3403
 */
export const fixTextOperations = () => {
  let _exec = document.execCommand.bind(document);
  // @ts-ignore
  document.execCommand = (cmd, ...args) => {
    setTimeout(() => _exec(cmd, ...args)); // somehow other operations are acting weird too
    // if (cmd === "delete" || cmd === "paste" || cmd === "insertHTML") {
    //   setTimeout(() => _exec(cmd, ...args));
    // } else {
    //   return _exec(cmd, ...args);
    // }
  };
};

const convertToMarkdownLink = (text: string) => {
  if (!text) {
    return "";
  }
  // Convert text to lowercase, replace spaces with hyphens, and remove special characters
  return "#" + text.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
};

export const handleInternalLinkClick = (href: string) => {
  const spans = document.querySelectorAll(".vditor-outline__content span[data-target-id]");
  const theChosenOne = Array.from(spans).find(s => convertToMarkdownLink(s.textContent || "") === href);
  (theChosenOne as HTMLElement)?.click();
};