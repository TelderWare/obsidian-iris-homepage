import type { WidgetConfig } from "./types";
import type { PickerResult } from "./widget-picker";
import { setGridPos } from "./grid-geometry";
import { snapshotPositions, animateReflow } from "./reflow-animator";

const EMPTY_DRAG_IMG = new Image();
EMPTY_DRAG_IMG.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export interface DragHost {
  isEditMode(): boolean;
  getWidgets(): WidgetConfig[];
  getColumns(): number;
  /** Fixed row count, or 0 for unlimited. */
  getRows(): number;
  /** Compute grid-cell coords from a pointer event. */
  getCellFromEvent(e: MouseEvent): { col: number; row: number } | null;
  /** True if the target cell is occupied by another widget. */
  isCellOccupied(col: number, row: number): boolean;
  pushUndo(): void;
  save(): void;
  clampWidget(widget: WidgetConfig): void;
  resolveCollisions(widget: WidgetConfig): void;
  updateLayout(): void;

  /** Placing mode (when the user has just picked a widget and is about to drop it). */
  getPendingWidget(): PickerResult | null;
  cancelPlacing(): void;
  addWidgetAt(result: PickerResult, col: number, row: number): void;
  openPickerAt(col: number, row: number): void;

  /** Controller-owned drag state read/written via the host so the toolbar can see it. */
  setDraggedWidgetId(id: string | null): void;
  getDraggedWidgetId(): string | null;
  setDragOffset(col: number, row: number): void;
  getDragOffset(): { col: number; row: number };
}

/** Attach drag/drop/click/resize-start listeners to the grid element. */
export function attachGridListeners(gridEl: HTMLElement, host: DragHost): void {
  let ghostEl: HTMLElement | null = null;

  const removeGhost = () => {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  };

  const updateGhost = (e: DragEvent) => {
    const cell = host.getCellFromEvent(e);
    if (!cell) return;

    const draggedId = host.getDraggedWidgetId();
    const widget = host.getWidgets().find((w) => w.id === draggedId);
    if (!widget) return;

    if (!ghostEl) {
      ghostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
    }

    const { col: offCol, row: offRow } = host.getDragOffset();
    const cols = host.getColumns();
    const rows = host.getRows();
    const col = Math.max(0, Math.min(cell.col - offCol, cols - widget.width));
    const ghostMaxRow = rows > 0 ? rows - widget.height : Infinity;
    const row = Math.max(0, Math.min(cell.row - offRow, ghostMaxRow));
    setGridPos(ghostEl, col, row, widget.width, widget.height);
  };

  gridEl.addEventListener("dragstart", (e) => {
    if (!host.isEditMode()) {
      e.preventDefault();
      return;
    }
    const wrapper = (e.target as HTMLElement).closest(".iris-hp-widget-wrapper") as HTMLElement | null;
    if (!wrapper) return;
    const id = wrapper.dataset.widgetId || null;
    host.setDraggedWidgetId(id);
    if (id && e.dataTransfer) {
      const widget = host.getWidgets().find((w) => w.id === id);
      const cell = host.getCellFromEvent(e);
      if (widget && cell) {
        host.setDragOffset(cell.col - widget.col, cell.row - widget.row);
      } else {
        host.setDragOffset(0, 0);
      }
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0);
      wrapper.addClass("iris-hp-dragging");
    }
  });

  gridEl.addEventListener("dragover", (e) => {
    if (!host.isEditMode() || !host.getDraggedWidgetId()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    updateGhost(e);
  });

  gridEl.addEventListener("dragleave", () => {
    removeGhost();
  });

  gridEl.addEventListener("drop", (e) => {
    e.preventDefault();
    removeGhost();
    const draggedId = host.getDraggedWidgetId();
    if (!draggedId) return;

    const cell = host.getCellFromEvent(e);
    if (!cell) return;

    const widget = host.getWidgets().find((w) => w.id === draggedId);
    if (!widget) return;

    host.pushUndo();
    const oldPositions = snapshotPositions(gridEl);

    const { col: offCol, row: offRow } = host.getDragOffset();
    const cols = host.getColumns();
    const rows = host.getRows();
    widget.col = Math.max(0, Math.min(cell.col - offCol, cols - widget.width));
    const maxRow = rows > 0 ? rows - widget.height : Infinity;
    widget.row = Math.max(0, Math.min(cell.row - offRow, maxRow));
    host.clampWidget(widget);
    host.resolveCollisions(widget);
    host.setDraggedWidgetId(null);

    host.updateLayout();
    animateReflow(gridEl, oldPositions);
    host.save();
  });

  gridEl.addEventListener("dragend", () => {
    host.setDraggedWidgetId(null);
    removeGhost();
    gridEl.querySelectorAll(".iris-hp-dragging").forEach((el) => el.removeClass("iris-hp-dragging"));
  });

  gridEl.addEventListener("click", (e) => {
    if (!host.isEditMode()) return;
    // Ignore clicks on widget wrappers (they handle their own clicks)
    if ((e.target as HTMLElement).closest(".iris-hp-widget-wrapper")) return;

    const cell = host.getCellFromEvent(e);
    if (!cell) return;

    const pending = host.getPendingWidget();
    if (pending) {
      const cols = host.getColumns();
      const col = Math.max(0, Math.min(cell.col, cols - 1));
      const row = Math.max(0, cell.row);
      host.cancelPlacing();
      host.addWidgetAt(pending, col, row);
      return;
    }

    if (host.isCellOccupied(cell.col, cell.row)) return;
    host.openPickerAt(cell.col, cell.row);
  });
}
