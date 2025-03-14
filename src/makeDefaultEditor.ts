import * as vscode from "vscode";
import { VIEW_TYPE } from "./constants";

export const makeDefaultEditor = () => {
  // get the current default editor
  const config = vscode.workspace.getConfiguration("workbench");
  const associations = config.get<{ [key: string]: string }>("editorAssociations", {});
  const markdownExtension = "*.md";

  // editor already set as default
  if (associations[markdownExtension] === VIEW_TYPE) {
    return;
  }

  // make it default
  config
    .update(
      "editorAssociations",
      { ...associations, [markdownExtension]: VIEW_TYPE },
      vscode.ConfigurationTarget.Global
    )
    .then(
      () => {
        vscode.window.setStatusBarMessage("🚀 Mimic has been set as the default markdown editor.", 5000);
      },
      error => {
        vscode.window.showErrorMessage(`Failed to make Mimic as the default markdown editor: ${error}`);
      }
    );
};
