import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type IrisHomepagePlugin from "./main";
import type { WidgetConfig } from "./types";
import { isBuiltinWidget } from "./types";
import { VIEW_TYPE_HOMEPAGE, ROW_HEIGHT, GRID_GAP } from "./constants";
import { GridEngine } from "./grid-engine";
import { BaseWidget } from "./widgets/base-widget";
import { RecentNotesWidget } from "./widgets/recent-notes";
import { EmbeddedNoteWidget } from "./widgets/embedded-note";
import { NewNoteWidget } from "./widgets/new-note";
import { CreateTaskWidget } from "./widgets/create-task";
import { CommandWidget } from "./widgets/command";
import { QuickSwitcherWidget } from "./widgets/quick-switcher";
import { ViewEmbedWidget } from "./widgets/view-embed";
import { WidgetPickerModal } from "./widget-picker";
import type { PickerResult } from "./widget-picker";

const EMPTY_DRAG_IMG = new Image();
EMPTY_DRAG_IMG.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";


export class HomepageView extends ItemView {
  private plugin: IrisHomepagePlugin;
  private engine: GridEngine;
  private widgetInstances: Map<string, BaseWidget> = new Map();
  private editMode = false;
  private draggedWidgetId: string | null = null;
  private dragOffsetCol = 0;
  private dragOffsetRow = 0;
  private gridEl: HTMLElement | null = null;
  private ghostEl: HTMLElement | null = null;
  private pendingWidget: PickerResult | null = null;
  private placingCleanup: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: IrisHomepagePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.engine = new GridEngine(plugin.settings.columns);
  }

  getViewType(): string {
    return VIEW_TYPE_HOMEPAGE;
  }

  getDisplayText(): string {
    return "Home";
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
    if (this.placingCleanup) this.placingCleanup();
    this.engine.setColumns(this.plugin.settings.columns);
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();

    const root = this.contentEl;
    root.empty();
    root.addClass("iris-hp-root");
    root.toggleClass("iris-hp-edit-mode", this.editMode);
    root.toggleClass("iris-hp-borderless", this.plugin.settings.borderless);

    const gridEl = root.createDiv({ cls: "iris-hp-grid" });
    this.gridEl = gridEl;
    gridEl.style.gridTemplateColumns = `repeat(${this.plugin.settings.columns}, 1fr)`;
    gridEl.style.gridAutoRows = `${ROW_HEIGHT}px`;
    gridEl.style.gap = `${GRID_GAP}px`;

    for (const config of this.plugin.settings.widgets) {
      this.renderWidget(gridEl, config);
    }

    if (this.plugin.settings.widgets.length === 0) {
      const hint = root.createDiv({ cls: "iris-hp-empty-state" });
      const icon = hint.createDiv({ cls: "iris-hp-empty-state-icon" });
      setIcon(icon, "pencil");
      hint.createEl("span", { text: "Click the pencil to get started" });
    }

    if (this.editMode) {
      const cols = this.plugin.settings.columns;
      const maxRow = this.engine.getMaxRow(this.plugin.settings.widgets);
      const rootStyle = getComputedStyle(this.contentEl);
      const rootPadding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
      const viewportRows = Math.floor((this.contentEl.clientHeight - rootPadding) / (ROW_HEIGHT + GRID_GAP));
      const rows = Math.max(maxRow + 2, viewportRows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dot = gridEl.createDiv({ cls: "iris-hp-grid-dot" });
          dot.style.gridColumn = `${c + 1}`;
          dot.style.gridRow = `${r + 1}`;
        }
      }
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
      addBtn.addEventListener("click", () => this.openPickerThenPlace());

      // Trash drop zone
      const trash = root.createDiv({ cls: "iris-hp-trash-zone" });
      setIcon(trash, "trash-2");

      trash.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        trash.addClass("iris-hp-trash-hover");
      });

      trash.addEventListener("dragleave", () => {
        trash.removeClass("iris-hp-trash-hover");
      });

      trash.addEventListener("drop", (e) => {
        e.preventDefault();
        trash.removeClass("iris-hp-trash-hover");
        if (!this.draggedWidgetId || !this.gridEl) return;

        const widgetId = this.draggedWidgetId;
        const gridEl = this.gridEl;
        this.draggedWidgetId = null;

        const deleteWidget = () => {
          const idx = this.plugin.settings.widgets.findIndex((w) => w.id === widgetId);
          if (idx === -1) return;
          const oldPositions = this.snapshotPositions(gridEl);
          this.plugin.settings.widgets.splice(idx, 1);
          this.engine.compact(this.plugin.settings.widgets);
          this.animateReflow(gridEl, oldPositions);
          this.plugin.saveData(this.plugin.settings);
        };

        const wrapper = gridEl.querySelector<HTMLElement>(
          `.iris-hp-widget-wrapper[data-widget-id="${widgetId}"]`
        );

        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const trashRect = trash.getBoundingClientRect();
          const dx = trashRect.left + trashRect.width / 2 - (wrapperRect.left + wrapperRect.width / 2);
          const dy = trashRect.top + trashRect.height / 2 - (wrapperRect.top + wrapperRect.height / 2);

          wrapper.style.transition = "transform 0.25s ease, opacity 0.25s ease";
          wrapper.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
          wrapper.style.opacity = "0";
          wrapper.style.zIndex = "200";

          let deleted = false;
          const doDelete = () => { if (!deleted) { deleted = true; wrapper.remove(); deleteWidget(); } };
          wrapper.addEventListener("transitionend", doDelete, { once: true });
          setTimeout(doDelete, 350);
        } else {
          deleteWidget();
        }
      });
    }
  }

  private async openPickerThenPlace(): Promise<void> {
    const modal = new WidgetPickerModal(this.app);
    const result = await modal.open();
    if (!result || !this.gridEl) return;
    this.enterPlacingMode(result);
  }

  private async openPickerAt(col: number, row: number): Promise<void> {
    const modal = new WidgetPickerModal(this.app);
    const result = await modal.open();
    if (!result) return;
    this.addWidgetAt(result, col, row);
  }

  private enterPlacingMode(result: PickerResult): void {
    this.pendingWidget = result;
    this.contentEl.addClass("iris-hp-placing");

    const gridEl = this.gridEl!;

    const onMouseMove = (e: MouseEvent) => {
      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;

      if (!this.ghostEl) {
        this.ghostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
      }

      const col = Math.max(0, Math.min(cell.col, this.plugin.settings.columns - result.width));
      const row = Math.max(0, cell.row);
      this.setGridPos(this.ghostEl, col, row, result.width, result.height);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    };

    const cleanup = () => {
      this.pendingWidget = null;
      this.contentEl.removeClass("iris-hp-placing");
      this.removeGhost();
      gridEl.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      this.placingCleanup = null;
    };

    this.placingCleanup = cleanup;
    gridEl.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
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
        case "new-note":
          widget = new NewNoteWidget(this.app, wrapper, config, this.plugin);
          break;
        case "create-task":
          widget = new CreateTaskWidget(this.app, wrapper, config, this.plugin);
          break;
        case "command":
          widget = new CommandWidget(this.app, wrapper, config, this.plugin);
          break;
        case "quick-switcher":
          widget = new QuickSwitcherWidget(this.app, wrapper, config, this.plugin);
          break;
        case "iris-tasks-view":
          widget = new ViewEmbedWidget(this.app, wrapper, config, this.plugin);
          break;
      }
    } else {
      widget = new ViewEmbedWidget(this.app, wrapper, config, this.plugin);
    }

    this.widgetInstances.set(config.id, widget);
  }

  private addWidgetAt(result: PickerResult, col: number, row: number): void {
    const { width, height } = result;
    const clampedCol = Math.max(0, Math.min(col, this.plugin.settings.columns - width));
    const clampedRow = Math.max(0, row);

    const config: WidgetConfig = {
      id: crypto.randomUUID(),
      type: result.type,
      col: clampedCol,
      row: clampedRow,
      width,
      height,
    };

    this.plugin.settings.widgets.push(config);
    this.engine.resolveCollisions(this.plugin.settings.widgets, config);
    this.plugin.saveSettings();
    this.render();
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
        const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
        const cell = this.getCellFromEvent(gridEl, e);
        if (widget && cell) {
          this.dragOffsetCol = cell.col - widget.col;
          this.dragOffsetRow = cell.row - widget.row;
        } else {
          this.dragOffsetCol = 0;
          this.dragOffsetRow = 0;
        }
        e.dataTransfer.setData("text/plain", this.draggedWidgetId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0);
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

      widget.col = Math.max(0, Math.min(cell.col - this.dragOffsetCol, this.plugin.settings.columns - widget.width));
      widget.row = Math.max(0, cell.row - this.dragOffsetRow);
      this.engine.clamp(widget);
      this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
      this.draggedWidgetId = null;

      this.animateReflow(gridEl, oldPositions);
      this.plugin.saveData(this.plugin.settings);
    });

    gridEl.addEventListener("dragend", () => {
      this.draggedWidgetId = null;
      this.removeGhost();
      gridEl.querySelectorAll(".iris-hp-dragging").forEach((el) => el.removeClass("iris-hp-dragging"));
    });

    gridEl.addEventListener("click", (e) => {
      if (!this.editMode) return;
      // Ignore clicks on widget wrappers (they handle their own clicks)
      if ((e.target as HTMLElement).closest(".iris-hp-widget-wrapper")) return;

      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;

      if (this.pendingWidget) {
        const col = Math.max(0, Math.min(cell.col, this.plugin.settings.columns - this.pendingWidget.width));
        const row = Math.max(0, cell.row);
        const result = this.pendingWidget;
        if (this.placingCleanup) this.placingCleanup();
        this.addWidgetAt(result, col, row);
        return;
      }

      // Check if cell is occupied
      const map = this.engine.buildOccupancyMap(this.plugin.settings.widgets);
      const key = cell.row * 32 + cell.col;
      if (map.has(key)) return;

      this.openPickerAt(cell.col, cell.row);
    });

    gridEl.addEventListener("widget-resize-start", ((e: CustomEvent) => {
      if (!this.editMode) return;
      const { widgetId, corner, event: mouseEvent } = e.detail;
      this.startResize(gridEl, widgetId, corner, mouseEvent);
    }) as EventListener);
  }

  private startResize(gridEl: HTMLElement, widgetId: string, corner: string, startEvent: MouseEvent): void {
    const widget = this.plugin.settings.widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = this.getCellSize(gridRect);
    const stepX = cellW + GRID_GAP;
    const stepY = cellH + GRID_GAP;

    const origCol = widget.col;
    const origRow = widget.row;
    const origWidth = widget.width;
    const origHeight = widget.height;

    const anchorRight = origCol + origWidth;   // for tl, bl
    const anchorBottom = origRow + origHeight;  // for tl, tr

    const ghost = gridEl.createDiv({ cls: "iris-hp-resize-ghost" });
    this.setGridPos(ghost, widget.col, widget.row, widget.width, widget.height);

    const cellFromEvent = (e: MouseEvent) => ({
      col: Math.floor((e.clientX - gridRect.left) / stepX),
      row: Math.floor((e.clientY - gridRect.top) / stepY),
    });

    const computeRect = (e: MouseEvent) => {
      const end = cellFromEvent(e);
      let col = origCol, row = origRow, w = origWidth, h = origHeight;

      switch (corner) {
        case "br":
          w = Math.max(1, end.col - origCol + 1);
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "bl":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "tr":
          w = Math.max(1, end.col - origCol + 1);
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
        case "tl":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
        case "r":
          w = Math.max(1, end.col - origCol + 1);
          break;
        case "l":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          break;
        case "b":
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "t":
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
      }

      w = Math.min(w, this.plugin.settings.columns - col);
      return { col, row, w, h };
    };

    const onMouseMove = (e: MouseEvent) => {
      const r = computeRect(e);
      this.setGridPos(ghost, r.col, r.row, r.w, r.h);
    };

    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      ghost.remove();

      const r = computeRect(e);
      widget.col = r.col;
      widget.row = r.row;
      widget.width = r.w;
      widget.height = r.h;

      if (widget.width !== origWidth || widget.height !== origHeight || widget.col !== origCol || widget.row !== origRow) {
        const oldPositions = this.snapshotPositions(gridEl);
        this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
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

    const col = Math.max(0, Math.min(cell.col - this.dragOffsetCol, this.plugin.settings.columns - widget.width));
    const row = Math.max(0, cell.row - this.dragOffsetRow);
    this.setGridPos(this.ghostEl, col, row, widget.width, widget.height);
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
