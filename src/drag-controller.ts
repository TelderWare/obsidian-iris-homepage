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
  let touchDrag: { pointerId: number; startX: number; startY: number; wrapper: HTMLElement; active: boolean } | null = null;

  const removeGhost = () => {
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  };

  const updateGhost = (e: MouseEvent) => {
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
    // A touch drag (below) is already moving the widget; don't let the
    // browser's long-press native drag take over mid-gesture.
    if (!host.isEditMode() || touchDrag) {
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

  /** Move the dragged widget so its grabbed cell lands on `cell`. */
  const commitMove = (cell: { col: number; row: number }) => {
    const draggedId = host.getDraggedWidgetId();
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
  };

  gridEl.addEventListener("drop", (e) => {
    e.preventDefault();
    removeGhost();
    if (!host.getDraggedWidgetId()) return;

    const cell = host.getCellFromEvent(e);
    if (!cell) return;
    commitMove(cell);
  });

  gridEl.addEventListener("dragend", () => {
    host.setDraggedWidgetId(null);
    removeGhost();
    gridEl.querySelectorAll(".iris-hp-dragging").forEach((el) => el.removeClass("iris-hp-dragging"));
  });

  // ─── Touch dragging ───
  // HTML5 drag-and-drop needs a long press on mobile, and a plain horizontal
  // swipe is claimed by Obsidian's sidebar gesture. Touch pointers instead
  // drive the move directly; HomepageView stops the touch events from
  // reaching the sidebar handler, and `touch-action: none` on edit-mode
  // wrappers keeps the browser from scrolling mid-drag.
  const findTrash = (x: number, y: number): HTMLElement | null =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(".iris-hp-trash-zone") ?? null;

  const endTouchDrag = () => {
    document.removeEventListener("pointermove", onTouchMove);
    document.removeEventListener("pointerup", onTouchUp);
    document.removeEventListener("pointercancel", onTouchCancel);
    removeGhost();
    document.querySelectorAll(".iris-hp-trash-hover").forEach((el) => el.removeClass("iris-hp-trash-hover"));
    touchDrag?.wrapper.removeClass("iris-hp-dragging");
    touchDrag = null;
  };

  const onTouchMove = (e: PointerEvent) => {
    if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
    if (!touchDrag.active) {
      // Small threshold so taps on the configure buttons still register as clicks.
      if (Math.hypot(e.clientX - touchDrag.startX, e.clientY - touchDrag.startY) < 8) return;
      touchDrag.active = true;
      touchDrag.wrapper.addClass("iris-hp-dragging");
    }
    e.preventDefault();
    const trash = findTrash(e.clientX, e.clientY);
    document.querySelectorAll(".iris-hp-trash-zone").forEach((el) => el.toggleClass("iris-hp-trash-hover", el === trash));
    if (trash) removeGhost();
    else updateGhost(e);
  };

  const onTouchUp = (e: PointerEvent) => {
    if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
    const wasActive = touchDrag.active;
    endTouchDrag();
    if (!wasActive) {
      host.setDraggedWidgetId(null);
      return;
    }
    const trash = findTrash(e.clientX, e.clientY);
    if (trash) {
      trash.dispatchEvent(new CustomEvent("iris-hp-touch-drop"));
    } else {
      const cell = host.getCellFromEvent(e);
      if (cell) commitMove(cell);
    }
    host.setDraggedWidgetId(null);
  };

  const onTouchCancel = (e: PointerEvent) => {
    if (!touchDrag || e.pointerId !== touchDrag.pointerId) return;
    endTouchDrag();
    host.setDraggedWidgetId(null);
  };

  gridEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || !host.isEditMode() || touchDrag) return;
    const target = e.target as HTMLElement;
    if (target.closest(".iris-hp-resize-handle, .iris-hp-widget-configure")) return;
    const wrapper = target.closest<HTMLElement>(".iris-hp-widget-wrapper");
    const id = wrapper?.dataset.widgetId;
    if (!wrapper || !id) return;
    const widget = host.getWidgets().find((w) => w.id === id);
    if (!widget) return;

    const cell = host.getCellFromEvent(e);
    host.setDraggedWidgetId(id);
    host.setDragOffset(cell ? cell.col - widget.col : 0, cell ? cell.row - widget.row : 0);
    touchDrag = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, wrapper, active: false };
    document.addEventListener("pointermove", onTouchMove);
    document.addEventListener("pointerup", onTouchUp);
    document.addEventListener("pointercancel", onTouchCancel);
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
