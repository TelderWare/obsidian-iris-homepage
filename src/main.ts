import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import type { IrisHomepageSettings } from "./types";
import { VIEW_TYPE_HOMEPAGE, DEFAULT_SETTINGS } from "./constants";
import { HomepageView } from "./homepage-view";
import { IrisHomepageSettingsTab } from "./settings";

export default class IrisHomepagePlugin extends Plugin {
  settings: IrisHomepageSettings = DEFAULT_SETTINGS;
  private isReplacingTab = false;
  private hideEmptyStyleEl: HTMLStyleElement | null = null;
  private recentSaveTimer: ReturnType<typeof setTimeout> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_HOMEPAGE, (leaf: WorkspaceLeaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: "open-homepage",
      name: "Open home",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new IrisHomepageSettingsTab(this.app, this));

    this.updateEmptyTabVisibility();

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) {
        this.replaceEmptyTabs();
      }
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.settings.replaceNewTab) {
          this.replaceEmptyTabs();
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf) return;
        const file = (leaf.view as any)?.file;
        if (file instanceof TFile && file.extension === "md") {
          this.trackRecentFile(file.path);
        }
      })
    );
  }

  async onunload(): Promise<void> {
    if (this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl.remove();
      this.hideEmptyStyleEl = null;
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEPAGE);
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // Migration: v2 halved ROW_HEIGHT, double heights/rows.
    if (!this.settings.gridVersion || this.settings.gridVersion < 2) {
      for (const w of this.settings.widgets) {
        w.height *= 2;
        w.row *= 2;
      }
      this.settings.gridVersion = 2;
    }

    // Migration: v3 doubled grid resolution horizontally, double columns/widths/cols.
    if (this.settings.gridVersion < 3) {
      this.settings.columns *= 2;
      for (const w of this.settings.widgets) {
        w.width *= 2;
        w.col *= 2;
      }
      this.settings.gridVersion = 3;
    }

    // Migration: v4 renamed create-task → new-task.
    if (this.settings.gridVersion < 4) {
      for (const w of this.settings.widgets) {
        if (w.type === "create-task") w.type = "new-task";
      }
      this.settings.gridVersion = 4;
    }

    // Migration: v5 added configurable gridGap. (rowHeight was removed in v6
    // since rows now stretch to fill the view.)
    if (this.settings.gridVersion < 5) {
      this.settings.gridGap ??= 12;
      this.settings.gridVersion = 5;
    }

    // Migration: v6 removed the rowHeight setting — rows are fractional now.
    if (this.settings.gridVersion < 6) {
      delete (this.settings as unknown as { rowHeight?: number }).rowHeight;
      this.settings.gridVersion = 6;
    }

    if (!data?.gridVersion || data.gridVersion < 6) {
      await this.saveData(this.settings);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.updateEmptyTabVisibility();
    this.refreshViews();
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HOMEPAGE)) {
      const view = leaf.view as HomepageView;
      view.render();
    }
  }

  async activateView(): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private updateEmptyTabVisibility(): void {
    if (this.settings.replaceNewTab && !this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl = document.createElement("style");
      this.hideEmptyStyleEl.textContent = `.workspace-leaf-content[data-type="empty"] { display: none !important; }`;
      document.head.appendChild(this.hideEmptyStyleEl);
    } else if (!this.settings.replaceNewTab && this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl.remove();
      this.hideEmptyStyleEl = null;
    }
  }

  private trackRecentFile(path: string): void {
    const list = this.settings.recentFiles ??= [];
    const idx = list.indexOf(path);
    if (idx === 0) return;
    if (idx > 0) list.splice(idx, 1);
    list.unshift(path);
    if (list.length > 50) list.length = 50;

    // Debounce persistence so rapid tab switches don't spam disk
    if (this.recentSaveTimer) clearTimeout(this.recentSaveTimer);
    this.recentSaveTimer = setTimeout(() => this.saveData(this.settings), 2000);
  }

  private replaceEmptyTabs(): void {
    if (this.isReplacingTab) return;
    this.isReplacingTab = true;

    try {
      const emptyLeaves = this.app.workspace.getLeavesOfType("empty");
      if (emptyLeaves.length === 0) return;

      for (const leaf of emptyLeaves) {
        leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
      }
    } finally {
      this.isReplacingTab = false;
    }
  }
}
