/**
 * This fixes "cut" text operation not working on vscode webview.
 * 
 * Error: We don"t execute document.execCommand() this time, because it is called recursively.
 * Check issue: https://github.com/nwjs/nw.js/issues/3403
 */
export function fixTextCut() {
  let _exec = document.execCommand.bind(document);
  // @ts-ignore
  document.execCommand = (cmd, ...args) => {
    if (cmd === "delete") {
      setTimeout(() => _exec(cmd, ...args));
    } else {
      return _exec(cmd, ...args);
    }
  };
}
