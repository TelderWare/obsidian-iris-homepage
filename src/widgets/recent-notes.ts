import { App, EventRef, TFile } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { buildHiddenFilter, getDisplayTitle } from "../utils";

export class RecentNotesWidget extends BaseWidget {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventRef: EventRef | null = null;
  private hiddenFilter: (path: string) => boolean;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    this.hiddenFilter = buildHiddenFilter(this.app);

    this.eventRef = this.app.workspace.on("active-leaf-change", () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.render(), 500);
    });

    this.render();
  }

  render(): void {
    this.clearBody();

    const files = this.getRecentFiles();

    if (files.length === 0) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "No recent notes" });
      return;
    }

    this.bodyEl.createEl("h6", { cls: "iris-hp-widget-title", text: "Recent notes" });
    const listEl = this.bodyEl.createDiv({ cls: "iris-hp-list" });

    for (const file of files) {
      const item = listEl.createDiv({ cls: "iris-hp-list-item" });
      const self = item.createDiv({ cls: "iris-hp-list-item-self is-clickable" });
      const inner = self.createDiv({ cls: "iris-hp-list-item-inner" });
      inner.setText(getDisplayTitle(this.app, file));

      self.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }

  private getRecentFiles(): TFile[] {
    const recentPaths: string[] = this.plugin.settings.recentFiles ?? [];
    const files: TFile[] = [];
    for (const path of recentPaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile && file.extension === "md" && !this.hiddenFilter(file.path)) {
        files.push(file);
      }
    }
    return files;
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
    }
    super.destroy();
  }
}
