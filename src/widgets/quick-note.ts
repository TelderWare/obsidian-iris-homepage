import { App, Notice, TFile } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class QuickNoteWidget extends BaseWidget {
  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.init();
  }

  render(): void {
    this.bodyEl.empty();

    const form = this.bodyEl.createDiv({ cls: "iris-hp-quick-form" });

    const input = form.createEl("input", {
      cls: "iris-hp-quick-input",
      attr: { type: "text", placeholder: "New note title..." },
    });

    const btn = form.createEl("button", { cls: "iris-hp-quick-btn", text: "Create" });

    const submit = async () => {
      const title = input.value.trim();
      if (!title) return;

      const folder = this.config.templateFolder || "";
      const path = folder ? `${folder}/${title}.md` : `${title}.md`;

      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing) {
        new Notice("Note already exists — opening it.");
        if (!(existing instanceof TFile)) return;
        await this.app.workspace.getLeaf(false).openFile(existing);
        return;
      }

      try {
        if (folder) {
          const folderExists = this.app.vault.getAbstractFileByPath(folder);
          if (!folderExists) {
            await this.app.vault.createFolder(folder);
          }
        }
        const file = await this.app.vault.create(path, "");
        await this.app.workspace.getLeaf(false).openFile(file);
        input.value = "";
      } catch (err) {
        new Notice(`Failed to create note: ${err}`);
      }
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });
  }
}
