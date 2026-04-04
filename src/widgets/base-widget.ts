import { App } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";

export abstract class BaseWidget {
  protected app: App;
  protected containerEl: HTMLElement;
  protected config: WidgetConfig;
  protected plugin: IrisHomepagePlugin;
  protected bodyEl: HTMLElement;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    this.app = app;
    this.containerEl = containerEl;
    this.config = config;
    this.plugin = plugin;
    this.bodyEl = this.buildCard();
  }

  private buildCard(): HTMLElement {
    this.containerEl.empty();
    this.containerEl.addClass("iris-hp-widget");

    const bodyEl = this.containerEl.createDiv({ cls: "iris-hp-widget-body" });

    for (const edge of ["tl", "tr", "bl", "br", "t", "r", "b", "l"] as const) {
      const handle = this.containerEl.createDiv({ cls: `iris-hp-resize-handle iris-hp-resize-${edge}` });
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.containerEl.dispatchEvent(
          new CustomEvent("widget-resize-start", { bubbles: true, detail: { widgetId: this.config.id, corner: edge, event: e } })
        );
      });
    }

    return bodyEl;
  }

  abstract render(): void;

  destroy(): void {
    this.containerEl.empty();
  }
}
