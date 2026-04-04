import { App, EventRef, TFile } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class RecentNotesWidget extends BaseWidget {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventRef: EventRef | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    this.eventRef = this.app.vault.on("modify", () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.render(), 1000);
    });

    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    const files = this.getRecentFiles();
    const max = this.config.maxItems ?? 10;
    const displayed = files.slice(0, max);

    if (displayed.length === 0) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "No recent notes" });
      return;
    }

    const listEl = this.bodyEl.createEl("ul", { cls: "iris-hp-recent-list" });

    for (const file of displayed) {
      const li = listEl.createEl("li", { cls: "iris-hp-recent-item" });
      li.createSpan({ cls: "iris-hp-recent-name", text: file.basename });
      li.createSpan({ cls: "iris-hp-recent-folder", text: file.parent ? file.parent.path : "/" });
      li.createSpan({ cls: "iris-hp-recent-time", text: this.relativeTime(file.stat.mtime) });

      li.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }

  private getRecentFiles(): TFile[] {
    if (this.config.sortBy === "opened") {
      const recentPaths: string[] = (this.app.workspace as any).getLastOpenFiles?.() ?? [];
      const files: TFile[] = [];
      for (const path of recentPaths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile && file.extension === "md") {
          files.push(file);
        }
      }
      return files;
    }

    return this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
  }

  private relativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.eventRef) {
      this.app.vault.offref(this.eventRef);
      this.eventRef = null;
    }
    super.destroy();
  }
}
