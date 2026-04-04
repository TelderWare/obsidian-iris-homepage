import { App, setIcon } from "obsidian";
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

    const removeBtn = this.containerEl.createEl("button", { cls: "iris-hp-widget-remove clickable-icon" });
    setIcon(removeBtn, "trash-2");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRemove();
    });

    const resizeHandle = this.containerEl.createDiv({ cls: "iris-hp-resize-handle" });
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.containerEl.dispatchEvent(
        new CustomEvent("widget-resize-start", { bubbles: true, detail: { widgetId: this.config.id, event: e } })
      );
    });

    return bodyEl;
  }

  private onRemove(): void {
    const idx = this.plugin.settings.widgets.findIndex((w) => w.id === this.config.id);
    if (idx !== -1) {
      this.plugin.settings.widgets.splice(idx, 1);
      this.plugin.saveSettings();
    }
  }

  abstract render(): void;

  destroy(): void {
    this.containerEl.empty();
  }
}
