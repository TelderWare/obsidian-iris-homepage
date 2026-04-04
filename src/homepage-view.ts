import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type IrisHomepagePlugin from "./main";
import type { WidgetConfig } from "./types";
import { isBuiltinWidget } from "./types";
import { VIEW_TYPE_HOMEPAGE, ROW_HEIGHT, GRID_GAP } from "./constants";
import { GridEngine } from "./grid-engine";
import { BaseWidget } from "./widgets/base-widget";
import { RecentNotesWidget } from "./widgets/recent-notes";
import { EmbeddedNoteWidget } from "./widgets/embedded-note";
import { ViewEmbedWidget } from "./widgets/view-embed";
import { WidgetPickerModal } from "./widget-picker";
import type { PickerResult } from "./widget-picker";


export class HomepageView extends ItemView {
  private plugin: IrisHomepagePlugin;
  private engine: GridEngine;
  private widgetInstances: Map<string, BaseWidget> = new Map();
  private editMode = false;
  private draggedWidgetId: string | null = null;
  private gridEl: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: IrisHomepagePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.engine = new GridEngine(plugin.settings.columns);
  }

  getViewType(): string {
    return VIEW_TYPE_HOMEPAGE;
  }

  getDisplayText(): string {
    return "Homepage";
  }

  getIcon(): string {
    return "home";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();
  }

  render(): void {
    this.engine.setColumns(this.plugin.settings.columns);
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();

    const root = this.contentEl;
    root.empty();
    root.addClass("iris-hp-root");
    root.toggleClass("iris-hp-edit-mode", this.editMode);

    if (this.plugin.settings.showGreeting) {
      this.renderGreeting(root);
    }

    const gridEl = root.createDiv({ cls: "iris-hp-grid" });
    this.gridEl = gridEl;
    gridEl.style.gridTemplateColumns = `repeat(${this.plugin.settings.columns}, 1fr)`;
    gridEl.style.gridAutoRows = `${ROW_HEIGHT}px`;
    gridEl.style.gap = `${GRID_GAP}px`;

    const maxRow = this.engine.getMaxRow(this.plugin.settings.widgets);
    gridEl.style.minHeight = `${(maxRow + 2) * (ROW_HEIGHT + GRID_GAP)}px`;

    for (const config of this.plugin.settings.widgets) {
      this.renderWidget(gridEl, config);
    }

    this.attachGridListeners(gridEl);

    this.renderToolbar(root);
  }

  private renderToolbar(root: HTMLElement): void {
    const toolbar = root.createDiv({ cls: "iris-hp-toolbar" });

    const editBtn = toolbar.createEl("button", {
      cls: "iris-hp-toolbar-btn clickable-icon",
      attr: { "aria-label": this.editMode ? "Done editing" : "Edit layout" },
    });
    setIcon(editBtn, this.editMode ? "check" : "pencil");
    editBtn.addEventListener("click", () => {
      this.editMode = !this.editMode;
      this.render();
    });

    if (this.editMode) {
      const addBtn = toolbar.createEl("button", {
        cls: "iris-hp-toolbar-btn clickable-icon",
        attr: { "aria-label": "Add widget" },
      });
      setIcon(addBtn, "plus");
      addBtn.addEventListener("click", () => this.openPicker());
    }
  }

  private async openPicker(): Promise<void> {
    const modal = new WidgetPickerModal(this.app);
    const result = await modal.open();
    if (!result) return;
    this.addWidget(result);
  }

  private renderGreeting(root: HTMLElement): void {
    const hour = new Date().getHours();
    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";

    const name = this.plugin.settings.greetingName;
    const text = name ? `${greeting}, ${name}` : greeting;

    root.createEl("h1", { cls: "iris-hp-greeting", text });
  }

  private renderWidget(gridEl: HTMLElement, config: WidgetConfig): void {
    const wrapper = gridEl.createDiv({ cls: "iris-hp-widget-wrapper" });
    wrapper.dataset.widgetId = config.id;
    wrapper.setAttribute("draggable", "true");
    this.setGridPos(wrapper, config.col, config.row, config.width, config.height);

    let widget: BaseWidget;

    if (isBuiltinWidget(config.type)) {
      switch (config.type) {
        case "recent-notes":
          widget = new RecentNotesWidget(this.app, wrapper, config, this.plugin);
          break;
        case "embedded-note":
          widget = new EmbeddedNoteWidget(this.app, wrapper, config, this.plugin);
          break;
      }
    } else {
      widget = new ViewEmbedWidget(this.app, wrapper, config, this.plugin);
    }

    this.widgetInstances.set(config.id, widget);
  }

  private addWidget(result: PickerResult): void {
    const { width, height } = result;
    const pos = this.engine.findFirstAvailable(this.plugin.settings.widgets, width, height);

    const config: WidgetConfig = {
      id: crypto.randomUUID(),
      type: result.type,
      col: pos.col,
      row: pos.row,
      width,
      height,
    };

    if (result.type === "recent-notes") {
      config.maxItems = 10;
      config.sortBy = "modified";
    }

    this.plugin.settings.widgets.push(config);
    this.engine.compact(this.plugin.settings.widgets);
    this.plugin.saveSettings();
  }

  private attachGridListeners(gridEl: HTMLElement): void {
    gridEl.addEventListener("dragstart", (e) => {
      if (!this.editMode) {
        e.preventDefault();
        return;
      }
      const wrapper = (e.target as HTMLElement).closest(".iris-hp-widget-wrapper") as HTMLElement | null;
      if (!wrapper) return;
      this.draggedWidgetId = wrapper.dataset.widgetId || null;
      if (this.draggedWidgetId && e.dataTransfer) {
        e.dataTransfer.setData("text/plain", this.draggedWidgetId);
        e.dataTransfer.effectAllowed = "move";
        wrapper.addClass("iris-hp-dragging");
      }
    });

    gridEl.addEventListener("dragover", (e) => {
      if (!this.editMode || !this.draggedWidgetId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      this.updateGhost(gridEl, e);
    });

    gridEl.addEventListener("dragleave", () => {
      this.removeGhost();
    });

    gridEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.removeGhost();
      if (!this.draggedWidgetId) return;

      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;

      const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
      if (!widget) return;

      const oldPositions = this.snapshotPositions(gridEl);

      widget.col = Math.min(cell.col, this.plugin.settings.columns - widget.width);
      widget.row = cell.row;
      this.engine.clamp(widget);
      this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
      this.engine.compact(this.plugin.settings.widgets);
      this.draggedWidgetId = null;

      this.animateReflow(gridEl, oldPositions);
      this.plugin.saveData(this.plugin.settings);
    });

    gridEl.addEventListener("dragend", () => {
      this.draggedWidgetId = null;
      this.removeGhost();
      gridEl.querySelectorAll(".iris-hp-dragging").forEach((el) => el.removeClass("iris-hp-dragging"));
    });

    gridEl.addEventListener("widget-resize-start", ((e: CustomEvent) => {
      if (!this.editMode) return;
      const { widgetId, event: mouseEvent } = e.detail;
      this.startResize(gridEl, widgetId, mouseEvent);
    }) as EventListener);
  }

  private startResize(gridEl: HTMLElement, widgetId: string, startEvent: MouseEvent): void {
    const widget = this.plugin.settings.widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = this.getCellSize(gridRect);
    const stepX = cellW + GRID_GAP;
    const stepY = cellH + GRID_GAP;

    const origWidth = widget.width;
    const origHeight = widget.height;

    const ghost = gridEl.createDiv({ cls: "iris-hp-resize-ghost" });
    this.setGridPos(ghost, widget.col, widget.row, widget.width, widget.height);

    const endCellFromEvent = (e: MouseEvent) => ({
      col: Math.floor((e.clientX - gridRect.left) / stepX),
      row: Math.floor((e.clientY - gridRect.top) / stepY),
    });

    const onMouseMove = (e: MouseEvent) => {
      const end = endCellFromEvent(e);

      let newWidth = Math.max(1, end.col - widget.col + 1);
      let newHeight = Math.max(1, end.row - widget.row + 1);
      newWidth = Math.min(newWidth, this.plugin.settings.columns - widget.col);

      this.setGridPos(ghost, widget.col, widget.row, newWidth, newHeight);
    };

    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      ghost.remove();

      const end = endCellFromEvent(e);

      widget.width = Math.max(1, Math.min(end.col - widget.col + 1, this.plugin.settings.columns - widget.col));
      widget.height = Math.max(1, end.row - widget.row + 1);

      if (widget.width !== origWidth || widget.height !== origHeight) {
        const oldPositions = this.snapshotPositions(gridEl);
        this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
        this.engine.compact(this.plugin.settings.widgets);
        this.animateReflow(gridEl, oldPositions);
        this.plugin.saveData(this.plugin.settings);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  private updateGhost(gridEl: HTMLElement, e: DragEvent): void {
    const cell = this.getCellFromEvent(gridEl, e);
    if (!cell) return;

    const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
    if (!widget) return;

    if (!this.ghostEl) {
      this.ghostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
    }

    const col = Math.min(cell.col, this.plugin.settings.columns - widget.width);
    this.setGridPos(this.ghostEl, col, cell.row, widget.width, widget.height);
  }

  private setGridPos(el: HTMLElement, col: number, row: number, w: number, h: number): void {
    el.style.gridColumn = `${col + 1} / span ${w}`;
    el.style.gridRow = `${row + 1} / span ${h}`;
  }

  private removeGhost(): void {
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
  }

  private getCellSize(gridRect: DOMRect): { cellW: number; cellH: number } {
    return {
      cellW: (gridRect.width - GRID_GAP * (this.plugin.settings.columns - 1)) / this.plugin.settings.columns,
      cellH: ROW_HEIGHT,
    };
  }

  private getCellFromEvent(gridEl: HTMLElement, e: MouseEvent): { col: number; row: number } | null {
    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = this.getCellSize(gridRect);

    const relX = e.clientX - gridRect.left;
    const relY = e.clientY - gridRect.top;

    return this.engine.pixelToCell(relX, relY, cellW + GRID_GAP, cellH + GRID_GAP);
  }

  /** Snapshot bounding rects for all widget wrappers keyed by widget ID. */
  private snapshotPositions(gridEl: HTMLElement): Map<string, DOMRect> {
    const positions = new Map<string, DOMRect>();
    gridEl.querySelectorAll<HTMLElement>(".iris-hp-widget-wrapper").forEach((el) => {
      const id = el.dataset.widgetId;
      if (id) positions.set(id, el.getBoundingClientRect());
    });
    return positions;
  }

  /** Apply new grid placements and FLIP-animate from old positions. */
  private animateReflow(gridEl: HTMLElement, oldPositions: Map<string, DOMRect>): void {
    for (const config of this.plugin.settings.widgets) {
      const wrapper = gridEl.querySelector<HTMLElement>(
        `.iris-hp-widget-wrapper[data-widget-id="${config.id}"]`
      );
      if (!wrapper) continue;

      this.setGridPos(wrapper, config.col, config.row, config.width, config.height);
    }

    // Update grid min-height
    const maxRow = this.engine.getMaxRow(this.plugin.settings.widgets);
    gridEl.style.minHeight = `${(maxRow + 2) * (ROW_HEIGHT + GRID_GAP)}px`;

    // Force layout so new positions are computed
    gridEl.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions

    gridEl.querySelectorAll<HTMLElement>(".iris-hp-widget-wrapper").forEach((el) => {
      const id = el.dataset.widgetId;
      if (!id) return;
      const oldRect = oldPositions.get(id);
      if (!oldRect) return;

      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        el.style.transition = "transform 0.25s ease";
        el.style.transform = "";
      });
    });
  }
}
