import { App, EventRef, TFile } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { buildHiddenFilter, getDisplayTitle } from "../utils";

export class RecentNotesWidget extends BaseWidget {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventRef: EventRef | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastHeight = 0;
  private hiddenFilter: (path: string) => boolean;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    this.hiddenFilter = buildHiddenFilter(this.app);

    this.eventRef = this.app.vault.on("modify", () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.render(), 1000);
    });

    this.resizeObserver = new ResizeObserver(() => {
      const h = this.bodyEl.clientHeight;
      if (Math.abs(h - this.lastHeight) < 4) return;
      this.lastHeight = h;
      this.render();
    });
    this.resizeObserver.observe(this.bodyEl);

    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    const files = this.getRecentFiles();

    // Estimate how many items fit: each item is roughly 1 line-height + 12px padding
    const itemHeight = 32; // ~20px text + 12px padding
    const available = this.bodyEl.clientHeight || 200;
    const max = Math.max(1, Math.floor(available / itemHeight));
    const displayed = files.slice(0, max);

    if (displayed.length === 0) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "No recent notes" });
      return;
    }

    const listEl = this.bodyEl.createEl("ul", { cls: "iris-hp-recent-list" });

    for (const file of displayed) {
      const li = listEl.createEl("li", { cls: "iris-hp-recent-item" });
      li.createSpan({ cls: "iris-hp-recent-name", text: getDisplayTitle(this.app, file) });

      li.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }

  private getRecentFiles(): TFile[] {
    const recentPaths: string[] = (this.app.workspace as any).getLastOpenFiles?.() ?? [];
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.eventRef) {
      this.app.vault.offref(this.eventRef);
      this.eventRef = null;
    }
    super.destroy();
  }
}
