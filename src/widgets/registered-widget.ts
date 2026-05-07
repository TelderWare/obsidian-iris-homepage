import { App, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import type {
  IrisWidgetDefinition,
  IrisWidgetInstance,
  IrisWidgetInstanceConfig,
} from "../widget-api";

/**
 * Adapts an externally-registered `IrisWidgetDefinition` to the `BaseWidget`
 * contract the homepage view renders against. Also renders the "unavailable"
 * placeholder when no definition is currently registered for `config.type`
 * (i.e. the providing plugin hasn't loaded yet or was disabled).
 */
export class RegisteredWidget extends BaseWidget {
  private instance: IrisWidgetInstance | null = null;
  private definition: IrisWidgetDefinition | null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    app: App,
    containerEl: HTMLElement,
    config: WidgetConfig,
    plugin: IrisHomepagePlugin,
    definition: IrisWidgetDefinition | null,
  ) {
    super(app, containerEl, config, plugin);
    this.definition = definition;
    this.render();
  }

  render(): void {
    this.teardownInstance();
    this.bodyEl.empty();

    if (!this.definition) {
      this.renderUnavailable();
      return;
    }

    const snapshot = this.snapshotConfig();
    try {
      this.instance = this.definition.create({
        app: this.app,
        containerEl: this.bodyEl,
        config: snapshot,
        saveData: (data) => this.saveData(data),
      });
    } catch (err) {
      console.error(
        `[iris-homepage] Registered widget "${this.config.type}" threw in create():`,
        err,
      );
      this.bodyEl.empty();
      this.renderErrored();
      return;
    }

    if (this.instance.onResize) {
      this.resizeObserver = new ResizeObserver(() => this.instance?.onResize?.());
      this.resizeObserver.observe(this.bodyEl);
    }
  }

  destroy(): void {
    this.teardownInstance();
    super.destroy();
  }

  private teardownInstance(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.instance) {
      try {
        this.instance.destroy();
      } catch (err) {
        console.error(
          `[iris-homepage] Registered widget "${this.config.type}" threw in destroy():`,
          err,
        );
      }
      this.instance = null;
    }
  }

  private snapshotConfig(): IrisWidgetInstanceConfig {
    return Object.freeze({
      id: this.config.id,
      type: this.config.type,
      col: this.config.col,
      row: this.config.row,
      width: this.config.width,
      height: this.config.height,
      data: this.config.data ? Object.freeze({ ...this.config.data }) : undefined,
    });
  }

  private async saveData(data: Record<string, unknown>): Promise<void> {
    this.config.data = { ...(this.config.data ?? {}), ...data };
    await this.plugin.saveSettings();
    this.instance?.onConfigChange?.(this.snapshotConfig());
  }

  private renderUnavailable(): void {
    this.bodyEl.addClass("iris-hp-widget-unavailable");
    const icon = this.bodyEl.createDiv({ cls: "iris-hp-widget-unavailable-icon" });
    setIcon(icon, "plug");
    this.bodyEl.createEl("span", { text: `Widget "${this.config.type}" unavailable` });
    this.bodyEl.createEl("small", { text: "The providing plugin is not loaded." });
  }

  private renderErrored(): void {
    this.bodyEl.addClass("iris-hp-widget-error");
    const icon = this.bodyEl.createDiv({ cls: "iris-hp-widget-error-icon" });
    setIcon(icon, "alert-triangle");
    this.bodyEl.createEl("span", { text: "Widget failed to load" });
  }
}
