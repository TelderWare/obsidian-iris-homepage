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
      attr: { type: "text", placeholder: "Search..." },
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
      } else if (e.key === "Escape") {
        input.value = "";
        results.empty();
        input.blur();
      }
    });
  }

  /**
   * Fuzzy-match `query` against `text`. Returns a score (higher = better) or -1 for no match.
   * Rewards consecutive runs and early matches; penalises gaps.
   */
  private fuzzyScore(query: string, text: string): number {
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    // Fast-path: exact substring gets top score
    const substringIdx = t.indexOf(q);
    if (substringIdx !== -1) return 1000 - substringIdx;

    let score = 0;
    let qi = 0;
    let consecutive = 0;

    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        qi++;
        consecutive++;
        score += consecutive * 2;           // reward runs
        if (ti === 0 || /[\s\-_./]/.test(t[ti - 1])) score += 5; // word-boundary bonus
      } else {
        consecutive = 0;
      }
    }

    return qi === q.length ? score : -1;
  }

  private updateResults(query: string, container: HTMLElement): void {
    container.empty();

    if (!query) return;

    const scored: { file: TFile; score: number }[] = [];

    for (const f of this.app.vault.getMarkdownFiles()) {
      if (this.hiddenFilter(f.path)) continue;

      let best = this.fuzzyScore(query, f.basename);

      const aliases: string[] = this.app.metadataCache.getFileCache(f)?.frontmatter?.aliases ?? [];
      for (const alias of aliases) {
        const s = this.fuzzyScore(query, alias);
        if (s > best) best = s;
      }

      if (best > -1) scored.push({ file: f, score: best });
    }

    scored.sort((a, b) => b.score - a.score || a.file.basename.localeCompare(b.file.basename));

    for (const { file } of scored.slice(0, 20)) {
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
