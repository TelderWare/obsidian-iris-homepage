import type { WidgetConfig } from "./types";

const MAX_COLS = 32;

function cellKey(row: number, col: number): number {
  return row * MAX_COLS + col;
}

export class GridEngine {
  private columns: number;
  private rows: number; // 0 = unlimited
  private map: Map<number, string> = new Map();

  constructor(columns: number, rows = 0) {
    this.columns = columns;
    this.rows = rows;
  }

  setColumns(columns: number): void {
    this.columns = columns;
  }

  setRows(rows: number): void {
    this.rows = rows;
  }

  /** Rebuild the persistent occupancy map from scratch. */
  sync(widgets: WidgetConfig[]): void {
    this.map.clear();
    for (const w of widgets) {
      this.addToMap(this.map, w);
    }
  }

  /** Build a standalone occupancy map (does not affect the persistent map). */
  buildOccupancyMap(widgets: WidgetConfig[], excludeId?: string): Map<number, string> {
    const map = new Map<number, string>();
    for (const w of widgets) {
      if (w.id === excludeId) continue;
      this.addToMap(map, w);
    }
    return map;
  }

  canPlaceWithMap(
    map: Map<number, string>,
    col: number,
    row: number,
    width: number,
    height: number
  ): boolean {
    if (col < 0 || row < 0 || col + width > this.columns) return false;
    if (this.rows > 0 && row + height > this.rows) return false;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (map.has(cellKey(r, c))) return false;
      }
    }
    return true;
  }

  removeFromMap(map: Map<number, string>, widget: WidgetConfig): void {
    for (let r = widget.row; r < widget.row + widget.height; r++) {
      for (let c = widget.col; c < widget.col + widget.width; c++) {
        map.delete(cellKey(r, c));
      }
    }
  }

  addToMap(map: Map<number, string>, widget: WidgetConfig): void {
    for (let r = widget.row; r < widget.row + widget.height; r++) {
      for (let c = widget.col; c < widget.col + widget.width; c++) {
        map.set(cellKey(r, c), widget.id);
      }
    }
  }

  /** 2D compact: move widgets to the topmost-leftmost valid position. */
  compact(widgets: WidgetConfig[], pinnedId?: string): void {
    const sorted = [...widgets].sort((a, b) => a.row - b.row || a.col - b.col);
    const workMap = new Map<number, string>();

    // Place pinned widget first so others pack around it
    if (pinnedId) {
      const pinned = sorted.find((w) => w.id === pinnedId);
      if (pinned) this.addToMap(workMap, pinned);
    }

    for (const widget of sorted) {
      if (widget.id === pinnedId) continue;

      let placed = false;
      for (let r = 0; r <= widget.row && !placed; r++) {
        for (let c = 0; c <= this.columns - widget.width; c++) {
          if (this.canPlaceWithMap(workMap, c, r, widget.width, widget.height)) {
            widget.row = r;
            widget.col = c;
            placed = true;
            break;
          }
        }
      }
      this.addToMap(workMap, widget);
    }

    // Sync persistent map after compaction
    this.map = workMap;
  }

  clamp(widget: WidgetConfig): void {
    widget.width = Math.min(widget.width, this.columns);
    widget.width = Math.max(widget.width, 1);
    widget.height = Math.max(widget.height, 1);
    if (this.rows > 0) {
      widget.height = Math.min(widget.height, this.rows);
      if (widget.row + widget.height > this.rows) {
        widget.row = this.rows - widget.height;
      }
    }
    if (widget.col + widget.width > this.columns) {
      widget.col = this.columns - widget.width;
    }
    if (widget.col < 0) widget.col = 0;
    if (widget.row < 0) widget.row = 0;
  }

  findFirstAvailable(widgets: WidgetConfig[], width: number, height: number): { col: number; row: number } {
    const map = this.buildOccupancyMap(widgets);
    const maxRow = this.rows > 0 ? this.rows - height : this.getMaxRow(widgets) + 2;
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= this.columns - width; col++) {
        if (this.canPlaceWithMap(map, col, row, width, height)) {
          return { col, row };
        }
      }
    }
    // Fallback: place at the bottom (may overflow if rows is fixed, but avoids data loss)
    return { col: 0, row: (this.rows > 0 ? this.rows : maxRow + 1) };
  }

  resolveCollisions(widgets: WidgetConfig[], movedWidget: WidgetConfig): void {
    const map = this.buildOccupancyMap(widgets, movedWidget.id);
    const displaced = new Set<string>();

    for (let r = movedWidget.row; r < movedWidget.row + movedWidget.height; r++) {
      for (let c = movedWidget.col; c < movedWidget.col + movedWidget.width; c++) {
        const occupant = map.get(cellKey(r, c));
        if (occupant) displaced.add(occupant);
      }
    }

    if (displaced.size === 0) {
      this.sync(widgets);
      return;
    }

    for (const id of displaced) {
      const w = widgets.find((w) => w.id === id);
      if (!w) continue;
      w.row = movedWidget.row + movedWidget.height;
      if (this.rows > 0 && w.row + w.height > this.rows) {
        w.height = Math.max(1, this.rows - w.row);
      }
    }

    // Only compact the displaced widgets, not everything on the board
    this.compactSubset(widgets, displaced);
    this.sync(widgets);
  }

  /** Compact only the given widget IDs, leaving others in place. */
  private compactSubset(widgets: WidgetConfig[], ids: Set<string>): void {
    const sorted = widgets.filter((w) => ids.has(w.id)).sort((a, b) => a.row - b.row || a.col - b.col);
    const map = this.buildOccupancyMap(widgets);

    for (const widget of sorted) {
      this.removeFromMap(map, widget);
      let placed = false;
      for (let r = 0; r <= widget.row && !placed; r++) {
        for (let c = 0; c <= this.columns - widget.width; c++) {
          if (this.canPlaceWithMap(map, c, r, widget.width, widget.height)) {
            widget.row = r;
            widget.col = c;
            placed = true;
            break;
          }
        }
      }
      this.addToMap(map, widget);
    }
  }

  getMaxRow(widgets: WidgetConfig[]): number {
    let max = 0;
    for (const w of widgets) {
      max = Math.max(max, w.row + w.height - 1);
    }
    return max;
  }

  pixelToCell(x: number, y: number, cellWidth: number, cellHeight: number): { col: number; row: number } {
    return {
      col: Math.max(0, Math.min(this.columns - 1, Math.floor(x / cellWidth))),
      row: Math.max(0, Math.floor(y / cellHeight)),
    };
  }
}
