import { App, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

const WEBVIEWER_VIEW_TYPE = "webviewer";

function resolveWebviewerType(app: App): string | null {
  const registry = (app as any).viewRegistry;
  if (!registry?.viewByType) return null;
  const viewByType: Map<string, unknown> = registry.viewByType instanceof Map
    ? registry.viewByType
    : new Map(Object.entries(registry.viewByType));
  return viewByType.has(WEBVIEWER_VIEW_TYPE) ? WEBVIEWER_VIEW_TYPE : null;
}

function looksLikeUrl(s: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return true;
  if (/\s/.test(s)) return false;
  return /^[^\s]+\.[^\s]+$/.test(s);
}

function buildSearchUrl(query: string, app: App): string {
  const encoded = encodeURIComponent(query);
  // Try to honour Obsidian Web viewer's configured search engine.
  const engine = (app as any).internalPlugins?.plugins?.webviewer?.instance?.options?.defaultSearchEngine;
  if (typeof engine === "string" && engine.includes("%s")) {
    return engine.replace("%s", encoded);
  }
  return `https://duckduckgo.com/?q=${encoded}`;
}

function normalizeUrl(input: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  return `https://${input}`;
}

export class WebSearchWidget extends BaseWidget {
  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
    this.bodyEl.empty();
    this.bodyEl.addClass("iris-hp-switcher-body");

    const viewType = resolveWebviewerType(this.app);

    if (!viewType) {
      const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-command iris-hp-command-unavailable" });
      const icon = placeholder.createDiv({ cls: "iris-hp-command-icon" });
      setIcon(icon, "globe");
      placeholder.createDiv({ cls: "iris-hp-command-label", text: "Web viewer disabled" });
      return;
    }

    const inputRow = this.bodyEl.createDiv({ cls: "iris-hp-switcher-input-row" });

    const iconEl = inputRow.createDiv({ cls: "iris-hp-switcher-icon" });
    setIcon(iconEl, "globe");

    const input = inputRow.createEl("input", {
      cls: "iris-hp-switcher-input",
      attr: { type: "text", placeholder: "Search the web…" },
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const value = input.value.trim();
        if (!value) return;
        const url = looksLikeUrl(value) ? normalizeUrl(value) : buildSearchUrl(value, this.app);
        this.openInWebviewer(url, viewType);
        input.value = "";
      } else if (e.key === "Escape") {
        input.value = "";
        input.blur();
      }
    });
  }

  private openInWebviewer(url: string, viewType: string): void {
    const leaf = this.app.workspace.getLeaf(true);
    leaf.setViewState({ type: viewType, state: { url }, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
