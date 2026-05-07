import { App, EventRef, Menu, Notice, TFile } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { buildHiddenFilter, getDisplayTitle } from "../utils";

const DEFAULT_LIMIT = 50;

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

    // Right-click anywhere in the widget (except on a list item, which has its
    // own "Hide" menu) opens the filter menu. bodyEl survives re-renders so we
    // attach once here rather than every render().
    this.bodyEl.addEventListener("contextmenu", (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".iris-hp-list-item")) return;
      e.preventDefault();
      e.stopPropagation();
      this.openFilterMenu(e);
    });

    this.render();
  }

  render(): void {
    this.clearBody();

    const files = this.getRecentFiles();
    const filter = this.config.recentNotesFilter;
    const hasFilter = !!(filter?.folderPath || (filter?.limit && filter.limit > 0));

    this.bodyEl.createEl("h6", { cls: "iris-hp-widget-title", text: this.titleText() });

    if (files.length === 0) {
      this.bodyEl.createDiv({
        cls: "iris-hp-empty",
        text: hasFilter ? "No matching notes" : "No recent notes",
      });
      return;
    }

    const listEl = this.bodyEl.createDiv({ cls: "iris-hp-list" });

    for (const file of files) {
      const item = listEl.createDiv({ cls: "iris-hp-list-item" });
      const self = item.createDiv({ cls: "iris-hp-list-item-self is-clickable" });
      const inner = self.createDiv({ cls: "iris-hp-list-item-inner" });
      inner.setText(getDisplayTitle(this.app, file));

      self.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey) this.app.workspace.getLeaf("tab").openFile(file);
        else this.app.workspace.getLeaf(false).openFile(file);
      });

      self.addEventListener("auxclick", (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        this.app.workspace.getLeaf("tab").openFile(file);
      });

      self.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const menu = new Menu();
        menu.addItem((mi) =>
          mi
            .setTitle("Open in new tab")
            .setIcon("file-plus")
            .onClick(() => this.app.workspace.getLeaf("tab").openFile(file)),
        );
        menu.addItem((mi) =>
          mi
            .setTitle("Open to the right")
            .setIcon("separator-vertical")
            .onClick(() => this.app.workspace.getLeaf("split").openFile(file)),
        );
        menu.addItem((mi) =>
          mi
            .setTitle("Open in new window")
            .setIcon("picture-in-picture-2")
            .onClick(() => this.app.workspace.getLeaf("window").openFile(file)),
        );
        menu.addSeparator();
        menu.addItem((mi) =>
          mi
            .setTitle("Hide from recent notes")
            .setIcon("eye-off")
            .onClick(async () => {
              const hidden = this.plugin.settings.hiddenRecentNotes ?? [];
              if (!hidden.includes(file.path)) hidden.push(file.path);
              this.plugin.settings.hiddenRecentNotes = hidden;
              await this.plugin.saveSettings();
            }),
        );
        menu.showAtMouseEvent(e);
      });
    }
  }

  private titleText(): string {
    const folder = this.config.recentNotesFilter?.folderPath;
    return folder ? `Recent in ${folder}` : "Recent notes";
  }

  private openFilterMenu(e: MouseEvent): void {
    const menu = new Menu();
    const filter = this.config.recentNotesFilter ?? {};

    menu.addItem((mi) =>
      mi
        .setTitle(filter.folderPath ? `Folder: ${filter.folderPath}` : "Filter by folder…")
        .setIcon("folder")
        .onClick(() => this.promptFolder()),
    );

    menu.addItem((mi) =>
      mi
        .setTitle(filter.limit ? `Max count: ${filter.limit}` : "Set max count…")
        .setIcon("hash")
        .onClick(() => this.promptLimit()),
    );

    if (filter.folderPath || filter.limit) {
      menu.addSeparator();
      menu.addItem((mi) =>
        mi
          .setTitle("Clear filters")
          .setIcon("x")
          .onClick(async () => {
            delete this.config.recentNotesFilter;
            await this.plugin.saveSettings();
          }),
      );
    }

    menu.showAtMouseEvent(e);
  }

  private async promptFolder(): Promise<void> {
    const current = this.config.recentNotesFilter?.folderPath ?? "";
    const value = await this.plugin.promptText("Filter by folder", "Folder path (blank to clear)", current);
    if (value === null) return;
    const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
    this.config.recentNotesFilter ??= {};
    if (trimmed) this.config.recentNotesFilter.folderPath = trimmed;
    else delete this.config.recentNotesFilter.folderPath;
    this.compactFilter();
    await this.plugin.saveSettings();
  }

  private async promptLimit(): Promise<void> {
    const current = this.config.recentNotesFilter?.limit;
    const value = await this.plugin.promptText(
      "Max count",
      "Max number of notes to show (blank to clear)",
      current ? String(current) : "",
    );
    if (value === null) return;
    const trimmed = value.trim();
    this.config.recentNotesFilter ??= {};
    if (!trimmed) {
      delete this.config.recentNotesFilter.limit;
    } else {
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n <= 0) {
        new Notice("Max count must be a positive number.");
        return;
      }
      this.config.recentNotesFilter.limit = n;
    }
    this.compactFilter();
    await this.plugin.saveSettings();
  }

  /** Drop an empty filter object so settings stay clean. */
  private compactFilter(): void {
    const f = this.config.recentNotesFilter;
    if (f && !f.folderPath && !f.limit) delete this.config.recentNotesFilter;
  }

  private getRecentFiles(): TFile[] {
    const recentPaths: string[] = this.plugin.settings.recentFiles ?? [];
    const hidden = new Set(this.plugin.settings.hiddenRecentNotes ?? []);
    const filter = this.config.recentNotesFilter;
    const folderPrefix = filter?.folderPath ? filter.folderPath.replace(/\/+$/, "") + "/" : null;
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : DEFAULT_LIMIT;

    const files: TFile[] = [];
    for (const path of recentPaths) {
      if (hidden.has(path)) continue;
      if (folderPrefix && !path.startsWith(folderPrefix)) continue;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile && file.extension === "md" && !this.hiddenFilter(file.path)) {
        files.push(file);
        if (files.length >= limit) break;
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
