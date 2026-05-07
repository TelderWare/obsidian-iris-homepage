import { ItemView, Menu, Notice, ViewStateResult, WorkspaceLeaf, setIcon } from "obsidian";
import type IrisHomepagePlugin from "./main";
import type { Homepage, WidgetConfig } from "./types";
import { VIEW_TYPE_HOMEPAGE } from "./constants";
import { getWorkspacesPlugin, getAllWorkspaceNames } from "./workspace-binder";
import { GridEngine } from "./grid-engine";
import { BaseWidget } from "./widgets/base-widget";
import { WidgetPickerModal } from "./widget-picker";
import type { PickerResult } from "./widget-picker";
import { createWidget } from "./widget-factory";
import { UndoManager } from "./undo-manager";
import { snapshotPositions, animateReflow } from "./reflow-animator";
import { setGridPos, getCellSize } from "./grid-geometry";
import { renderTrashZone, renderDoneButton } from "./toolbar";
import { startResize } from "./resize-controller";
import { attachGridListeners } from "./drag-controller";

export class HomepageView extends ItemView {
  navigation = true;
  private plugin: IrisHomepagePlugin;
  private engine: GridEngine;
  private widgetInstances: Map<string, BaseWidget> = new Map();
  private editMode = false;
  private draggedWidgetId: string | null = null;
  private dragOffsetCol = 0;
  private dragOffsetRow = 0;
  private gridEl: HTMLElement | null = null;
  private pendingWidget: PickerResult | null = null;
  private placingCleanup: (() => void) | null = null;
  private placingGhostEl: HTMLElement | null = null;
  private undoMgr = new UndoManager(50);

  constructor(leaf: WorkspaceLeaf, plugin: IrisHomepagePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.engine = new GridEngine(this.hp.columns);
  }

  /**
   * Current homepage being rendered — always reflects the *active* workspace.
   * The view doesn't store its own workspace; switching workspaces (via the
   * core plugin or our switcher) flips what this returns.
   */
  get hp(): Homepage {
    return this.plugin.getHomepage();
  }

  getViewType(): string {
    return VIEW_TYPE_HOMEPAGE;
  }

  getDisplayText(): string {
    return "Homepage";
  }

  getIcon(): string {
    return this.hp.icon ?? "home";
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    if (this.gridEl) this.render();
  }

  /**
   * Switch the active Obsidian workspace. Every open homepage view (including
   * this one) follows because they always read the active workspace. The
   * load may replace the layout entirely — that's intentional.
   */
  async switchHomepage(workspaceName: string): Promise<void> {
    if (workspaceName === this.hp.workspaceName) return;
    this.editMode = false;
    await this.plugin.switchToWorkspace(workspaceName);
  }

