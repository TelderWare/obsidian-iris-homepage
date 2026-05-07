import { App, Component, FuzzySuggestModal, Menu, TFile, View, WorkspaceLeaf, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

const BASES_VIEW_TYPE = "bases";
const BASE_EXTENSION = "base";

class BaseSuggestModal extends FuzzySuggestModal<TFile> {
  private files: TFile[];
  private onChoose: (file: TFile) => void;

  constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
    this.setPlaceholder("Choose a .base file");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}

/**
 * Embeds Obsidian's vanilla Bases view, bound to a specific `.base` file
 * stored in `config.basePath`. Right-click (handled by HomepageView) opens
 * the file picker to rebind to a different base.
 */
export class BaseFileWidget extends BaseWidget {
  private embeddedView: View | null = null;
  private embeddedLeaf: WorkspaceLeaf | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /** Incremented on every mount/destroy so stale async handlers can bail. */
  private generation = 0;
  /** Tracks the path currently mounted so we can skip redundant re-renders. */
  private mountedPath: string | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
    const path = this.config.basePath ?? null;

    // Same path already mounted — nothing to do. Prevents teardown/remount
    // loops if render() is called in quick succession.
    if (this.embeddedView && path === this.mountedPath) {
      if (!this.bodyEl.contains(this.embeddedView.containerEl)) {
        this.bodyEl.appendChild(this.embeddedView.containerEl);
      }
      return;
    }

    this.cleanupView();
    this.bodyEl.empty();

    if (!path) {
      this.renderPicker();
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.renderMissing(path);
      return;
    }

    this.bodyEl.addClass("iris-hp-view-embed-body");
    const loadingEl = this.bodyEl.createDiv({ cls: "iris-hp-view-embed-loading", text: "Loading..." });

    const gen = ++this.generation;
    this.embedView(file, gen).then((ok) => {
      if (gen !== this.generation) return; // superseded
      if (ok) {
        loadingEl.remove();
        this.mountedPath = path;
      } else {
        loadingEl.setText("Failed to load base");
      }
    });
  }

  buildContextMenu(menu: Menu): void {
    menu.addItem((item) =>
      item
        .setTitle(this.config.basePath ? "Change base…" : "Choose base…")
        .setIcon("database")
        .onClick(() => this.openPicker()),
    );
    if (this.config.basePath) {
      menu.addItem((item) =>
        item
          .setTitle("Clear base")
          .setIcon("x")
          .onClick(() => {
            this.config.basePath = undefined;
            this.plugin.saveSettings();
          }),
      );
    }
  }

  destroy(): void {
    this.generation++;
    this.cleanupView();
    super.destroy();
  }

  private renderPicker(): void {
    this.bodyEl.removeClass("iris-hp-view-embed-body");
    const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-embedded-picker" });
    const iconEl = placeholder.createDiv({ cls: "iris-hp-empty-state-icon" });
    setIcon(iconEl, "database");
    placeholder.createDiv({ cls: "iris-hp-empty", text: "No base selected" });

    const chooseBtn = placeholder.createEl("button", {
      cls: "iris-hp-embedded-choose",
      text: "Choose base",
    });
    chooseBtn.addEventListener("click", () => this.openPicker());
  }

  private renderMissing(path: string): void {
    this.bodyEl.removeClass("iris-hp-view-embed-body");
    const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-embedded-picker" });
    placeholder.createDiv({ cls: "iris-hp-empty", text: `Base not found: ${path}` });
    const chooseBtn = placeholder.createEl("button", {
      cls: "iris-hp-embedded-choose",
      text: "Choose base",
    });
    chooseBtn.addEventListener("click", () => this.openPicker());
  }

  private openPicker(): void {
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.extension === BASE_EXTENSION);
    new BaseSuggestModal(this.app, files, (file) => {
      this.config.basePath = file.path;
      this.plugin.saveSettings();
    }).open();
  }

  private async embedView(file: TFile, gen: number): Promise<boolean> {
    const registry = (this.app as any).viewRegistry;
    if (!registry) return false;
    const viewByType: Map<string, unknown> = registry.viewByType instanceof Map
      ? registry.viewByType
      : new Map(Object.entries(registry.viewByType));
    const viewCreator = viewByType.get(BASES_VIEW_TYPE) as
      ((leaf: WorkspaceLeaf) => View) | undefined;
    if (!viewCreator) return false;

    const leaf = new (WorkspaceLeaf as any)(this.app) as WorkspaceLeaf;
    const view: View = viewCreator(leaf);
    (leaf as any).view = view;

    // View extends Component — load() must run before setState/onOpen so
    // registerEvent/registerDomEvent bindings inside those methods attach.
    try { (view as Component).load(); } catch { /* noop */ }
    if (gen !== this.generation) {
      try { (view as Component).unload(); } catch { /* noop */ }
      return false;
    }

    // Skip leaf.setViewState — it fires workspace-wide `layout-change` events
    // that can ripple back into the homepage's render cycle. Drive the view's
    // state directly instead.
    try {
      await (view as any).setState?.({ file: file.path }, { history: false });
    } catch (err) {
      console.error("[iris-homepage] Bases view.setState failed:", err);
      try { (view as Component).unload(); } catch { /* noop */ }
      return false;
    }

    if (gen !== this.generation) {
      try { (view as Component).unload(); } catch { /* noop */ }
      return false;
    }

    this.embeddedView = view;
    this.embeddedLeaf = leaf;

    this.bodyEl.appendChild(view.containerEl);
    view.containerEl.addClass("iris-hp-embedded-leaf");
    view.containerEl.addClass("iris-hp-base-embed");

    this.resizeObserver = new ResizeObserver(() => {
      const v = view as any;
      if (typeof v.onResize === "function") v.onResize();
    });
    this.resizeObserver.observe(this.bodyEl);

    return true;
  }

  private cleanupView(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.embeddedView) {
      try { (this.embeddedView as Component).unload(); } catch { /* noop */ }
      this.embeddedView.containerEl.remove();
      this.embeddedView = null;
      this.embeddedLeaf = null;
    }
    this.mountedPath = null;
  }
}
