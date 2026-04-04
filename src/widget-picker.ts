import { App, Modal, setIcon } from "obsidian";
import { BUILTIN_WIDGETS, HIDDEN_VIEW_TYPES, CORE_VIEW_TYPES, VIEW_TYPE_ICON_MAP, humanizeViewType } from "./constants";

export interface PickerResult {
  type: string;
  width: number;
  height: number;
}

interface PickerEntry {
  type: string;
  label: string;
  icon: string;
  group: "homepage" | "core" | "plugin";
  width: number;
  height: number;
}

export class WidgetPickerModal extends Modal {
  private resolve: ((result: PickerResult | null) => void) | null = null;
  private entries: PickerEntry[] = [];
  private filteredEntries: PickerEntry[] = [];
  private gridEl: HTMLElement | null = null;

  open(): Promise<PickerResult | null> {
    this.entries = this.buildEntries();
    this.filteredEntries = this.entries;
    super.open();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("iris-hp-picker-modal");
    contentEl.empty();

    contentEl.createEl("h2", { cls: "iris-hp-picker-title", text: "Add Widget" });

    const searchInput = contentEl.createEl("input", {
      cls: "iris-hp-picker-search",
      attr: { type: "text", placeholder: "Search views..." },
    });
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      this.filteredEntries = query
        ? this.entries.filter((e) => e.label.toLowerCase().includes(query) || e.type.toLowerCase().includes(query))
        : this.entries;
      this.renderGrid();
    });

    this.gridEl = contentEl.createDiv({ cls: "iris-hp-picker-grid" });
    this.renderGrid();

    searchInput.focus();
  }

  onClose(): void {
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.empty();

    const groups: { label: string; entries: PickerEntry[] }[] = [
      { label: "Homepage", entries: this.filteredEntries.filter((e) => e.group === "homepage") },
      { label: "Core", entries: this.filteredEntries.filter((e) => e.group === "core") },
      { label: "Plugins", entries: this.filteredEntries.filter((e) => e.group === "plugin") },
    ];

    for (const group of groups) {
      if (group.entries.length === 0) continue;

      this.gridEl.createEl("h3", { cls: "iris-hp-picker-group-label", text: group.label });
      const sectionEl = this.gridEl.createDiv({ cls: "iris-hp-picker-section" });

      for (const entry of group.entries) {
        const card = sectionEl.createDiv({ cls: "iris-hp-picker-card" });
        const iconEl = card.createDiv({ cls: "iris-hp-picker-card-icon" });
        setIcon(iconEl, entry.icon);
        card.createDiv({ cls: "iris-hp-picker-card-label", text: entry.label });

        card.addEventListener("click", () => {
          if (this.resolve) {
            this.resolve({ type: entry.type, width: entry.width, height: entry.height });
            this.resolve = null;
          }
          this.close();
        });
      }
    }

    if (this.filteredEntries.length === 0) {
      this.gridEl.createDiv({ cls: "iris-hp-picker-empty", text: "No matching views" });
    }
  }

  private buildEntries(): PickerEntry[] {
    const entries: PickerEntry[] = [];

    for (const [type, meta] of Object.entries(BUILTIN_WIDGETS)) {
      entries.push({
        type,
        label: meta.label,
        icon: meta.icon,
        group: "homepage",
        width: meta.width,
        height: meta.height,
      });
    }

    const registry = (this.app as any).viewRegistry;
    if (registry && registry.viewByType) {
      const viewByType: Map<string, unknown> = registry.viewByType instanceof Map
        ? registry.viewByType
        : new Map(Object.entries(registry.viewByType));

      for (const viewType of viewByType.keys()) {
        if (HIDDEN_VIEW_TYPES.has(viewType)) continue;
        if (Object.prototype.hasOwnProperty.call(BUILTIN_WIDGETS, viewType)) continue;

        entries.push({
          type: viewType,
          label: humanizeViewType(viewType),
          icon: VIEW_TYPE_ICON_MAP[viewType] || "box",
          group: CORE_VIEW_TYPES.has(viewType) ? "core" : "plugin",
          width: 2,
          height: 3,
        });
      }
    }

    return entries;
  }
}
