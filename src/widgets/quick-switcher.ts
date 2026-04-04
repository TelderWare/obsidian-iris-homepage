import { App, TFile, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { buildHiddenFilter, getDisplayTitle } from "../utils";

export class QuickSwitcherWidget extends BaseWidget {
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenFilter: (path: string) => boolean;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.hiddenFilter = buildHiddenFilter(this.app);
    this.render();
  }

  render(): void {
    this.bodyEl.empty();
    this.bodyEl.addClass("iris-hp-switcher-body");

    const inputRow = this.bodyEl.createDiv({ cls: "iris-hp-switcher-input-row" });

    const iconEl = inputRow.createDiv({ cls: "iris-hp-switcher-icon" });
    setIcon(iconEl, "search");

    const input = inputRow.createEl("input", {
      cls: "iris-hp-switcher-input",
      attr: { type: "text", placeholder: "Jump to note..." },
    });

    const results = this.bodyEl.createDiv({ cls: "iris-hp-switcher-results" });

    input.addEventListener("input", () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.updateResults(input.value.trim(), results);
      }, 120);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = results.querySelector(".iris-hp-switcher-item") as HTMLElement | null;
        first?.click();
      }
    });
  }

  private updateResults(query: string, container: HTMLElement): void {
    container.empty();

    if (!query) return;

    const lower = query.toLowerCase();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((f) => !this.hiddenFilter(f.path) && f.basename.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aStarts = a.basename.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.basename.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStarts - bStarts || a.basename.localeCompare(b.basename);
      })
      .slice(0, 20);

    for (const file of files) {
      const item = container.createDiv({ cls: "iris-hp-switcher-item" });
      item.createSpan({ text: getDisplayTitle(this.app, file) });

      item.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }

  destroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    super.destroy();
  }
}
