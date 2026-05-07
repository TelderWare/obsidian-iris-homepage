import type { WidgetConfig } from "./types";
import { setGridPos, getCellSize } from "./grid-geometry";
import { snapshotPositions, animateReflow } from "./reflow-animator";

export interface ResizeHost {
  getWidgets(): WidgetConfig[];
  getColumns(): number;
  /** Fixed row count, or 0 for unlimited. */
  getRows(): number;
  getGridGap(): number;
  /** Effective row count used to compute cell height (fixed rows if set, else max-row + 1). */
  getEffectiveRowCount(): number;
  pushUndo(): void;
  save(): void;
  updateLayout(): void;
  resolveCollisions(widget: WidgetConfig): void;
}

type Corner = "br" | "bl" | "tr" | "tl" | "r" | "l" | "b" | "t";

/**
 * Start a resize gesture. Installs mousemove/mouseup listeners on `document`
 * that track the mouse and move a ghost element; on mouseup, commits the new
 * rect to the widget, resolves collisions, and animates the reflow.
 */
export function startResize(
  gridEl: HTMLElement,
  widgetId: string,
  corner: Corner,
  host: ResizeHost
): void {
  const widget = host.getWidgets().find((w) => w.id === widgetId);
  if (!widget) return;

  const gridRect = gridEl.getBoundingClientRect();
  const cols = host.getColumns();
  const rows = host.getRows();
  const gap = host.getGridGap();
  const { cellW, cellH } = getCellSize(gridRect, cols, host.getEffectiveRowCount(), gap);
  const stepX = cellW + gap;
  const stepY = cellH + gap;

  const origCol = widget.col;
  const origRow = widget.row;
  const origWidth = widget.width;
  const origHeight = widget.height;

  const anchorRight = origCol + origWidth;   // for tl, bl
  const anchorBottom = origRow + origHeight;  // for tl, tr

  const ghost = gridEl.createDiv({ cls: "iris-hp-resize-ghost" });
  setGridPos(ghost, widget.col, widget.row, widget.width, widget.height);

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

    w = Math.min(w, cols - col);
    if (rows > 0) h = Math.min(h, rows - row);
    return { col, row, w, h };
  };

  const onMouseMove = (e: MouseEvent) => {
    const r = computeRect(e);
    setGridPos(ghost, r.col, r.row, r.w, r.h);
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

    const moved =
      widget.width !== origWidth ||
      widget.height !== origHeight ||
      widget.col !== origCol ||
      widget.row !== origRow;

    if (moved) {
      host.pushUndo();
      const oldPositions = snapshotPositions(gridEl);
      host.resolveCollisions(widget);
      host.updateLayout();
      animateReflow(gridEl, oldPositions);
      host.save();
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}
