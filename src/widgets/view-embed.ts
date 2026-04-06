import { App, Component, View, WorkspaceLeaf } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class ViewEmbedWidget extends BaseWidget {
  private embeddedView: View | null = null;
  private embeddedLeaf: WorkspaceLeaf | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
    if (this.embeddedView) {
      const currentType = this.embeddedView.getViewType();
      if (currentType === this.config.type) {
        if (!this.bodyEl.contains(this.embeddedView.containerEl)) {
          this.bodyEl.empty();
          this.bodyEl.addClass("iris-hp-view-embed-body");
          this.bodyEl.appendChild(this.embeddedView.containerEl);
        }
        return;
      }
      this.cleanupView();
    }

    this.bodyEl.empty();
    this.bodyEl.addClass("iris-hp-view-embed-body");

    const loadingEl = this.bodyEl.createDiv({ cls: "iris-hp-view-embed-loading", text: "Loading..." });

    this.embedView().then((success) => {
      if (success) {
        loadingEl.remove();
      } else {
        loadingEl.setText("Failed to load view");
      }
    });
  }

  private async embedView(): Promise<boolean> {
    const registry = (this.app as any).viewRegistry;
    if (!registry) return false;

    const viewByType: Map<string, unknown> = registry.viewByType instanceof Map
      ? registry.viewByType
      : new Map(Object.entries(registry.viewByType));
    const viewCreator = viewByType.get(this.config.type) as
      ((leaf: WorkspaceLeaf) => View) | undefined;

    if (!viewCreator) return false;

    // WorkspaceLeaf constructor takes a single App argument internally.
    const leaf = new (WorkspaceLeaf as any)(this.app) as WorkspaceLeaf;

    const view: View = viewCreator(leaf);
    (leaf as any).view = view;

    this.embeddedView = view;
    this.embeddedLeaf = leaf;

    this.bodyEl.appendChild(view.containerEl);
    view.containerEl.addClass("iris-hp-embedded-leaf");

    if ((view as any).onOpen) {
      await (view as any).onOpen();
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.triggerResize(view);
    });
    this.resizeObserver.observe(this.bodyEl);

    return true;
  }

  private triggerResize(view: View): void {
    const v = view as any;

    if (typeof v.onResize === "function") {
      v.onResize();
    }

    if (v.renderer) {
      if (typeof v.renderer.onResize === "function") {
        v.renderer.onResize();
      }
      if (typeof v.renderer.start === "function" && !v.renderer._running) {
        v.renderer.start();
      }
      if (typeof v.renderer.render === "function") {
        v.renderer.render();
      }
    }
  }

  private cleanupView(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.embeddedView) {
      try {
        // Use unload() to properly detach all events registered via registerEvent().
        // onClose() alone only runs view-specific teardown but does not remove
        // event listeners registered on the Component, causing leaks.
        (this.embeddedView as Component).unload();
      } catch {
        // View may already be cleaned up
      }
      this.embeddedView.containerEl.remove();
      this.embeddedView = null;
      this.embeddedLeaf = null;
    }
  }

  destroy(): void {
    this.cleanupView();
    super.destroy();
  }
}