  async onOpen(): Promise<void> {
    // Never let anything in here escape — Obsidian awaits onOpen during
    // workspace deserialization, and a throw here can leave the splash stuck
    // on "Loading workspace…". Wraps addAction (icon name may not exist in
    // older Obsidian builds), render(), and event registration.
    try {
      this.addAction("layout-grid", "Switch homepage", (e) => this.openSwitcherMenu(e));
    } catch (err) {
      console.error("[iris-homepage] HomepageView.addAction threw:", err);
    }
    try {
      this.render();
    } catch (err) {
      console.error("[iris-homepage] HomepageView.render() threw on open:", err);
      this.renderFatal(err);
    }

    this.registerDomEvent(this.contentEl, "keydown", (e: KeyboardEvent) => {
      if (!this.editMode) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); this.undo(); }
      else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); this.redo(); }
    });

    // In edit mode, .iris-hp-widget-body has pointer-events:none so left-click
    // on widget content falls through to the wrapper for dragging. Right-click
    // should still reach the widget, so its own contextmenu listeners (recent-
    // notes filter, embedded-note markdown menu, etc.) keep working. Lift
    // pointer-events on the body just long enough for the contextmenu event to
    // hit-test against it; restore on the next tick.
    this.registerDomEvent(this.contentEl, "mousedown", (e: MouseEvent) => {
      if (!this.editMode || e.button !== 2) return;
      const wrapper = (e.target as HTMLElement | null)?.closest<HTMLElement>(".iris-hp-widget-wrapper");
      if (!wrapper) return;
      const body = wrapper.querySelector<HTMLElement>(".iris-hp-widget-body");
      if (!body) return;
      body.style.pointerEvents = "auto";
      window.setTimeout(() => { body.style.pointerEvents = ""; }, 0);
    });

    // Right-click: widget-specific menu on widgets, global action menu elsewhere.
    this.registerDomEvent(this.contentEl, "contextmenu", (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".iris-hp-trash-zone")) return;
      const wrapper = target?.closest<HTMLElement>(".iris-hp-widget-wrapper");
      if (wrapper) {
        const widgetId = wrapper.dataset.widgetId;
        const widget = widgetId ? this.widgetInstances.get(widgetId) : undefined;
        if (!widget?.buildContextMenu) return; // no per-widget menu → let browser/widget handle it
        e.preventDefault();
        const menu = new Menu();
        widget.buildContextMenu(menu);
        menu.showAtMouseEvent(e);
        return;
      }
      e.preventDefault();
      // Out of edit mode, the action menu has only "Edit layout" — skip the
      // menu and toggle directly. In edit mode there are more options
      // (add widget, undo/redo), so the menu is still useful.
      if (!this.editMode) {
        this.editMode = true;
        this.render();
        return;
      }
      const menu = new Menu();
      this.buildActionMenu(menu);
      menu.showAtMouseEvent(e);
    });
  }

  /** Populate a Menu with the edit/undo/redo/add actions shared between the pane menu and right-click. */
  private buildActionMenu(menu: Menu): void {
    menu.addItem((item) =>
      item
        .setTitle(this.editMode ? "Done editing" : "Edit layout")
        .setIcon(this.editMode ? "check" : "pencil")
        .onClick(() => {
          this.editMode = !this.editMode;
          this.render();
        }),
    );
    if (this.editMode) {
      menu.addItem((item) =>
        item
          .setTitle("Add widget")
          .setIcon("plus")
          .onClick(() => this.openPickerThenPlace()),
      );
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle("Undo")
          .setIcon("undo")
          .setDisabled(!this.undoMgr.canUndo())
          .onClick(() => this.undo()),
      );
      menu.addItem((item) =>
        item
          .setTitle("Redo")
          .setIcon("redo")
          .setDisabled(!this.undoMgr.canRedo())
          .onClick(() => this.redo()),
      );
    }
  }

  /** Extend the tab-header / more-options menu with homepage actions. */
  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    this.buildActionMenu(menu);
  }

  async onClose(): Promise<void> {
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();
  }

  /** Last-ditch placeholder shown when render() itself throws. Keeps the leaf
   *  alive so workspace deserialization completes even if a widget is broken. */
  private renderFatal(err: unknown): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("iris-hp-root");
    const box = root.createDiv({ cls: "iris-hp-fatal" });
    box.createEl("h3", { text: "Homepage failed to render" });
    box.createEl("p", { text: "Open the developer console for the full error." });
    const detail = box.createEl("pre");
    detail.textContent = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  }

  private get gridGap(): number {
    return this.hp.gridGap;
  }

  /** Effective row count used for cell-height math: fixed rows if set, else max-row + 1. */
  private getEffectiveRowCount(): number {
    const fixedRows = this.hp.rows;
    return fixedRows > 0
      ? fixedRows
      : Math.max(this.engine.getMaxRow(this.hp.widgets) + 1, 1);
  }

  /**
   * Measure the current cell size in pixels from the rendered grid element.
   * Used to convert px-based widget size hints into grid-cell counts.
   */
  getCellSizePx(): { cellWidth: number; cellHeight: number } {
    const gridEl = this.gridEl;
    const cols = this.hp.columns;
    const gap = this.gridGap;

    let cellWidth = 0;
    let cellHeight = 48;

    if (gridEl) {
      const gridWidth = gridEl.clientWidth;
      if (gridWidth > 0 && cols > 0) {
        cellWidth = Math.max(1, (gridWidth - gap * (cols - 1)) / cols);
      }
      const rowCount = this.getEffectiveRowCount();
      const gridHeight = gridEl.clientHeight;
      if (gridHeight > 0 && rowCount > 0) {
        cellHeight = Math.max(1, (gridHeight - gap * (rowCount - 1)) / rowCount);
      }
    }

    // Fallback when grid isn't mounted yet — use the content width as a hint.
    if (cellWidth === 0) cellWidth = cellHeight;
    return { cellWidth, cellHeight };
  }

  pxToCells(px: { width: number; height: number }): { width: number; height: number } {
    const { cellWidth, cellHeight } = this.getCellSizePx();
    const gap = this.gridGap;
    const widthCells = Math.max(1, Math.round((px.width + gap) / (cellWidth + gap)));
    const heightCells = Math.max(1, Math.round((px.height + gap) / (cellHeight + gap)));
    const maxCols = Math.max(1, this.hp.columns);
    return {
      width: Math.min(widthCells, maxCols),
      height: heightCells,
    };
  }

  render(): void {
    if (this.placingCleanup) this.placingCleanup();
    this.engine.setColumns(this.hp.columns);
    this.engine.setRows(this.hp.rows);
    // Clamp all widgets to fit within the current grid bounds
    for (const w of this.hp.widgets) {
      this.engine.clamp(w);
    }
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();

    const root = this.contentEl;
    root.empty();
    root.addClass("iris-hp-root");
    root.toggleClass("iris-hp-edit-mode", this.editMode);
    root.toggleClass("iris-hp-borderless", this.plugin.settings.borderless);
    root.style.setProperty("--iris-hp-border-width", `${this.plugin.settings.borderWidth}px`);

    const gridEl = root.createDiv({ cls: "iris-hp-grid" });
    this.gridEl = gridEl;
    this.applyGridTemplate(gridEl);

    for (const config of this.hp.widgets) {
      this.renderWidget(gridEl, config);
    }

    if (this.hp.widgets.length === 0) {
      const hint = root.createDiv({ cls: "iris-hp-empty-state" });
      const icon = hint.createDiv({ cls: "iris-hp-empty-state-icon" });
      setIcon(icon, "mouse-pointer-click");
      hint.createEl("span", { text: "Right-click anywhere to start building your homepage" });
    }

    if (this.editMode) {
      this.renderGridDots(gridEl);
    }

    this.attachGridListeners(gridEl);

    if (this.editMode) {
      renderTrashZone(root, {
        getDraggedWidgetId: () => this.draggedWidgetId,
        onTrashDrop: (widgetId) => {
          this.draggedWidgetId = null;
          const trashEl = root.querySelector<HTMLElement>(".iris-hp-trash-zone");
          if (trashEl) this.deleteWidgetAnimated(widgetId, trashEl);
        },
      });
      renderDoneButton(root, () => {
        this.editMode = false;
        this.render();
      });
    }
  }

  /** Apply grid template styles (columns, rows, gap) to the grid element. */
  private applyGridTemplate(gridEl: HTMLElement): void {
    gridEl.style.gridTemplateColumns = `repeat(${this.hp.columns}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${this.getEffectiveRowCount()}, 1fr)`;
    gridEl.style.gridAutoRows = "";
    gridEl.style.gap = `${this.gridGap}px`;
  }

  /** Render the edit-mode grid dots. */
  private renderGridDots(gridEl: HTMLElement): void {
    // Remove existing dots
    gridEl.querySelectorAll(".iris-hp-grid-dot").forEach((el) => el.remove());

    const cols = this.hp.columns;
    const fixedRows = this.hp.rows;
    const maxRow = this.engine.getMaxRow(this.hp.widgets);
    const rows = fixedRows > 0 ? fixedRows : Math.max(maxRow + 2, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dot = gridEl.createDiv({ cls: "iris-hp-grid-dot" });
        dot.style.gridColumn = `${c + 1}`;
        dot.style.gridRow = `${r + 1}`;
      }
    }
  }

  /** Update positions of existing widget wrappers without destroying/recreating them. */
  private updateLayout(): void {
    const gridEl = this.gridEl;
    if (!gridEl) return;

    this.applyGridTemplate(gridEl);

    for (const config of this.hp.widgets) {
      const wrapper = gridEl.querySelector<HTMLElement>(
        `.iris-hp-widget-wrapper[data-widget-id="${config.id}"]`
      );
      if (wrapper) {
        setGridPos(wrapper, config.col, config.row, config.width, config.height);
      }
    }

    if (this.editMode) {
      this.renderGridDots(gridEl);
    }
  }

  /** Save a snapshot of the current widget layout onto the undo stack. Call BEFORE mutating. */
  private pushUndo(): void {
    this.undoMgr.push(this.hp.widgets);
  }

  private undo(): void {
    const next = this.undoMgr.undo(this.hp.widgets);
    if (!next) return;
    this.hp.widgets = next;
    this.plugin.saveData(this.plugin.settings);
    this.render();
  }

  private redo(): void {
    const next = this.undoMgr.redo(this.hp.widgets);
    if (!next) return;
    this.hp.widgets = next;
    this.plugin.saveData(this.plugin.settings);
    this.render();
  }

  /** Animated delete: fly the wrapper toward the trash, then remove + reflow. */
  private deleteWidgetAnimated(widgetId: string, trashEl: HTMLElement): void {
    const gridEl = this.gridEl;
    if (!gridEl) return;

    const removeFromSettings = () => {
      const idx = this.hp.widgets.findIndex((w) => w.id === widgetId);
      if (idx === -1) return;
      this.pushUndo();
      const oldPositions = snapshotPositions(gridEl);
      this.hp.widgets.splice(idx, 1);
      this.updateLayout();
      animateReflow(gridEl, oldPositions);
      this.plugin.saveData(this.plugin.settings);
    };

    const wrapper = gridEl.querySelector<HTMLElement>(
      `.iris-hp-widget-wrapper[data-widget-id="${widgetId}"]`
    );

    if (!wrapper) {
      removeFromSettings();
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const trashRect = trashEl.getBoundingClientRect();
    const dx = trashRect.left + trashRect.width / 2 - (wrapperRect.left + wrapperRect.width / 2);
    const dy = trashRect.top + trashRect.height / 2 - (wrapperRect.top + wrapperRect.height / 2);

    wrapper.style.transition = "transform 0.25s ease, opacity 0.25s ease";
    wrapper.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
    wrapper.style.opacity = "0";
    wrapper.style.zIndex = "200";

    let deleted = false;
    const doDelete = () => { if (!deleted) { deleted = true; wrapper.remove(); removeFromSettings(); } };
    wrapper.addEventListener("transitionend", doDelete, { once: true });
    setTimeout(doDelete, 350);
  }

  private openSwitcherMenu(e: MouseEvent): void {
    const menu = new Menu();
    const ws = getWorkspacesPlugin(this.app);
    const currentName = this.hp.workspaceName;

    if (!ws) {
      menu.addItem((item) =>
        item
          .setTitle("Enable core Workspaces plugin to switch homepages")
          .setIcon("alert-triangle")
          .setDisabled(true),
      );
      menu.showAtMouseEvent(e);
      return;
    }

    const names = getAllWorkspaceNames(this.app).slice().sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      menu.addItem((item) =>
        item
          .setTitle("No workspaces saved yet")
          .setIcon("info")
          .setDisabled(true),
      );
    }
    for (const name of names) {
      const cfg = this.plugin.settings.homepages[name];
      menu.addItem((item) => {
        item
          .setTitle(name)
          .setIcon(cfg?.icon ?? "home")
          .setChecked(name === currentName)
          .onClick(() => this.switchHomepage(name));
      });
    }
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle("Manage workspaces…")
        .setIcon("layout-grid")
        .onClick(() => {
          // Open the core Workspaces management modal via its command.
          const ok = (this.app as any).commands?.executeCommandById?.("workspaces:manage");
          if (!ok) new Notice("Open Settings → Workspaces to add or remove workspaces.");
        }),
    );
    menu.showAtMouseEvent(e);
  }

  private async openPickerThenPlace(): Promise<void> {
    const modal = new WidgetPickerModal(this.app, this.plugin, this);
    const result = await modal.open();
    if (!result || !this.gridEl) return;
    this.enterPlacingMode(result);
  }

  private async openPickerAt(col: number, row: number): Promise<void> {
    const modal = new WidgetPickerModal(this.app, this.plugin, this);
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

      if (!this.placingGhostEl) {
        this.placingGhostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
      }

      const col = Math.max(0, Math.min(cell.col, this.hp.columns - 1));
      const row = Math.max(0, cell.row);
      const fit = this.engine.fitAt(
        this.hp.widgets, col, row, result.width, result.height
      );

      if (fit) {
        this.placingGhostEl.removeClass("iris-hp-drop-ghost-invalid");
        setGridPos(this.placingGhostEl, col, row, fit.width, fit.height);
      } else {
        // Cell is occupied — show a 1×1 invalid ghost so the cursor is still tracked
        this.placingGhostEl.addClass("iris-hp-drop-ghost-invalid");
        setGridPos(this.placingGhostEl, col, row, 1, 1);
      }
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
      if (this.placingGhostEl) {
        this.placingGhostEl.remove();
        this.placingGhostEl = null;
      }
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
    setGridPos(wrapper, config.col, config.row, config.width, config.height);

    try {
      const widget = createWidget(this.app, wrapper, config, this.plugin);
      this.widgetInstances.set(config.id, widget);
    } catch (err) {
      console.error(`[iris-homepage] Failed to render widget "${config.type}" (${config.id}):`, err);
      wrapper.empty();
      wrapper.addClass("iris-hp-widget");
      const errorBody = wrapper.createDiv({ cls: "iris-hp-widget-body iris-hp-widget-error" });
      const icon = errorBody.createDiv({ cls: "iris-hp-widget-error-icon" });
      setIcon(icon, "alert-triangle");
      errorBody.createEl("span", { text: "Widget failed to load" });
    }
  }

  private addWidgetAt(result: PickerResult, col: number, row: number): void {
    const fit = this.engine.fitAt(
      this.hp.widgets, col, row, result.width, result.height
    );
    if (!fit) return; // cell occupied, nothing to place

    const config: WidgetConfig = {
      id: crypto.randomUUID(),
      type: result.type,
      col,
      row,
      width: fit.width,
      height: fit.height,
    };

    this.pushUndo();
    this.hp.widgets.push(config);
    // fitAt guarantees no overlap, so resolveCollisions is only needed as a
    // safety net (e.g. if the grid changed between ghost preview and click).
    this.engine.resolveCollisions(this.hp.widgets, config);
    this.plugin.saveSettings();
    this.render();
  }

  private attachGridListeners(gridEl: HTMLElement): void {
    attachGridListeners(gridEl, {
      isEditMode: () => this.editMode,
      getWidgets: () => this.hp.widgets,
      getColumns: () => this.hp.columns,
      getRows: () => this.hp.rows,
      getCellFromEvent: (e) => this.getCellFromEvent(gridEl, e),
      isCellOccupied: (col, row) => {
        const map = this.engine.buildOccupancyMap(this.hp.widgets);
        return map.has(row * 32 + col);
      },
      pushUndo: () => this.pushUndo(),
      save: () => this.plugin.saveData(this.plugin.settings),
      clampWidget: (w) => this.engine.clamp(w),
      resolveCollisions: (w) => this.engine.resolveCollisions(this.hp.widgets, w),
      updateLayout: () => this.updateLayout(),
      getPendingWidget: () => this.pendingWidget,
      cancelPlacing: () => { if (this.placingCleanup) this.placingCleanup(); },
      addWidgetAt: (result, col, row) => this.addWidgetAt(result, col, row),
      openPickerAt: (col, row) => this.openPickerAt(col, row),
      setDraggedWidgetId: (id) => { this.draggedWidgetId = id; },
      getDraggedWidgetId: () => this.draggedWidgetId,
      setDragOffset: (col, row) => { this.dragOffsetCol = col; this.dragOffsetRow = row; },
      getDragOffset: () => ({ col: this.dragOffsetCol, row: this.dragOffsetRow }),
    });

    gridEl.addEventListener("widget-resize-start", ((e: CustomEvent) => {
      if (!this.editMode) return;
      const { widgetId, corner } = e.detail;
      startResize(gridEl, widgetId, corner, {
        getWidgets: () => this.hp.widgets,
        getColumns: () => this.hp.columns,
        getRows: () => this.hp.rows,
        getGridGap: () => this.gridGap,
        getEffectiveRowCount: () => this.getEffectiveRowCount(),
        pushUndo: () => this.pushUndo(),
        save: () => this.plugin.saveData(this.plugin.settings),
        updateLayout: () => this.updateLayout(),
        resolveCollisions: (w) => this.engine.resolveCollisions(this.hp.widgets, w),
      });
    }) as EventListener);
  }

  private getCellFromEvent(gridEl: HTMLElement, e: MouseEvent): { col: number; row: number } | null {
    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = getCellSize(
      gridRect,
      this.hp.columns,
      this.getEffectiveRowCount(),
      this.gridGap
    );

    const relX = e.clientX - gridRect.left;
    const relY = e.clientY - gridRect.top;

    return this.engine.pixelToCell(relX, relY, cellW + this.gridGap, cellH + this.gridGap);
  }
}
