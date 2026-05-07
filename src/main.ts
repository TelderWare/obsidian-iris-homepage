import { App, Modal, Plugin, Setting, TFile, WorkspaceLeaf } from "obsidian";
import type { Homepage, HomepageConfig, IrisHomepageSettings } from "./types";
import {
  VIEW_TYPE_HOMEPAGE,
  DEFAULT_SETTINGS,
  defaultHomepageConfig,
  FALLBACK_WORKSPACE_NAME,
  GRID_GAP,
} from "./constants";
import { BUILTIN_WIDGETS } from "./constants";
import { HomepageView } from "./homepage-view";
import { IrisHomepageSettingsTab } from "./settings";
import {
  WidgetRegistry,
  IRIS_HOMEPAGE_WIDGETS_METHOD,
  type IrisWidgetDefinition,
  type IrisHomepageWidgetProvider,
} from "./widget-api";
import {
  getWorkspacesPlugin,
  switchToWorkspace,
  saveActiveWorkspace,
  getActiveWorkspaceName,
} from "./workspace-binder";

export default class IrisHomepagePlugin extends Plugin {
  settings: IrisHomepageSettings = DEFAULT_SETTINGS;
  widgetRegistry: WidgetRegistry = new WidgetRegistry(Object.keys(BUILTIN_WIDGETS));
  private isReplacingTab = false;
  private hideEmptyStyleEl: HTMLStyleElement | null = null;
  private recentSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while we're loading a workspace — suppresses the live-save handler so
   *  the load doesn't immediately re-save (and clobber) the workspace. */
  private suppressWorkspaceSave = false;
  private ribbonTooltipTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last seen active workspace name; used to detect external switches. */
  private lastActiveWorkspace: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_HOMEPAGE, (leaf: WorkspaceLeaf) => new HomepageView(leaf, this));

    this.addCommand({
      id: "open-homepage",
      name: "Open home",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new IrisHomepageSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      // Defer the empty-tab CSS injection until layout has restored. Applying
      // it during onload can hide leaves Obsidian uses while booting and make
      // the splash look stuck on "Loading workspace…".
      this.updateEmptyTabVisibility();
      try { this.scanIrisWidgets(); } catch (err) {
        console.error("[iris-homepage] Initial widget scan failed:", err);
      }
      this.lastActiveWorkspace = getActiveWorkspaceName(this.app);
      if (this.settings.openOnStartup) {
        this.replaceEmptyTabs().catch((err) =>
          console.error("[iris-homepage] replaceEmptyTabs on startup failed:", err),
        );
      }
    });

    // Rescan when plugins are enabled/disabled. Obsidian fires undocumented
    // events on `app.plugins`; if the API shape isn't what we expect, skip
    // silently — layout-change rescans act as a safety net.
    try {
      const pluginsEvents = (this.app as unknown as { plugins?: { on?: Function; off?: Function } }).plugins;
      if (pluginsEvents && typeof pluginsEvents.on === "function" && typeof pluginsEvents.off === "function") {
        const handler = () => this.queueScan();
        pluginsEvents.on.call(pluginsEvents, "change", handler);
        this.register(() => {
          try { pluginsEvents.off?.call(pluginsEvents, "change", handler); } catch {}
        });
      }
    } catch (err) {
      console.warn("[iris-homepage] Could not subscribe to plugin change events:", err);
    }

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.settings.replaceNewTab) {
          this.replaceEmptyTabs().catch((err) =>
            console.error("[iris-homepage] replaceEmptyTabs on layout-change failed:", err),
          );
        }
        this.queueScan();
        this.detectWorkspaceSwitch();
        this.queueWorkspaceLiveSave();
        this.queueRibbonTooltipUpdate();
      })
    );

    this.app.workspace.onLayoutReady(() => this.refreshWorkspaceRibbonTooltip());

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf) return;
        const file = (leaf.view as any)?.file;
        if (file instanceof TFile && file.extension === "md") {
          this.trackRecentFile(file.path);
        }
      })
    );

    // Re-render homepages whenever the set of externally-provided widgets
    // changes, so instances whose provider just loaded swap out of the
    // unavailable state and instances whose provider just unloaded fall back
    // to a placeholder.
    this.register(this.widgetRegistry.onChange(() => this.refreshViews()));
  }

  /**
   * Walk every enabled plugin and collect widget definitions from any that
   * implement `irisHomepageWidgets()`. Cheap and idempotent.
   */
  private scanIrisWidgets(): void {
    const pluginsHost = (this.app as unknown as {
      plugins?: { plugins?: Record<string, IrisHomepageWidgetProvider> };
    }).plugins;
    const plugins = pluginsHost?.plugins;
    if (!plugins) return;

    const collected: IrisWidgetDefinition[] = [];
    for (const [id, plugin] of Object.entries(plugins)) {
      if (id === this.manifest.id) continue;
      const getter = plugin?.[IRIS_HOMEPAGE_WIDGETS_METHOD];
      if (typeof getter !== "function") continue;
      try {
        const defs = getter.call(plugin);
        if (Array.isArray(defs)) collected.push(...defs);
      } catch (err) {
        console.error(`[iris-homepage] ${id}.${IRIS_HOMEPAGE_WIDGETS_METHOD}() threw:`, err);
      }
    }
    this.widgetRegistry.replaceAll(collected);
  }

  private queueScan(): void {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      try { this.scanIrisWidgets(); } catch (err) {
        console.error("[iris-homepage] Widget scan failed:", err);
      }
    }, 200);
  }

  async onunload(): Promise<void> {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer);
      this.workspaceSaveTimer = null;
    }
    if (this.ribbonTooltipTimer) {
      clearTimeout(this.ribbonTooltipTimer);
      this.ribbonTooltipTimer = null;
    }
    if (this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl.remove();
      this.hideEmptyStyleEl = null;
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEPAGE);
  }

  /**
   * Switch to the named workspace. The homepage shown by every open homepage
   * view follows automatically because views always read the active workspace.
   * Called by HomepageView's switcher menu.
   */
  async switchToWorkspace(name: string): Promise<void> {
    const ws = getWorkspacesPlugin(this.app);
    if (!ws) return;
    if (!name || ws.activeWorkspace === name) return;
    this.suppressWorkspaceSave = true;
    try {
      await switchToWorkspace(this.app, name);
    } catch (err) {
      console.error("[iris-homepage] Failed to switch workspace:", err);
    } finally {
      // Release on the next tick so the layout-change cascade from the load
      // doesn't immediately trigger a re-save.
      setTimeout(() => { this.suppressWorkspaceSave = false; }, 500);
    }
    // Ensure config exists for the new workspace so the homepage view can render.
    this.getHomepage(name);
    this.lastActiveWorkspace = getActiveWorkspaceName(this.app);
    this.refreshViews();
    this.refreshWorkspaceRibbonTooltip();
  }

  /** Watch for workspace switches that happen outside our switcher (e.g. via the ribbon). */
  private detectWorkspaceSwitch(): void {
    const current = getActiveWorkspaceName(this.app);
    if (current === this.lastActiveWorkspace) return;
    this.lastActiveWorkspace = current;
    // Make sure the new workspace has a config and views reflect it.
    if (current) this.getHomepage(current);
    this.refreshViews();
  }

  private queueWorkspaceLiveSave(): void {
    if (this.suppressWorkspaceSave) return;
    const active = getActiveWorkspaceName(this.app);
    if (!active) return;
    if (this.workspaceSaveTimer) clearTimeout(this.workspaceSaveTimer);
    this.workspaceSaveTimer = setTimeout(() => {
      this.workspaceSaveTimer = null;
      if (this.suppressWorkspaceSave) return;
      saveActiveWorkspace(this.app).catch((err) =>
        console.error("[iris-homepage] Live workspace save failed:", err),
      );
    }, 1500);
  }

  private queueRibbonTooltipUpdate(): void {
    if (this.ribbonTooltipTimer) clearTimeout(this.ribbonTooltipTimer);
    this.ribbonTooltipTimer = setTimeout(() => {
      this.ribbonTooltipTimer = null;
      this.refreshWorkspaceRibbonTooltip();
    }, 100);
  }

  /**
   * Find the core Workspaces ribbon icon and rewrite its tooltip to include
   * the active workspace name. The button's aria-label drives Obsidian's
   * built-in tooltip, so updating that is enough.
   */
  refreshWorkspaceRibbonTooltip(): void {
    if (!getWorkspacesPlugin(this.app)) return;
    const buttons = document.querySelectorAll<HTMLElement>(".side-dock-ribbon-action");
    let target: HTMLElement | null = null;
    for (const btn of Array.from(buttons)) {
      const label = btn.getAttribute("aria-label") ?? "";
      if (/manage workspace/i.test(label) || /workspace/i.test(label)) {
        target = btn;
        break;
      }
    }
    if (!target) return;
    const active = getActiveWorkspaceName(this.app);
    const tip = active ? `Workspace: ${active}` : "Manage workspace layouts";
    target.setAttribute("aria-label", tip);
    target.setAttribute("data-tooltip", tip);
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    const version: number = data.gridVersion ?? 0;

    // Legacy (pre-v7) data stored grid/widgets at the top level. Run the old
    // grid migrations against the raw object, then wrap into the homepages
    // array in the v7 step below.
    const legacy = data as {
      widgets?: any[];
      columns?: number;
      rows?: number;
      gridGap?: number;
      borderless?: boolean;
      gridVersion?: number;
      rowHeight?: number;
    };

    if (version < 2 && Array.isArray(legacy.widgets)) {
      for (const w of legacy.widgets) { w.height *= 2; w.row *= 2; }
    }
    if (version < 3) {
      if (typeof legacy.columns === "number") legacy.columns *= 2;
      if (Array.isArray(legacy.widgets)) {
        for (const w of legacy.widgets) { w.width *= 2; w.col *= 2; }
      }
    }
    if (version < 4 && Array.isArray(legacy.widgets)) {
      for (const w of legacy.widgets) { if (w.type === "create-task") w.type = "new-task"; }
    }
    if (version < 5) {
      legacy.gridGap ??= GRID_GAP;
    }
    if (version < 6) {
      delete legacy.rowHeight;
    }

    // Migration v7: wrap legacy top-level grid/widgets into a homepages[] entry.
    if (version < 7 && !data.homepages) {
      data.homepages = [{
        id: "default",
        name: "Home",
        columns: typeof legacy.columns === "number" ? legacy.columns : 8,
        rows: typeof legacy.rows === "number" ? legacy.rows : 9,
        gridGap: typeof legacy.gridGap === "number" ? legacy.gridGap : GRID_GAP,
        borderless: legacy.borderless ?? false,
        widgets: Array.isArray(legacy.widgets) ? legacy.widgets : [],
      }];
      data.defaultHomepageId = "default";
      delete legacy.widgets;
      delete legacy.columns;
      delete legacy.rows;
      delete legacy.gridGap;
      delete legacy.borderless;
    }

    // Migration v8: convert homepages[] to a Record<workspaceName, HomepageConfig>.
    // Each entry is keyed by its prior workspaceName (if set) or its display name,
    // dropping the now-redundant id/name fields.
    if (version < 8 && Array.isArray((data as any).homepages)) {
      const oldList = (data as any).homepages as Array<any>;
      const record: Record<string, HomepageConfig> = {};
      for (const hp of oldList) {
        const key = String(hp?.workspaceName ?? hp?.name ?? "").trim() || FALLBACK_WORKSPACE_NAME;
        // First write wins: if two homepages map to the same workspace, the later
        // one is dropped. Acceptable since duplicate names were always ambiguous.
        if (record[key]) continue;
        const seed = defaultHomepageConfig(key);
        record[key] = {
          workspaceName: key,
          icon: hp.icon,
          columns: typeof hp.columns === "number" ? hp.columns : seed.columns,
          rows: typeof hp.rows === "number" ? hp.rows : seed.rows,
          gridGap: typeof hp.gridGap === "number" ? hp.gridGap : seed.gridGap,
          widgets: Array.isArray(hp.widgets) ? hp.widgets : [],
        };
      }
      if (Object.keys(record).length === 0) {
        record[FALLBACK_WORKSPACE_NAME] = defaultHomepageConfig(FALLBACK_WORKSPACE_NAME);
      }
      (data as any).homepages = record;
      delete (data as any).defaultHomepageId;
    }

    const homepagesIsRecord =
      data.homepages && typeof data.homepages === "object" && !Array.isArray(data.homepages);

    // Migration v9: backfill a centered quick switcher into any homepage that
    // ended up with no widgets. Out-of-the-box every workspace should land on
    // a useful default; users who *want* an empty layout just delete it and
    // the stored array stays empty (this migration only runs once).
    if (version < 9 && homepagesIsRecord) {
      const homepages = data.homepages as Record<string, HomepageConfig>;
      for (const [name, hp] of Object.entries(homepages)) {
        if (!Array.isArray(hp.widgets) || hp.widgets.length === 0) {
          hp.widgets = defaultHomepageConfig(name).widgets;
        }
      }
    }

    // Migration v10: the "new-task" and "iris-tasks-view" builtins moved to
    // the iris-tasks plugin and are now exposed via the official widget
    // channel under conventional ids. Rename existing instances so they
    // continue to render after the homepage stops handling them directly.
    if (version < 10 && homepagesIsRecord) {
      const homepages = data.homepages as Record<string, HomepageConfig>;
      for (const hp of Object.values(homepages)) {
        if (!Array.isArray(hp.widgets)) continue;
        for (const w of hp.widgets) {
          if (w.type === "new-task") w.type = "iris-tasks:create";
          else if (w.type === "iris-tasks-view") w.type = "iris-tasks:list";
        }
      }
      delete (data as { taskFolder?: unknown }).taskFolder;
    }

    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      data,
      homepagesIsRecord && Object.keys(data.homepages).length > 0
        ? { homepages: data.homepages }
        : { homepages: cloneDefaultHomepages() },
    );
    this.settings.gridVersion = 10;

    if (version < 10) {
      await this.saveData(this.settings);
    }
  }

  /**
   * Resolve a homepage config by workspace name. If `workspaceName` is omitted,
   * uses the currently active workspace. Lazily creates a default config the
   * first time a workspace is seen so vanilla-created workspaces "just work".
   * Returns the live stored object — mutations persist on next `saveSettings()`.
   */
  getHomepage(workspaceName?: string): Homepage {
    const name = (workspaceName ?? this.getCurrentWorkspaceName()).trim() || FALLBACK_WORKSPACE_NAME;
    // Defensive: if a partial migration or corrupt data left `homepages` unset,
    // any read here would throw and bubble up through the HomepageView
    // constructor into Obsidian's workspace deserialization.
    this.settings.homepages ??= {};
    let config = this.settings.homepages[name];
    if (!config) {
      config = defaultHomepageConfig(name);
      this.settings.homepages[name] = config;
      this.saveData(this.settings).catch((err) =>
        console.error("[iris-homepage] Failed to save lazily-created homepage:", err),
      );
    } else if (config.workspaceName !== name) {
      // Self-heal: stored entry's mirror field drifted from its key.
      config.workspaceName = name;
    }
    return config;
  }

  /** Active workspace name from the core plugin, or the fallback. */
  getCurrentWorkspaceName(): string {
    return getActiveWorkspaceName(this.app) ?? FALLBACK_WORKSPACE_NAME;
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

  /** Open a new homepage tab. The view shows the active workspace's homepage. */
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

  private async replaceEmptyTabs(): Promise<void> {
    if (this.isReplacingTab) return;
    this.isReplacingTab = true;
    try {
      const emptyLeaves = this.app.workspace.getLeavesOfType("empty");
      for (const leaf of emptyLeaves) {
        await leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
      }
    } finally {
      this.isReplacingTab = false;
    }
  }

  promptText(title: string, label: string, initial: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new TextPromptModal(this.app, title, label, initial, resolve);
      modal.open();
    });
  }
}

class TextPromptModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private title: string,
    private label: string,
    private initial: string,
    private resolve: (value: string | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.title);

    let value = this.initial;
    new Setting(this.contentEl)
      .setName(this.label)
      .addText((text) => {
        text.setValue(this.initial).onChange((v) => { value = v; });
        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); this.finish(value.trim()); }
        });
        setTimeout(() => text.inputEl.select(), 0);
      });

    new Setting(this.contentEl)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.finish(null)),
      )
      .addButton((btn) =>
        btn.setButtonText("OK").setCta().onClick(() => this.finish(value.trim())),
      );
  }

  onClose(): void {
    if (!this.resolved) this.resolve(null);
  }

  private finish(value: string | null): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolve(value);
    this.close();
  }
}

function cloneDefaultHomepages(): Record<string, HomepageConfig> {
  const out: Record<string, HomepageConfig> = {};
  for (const [name, cfg] of Object.entries(DEFAULT_SETTINGS.homepages)) {
    out[name] = { ...cfg, widgets: cfg.widgets.map((w) => ({ ...w })) };
  }
  return out;
}
