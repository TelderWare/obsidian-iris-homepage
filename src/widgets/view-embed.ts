import { App, View, WorkspaceLeaf } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class ViewEmbedWidget extends BaseWidget {
  private embeddedView: View | null = null;

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

    const viewCreator = registry.viewByType instanceof Map
      ? registry.viewByType.get(this.config.type)
      : registry.viewByType?.[this.config.type];

    if (!viewCreator) return false;

    // Create a detached leaf that won't appear in the workspace tab bar.
    // WorkspaceLeaf constructor takes a single App argument internally.
    const leaf = new (WorkspaceLeaf as any)(this.app) as WorkspaceLeaf;

    const view: View = viewCreator(leaf);
    (leaf as any).view = view;

    this.embeddedView = view;

    this.bodyEl.appendChild(view.containerEl);
    view.containerEl.addClass("iris-hp-embedded-leaf");

    if (view.onOpen) {
      await view.onOpen();
    }

    return true;
  }

  private cleanupView(): void {
    if (this.embeddedView) {
      try {
        if (this.embeddedView.onClose) {
          this.embeddedView.onClose();
        }
      } catch {
        // View may already be cleaned up
      }
      this.embeddedView.containerEl.remove();
      this.embeddedView = null;
    }
  }

  destroy(): void {
    this.cleanupView();
    super.destroy();
  }
}
