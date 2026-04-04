import { App, TFile, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class NewNoteWidget extends BaseWidget {
  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    const btn = this.bodyEl.createDiv({ cls: "iris-hp-new-note" });

    const icon = btn.createDiv({ cls: "iris-hp-new-note-icon" });
    setIcon(icon, "plus");

    btn.createDiv({ cls: "iris-hp-new-note-label", text: "New note" });

    btn.addEventListener("click", () => this.createNote());
  }

  private async createNote(): Promise<void> {
    const name = this.nextUntitledName();
    const file = await this.app.vault.create(name, "");
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  private nextUntitledName(): string {
    const existing = new Set(
      this.app.vault.getFiles()
        .filter((f): f is TFile => f instanceof TFile)
        .map((f) => f.path)
    );

    if (!existing.has("Untitled.md")) return "Untitled.md";

    let i = 1;
    while (existing.has(`Untitled ${i}.md`)) i++;
    return `Untitled ${i}.md`;
  }
}
