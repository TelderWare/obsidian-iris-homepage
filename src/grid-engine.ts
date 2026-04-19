import type { WidgetConfig } from "./types";

const MAX_COLS = 32;

function cellKey(row: number, col: number): number {
  return row * MAX_COLS + col;
}

function rectsOverlap(a: WidgetConfig, b: WidgetConfig): boolean {
  return (
    a.col < b.col + b.width &&
    a.col + a.width > b.col &&
    a.row < b.row + b.height &&
    a.row + a.height > b.row
  );
}

/**
 * Grid placement engine.
 *
 * Design principle: widgets stay exactly where the user put them. The engine
 * never compacts, never slides widgets up, never moves anything sideways.
 * The only movement the engine ever applies is a straight-down push when a
 * widget literally cannot stay where it is (another widget was dropped on it,
 * or a resize overlapped it). Gaps are preserved.
 */
export class GridEngine {
  private columns: number;
  private rows: number; // 0 = unlimited

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

  /** Build an occupancy map, optionally excluding one widget. */
  buildOccupancyMap(widgets: WidgetConfig[], excludeId?: string): Map<number, string> {
    const map = new Map<number, string>();
    for (const w of widgets) {
      if (w.id === excludeId) continue;
      for (let r = w.row; r < w.row + w.height; r++) {
        for (let c = w.col; c < w.col + w.width; c++) {
          map.set(cellKey(r, c), w.id);
        }
      }
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

  /** Clamp a widget's size and position into the grid bounds. Does not resolve collisions. */
  clamp(widget: WidgetConfig): void {
    widget.width = Math.min(Math.max(widget.width, 1), this.columns);
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

  /**
   * Given a target top-left cell and desired maximum size, return the largest
   * rectangle that fits starting at that cell without overlapping any existing
   * widget or leaving the grid bounds. Returns null if the target cell itself
   * is occupied or out of bounds.
   */
  fitAt(
    widgets: WidgetConfig[],
    col: number,
    row: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } | null {
    if (col < 0 || row < 0 || col >= this.columns) return null;
    if (this.rows > 0 && row >= this.rows) return null;

    const map = this.buildOccupancyMap(widgets);
    if (map.has(cellKey(row, col))) return null;

    // Expand right along the starting row.
    let width = 0;
    const widthCap = Math.min(maxWidth, this.columns - col);
    while (width < widthCap && !map.has(cellKey(row, col + width))) width++;
    if (width === 0) return null;

    // With that width fixed, expand down.
    const heightCap = this.rows > 0 ? Math.min(maxHeight, this.rows - row) : maxHeight;
    let height = 0;
    outer: while (height < heightCap) {
      const r = row + height;
      for (let c = col; c < col + width; c++) {
        if (map.has(cellKey(r, c))) break outer;
      }
      height++;
    }
    if (height === 0) return null;

    return { width, height };
  }

  /** Find the topmost-leftmost empty slot for a widget of the given size. Used only for new widgets. */
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
    return { col: 0, row: this.rows > 0 ? 0 : maxRow + 1 };
  }

  /**
   * Minimum-disturbance collision resolution.
   *
   * `movedWidget` has just been placed or resized. For every widget it
   * overlaps, pick the direction (up/down/left/right) that requires the
   * smallest shift to clear, prefers staying in bounds, and prefers not
   * kicking off a cascade. Apply the shift. If the shifted widget now
   * overlaps something, recurse with the same rule.
   *
   * Widgets only ever move when literally forced to.
   */
  resolveCollisions(widgets: WidgetConfig[], movedWidget: WidgetConfig): void {
    const queue: WidgetConfig[] = [movedWidget];
    // Guard against pathological cycles.
    let guard = widgets.length * widgets.length * 4 + 16;

    while (queue.length > 0 && guard-- > 0) {
      const cur = queue.shift()!;
      for (const other of widgets) {
        if (other.id === cur.id) continue;
        if (!rectsOverlap(cur, other)) continue;
        this.shiftOutOfWay(widgets, cur, other);
        queue.push(other);
      }
    }
  }

  /**
   * Move `other` the shortest distance that clears `cur`, picking the best
   * of the four cardinal directions. If the chosen direction would take
   * `other` partially out of bounds, compress it to fit.
   */
  private shiftOutOfWay(widgets: WidgetConfig[], cur: WidgetConfig, other: WidgetConfig): void {
    type Candidate = {
      col: number;
      row: number;
      width: number;
      height: number;
      valid: boolean;
      collisions: number;
      compression: number;
      dist: number;
    };

    const origArea = other.width * other.height;
    const origCol = other.col;
    const origRow = other.row;

    // For each direction, place `other` just outside `cur`, then compress if
    // that shoves part of it past the grid edge.
    const build = (col: number, row: number, width: number, height: number): Candidate => {
      // Compress along the axis that overflows.
      if (col < 0) {
        width += col; // col is negative
        col = 0;
      }
      if (row < 0) {
        height += row;
        row = 0;
      }
      if (col + width > this.columns) {
        width = this.columns - col;
      }
      if (this.rows > 0 && row + height > this.rows) {
        height = this.rows - row;
      }

      const valid = width >= 1 && height >= 1 && col >= 0 && row >= 0;
      let collisions = 0;
      if (valid) {
        for (const w of widgets) {
          if (w.id === other.id || w.id === cur.id) continue;
          if (
            col < w.col + w.width &&
            col + width > w.col &&
            row < w.row + w.height &&
            row + height > w.row
          ) {
            collisions++;
          }
        }
      }
      const compression = Math.max(0, origArea - width * height);
      const dist = Math.abs(col - origCol) + Math.abs(row - origRow);
      return { col, row, width, height, valid, collisions, compression, dist };
    };

    const candidates: Candidate[] = [
      build(other.col, cur.row + cur.height, other.width, other.height),          // down
      build(other.col, cur.row - other.height, other.width, other.height),        // up
      build(cur.col + cur.width, other.row, other.width, other.height),           // right
      build(cur.col - other.width, other.row, other.width, other.height),         // left
    ];

    // Prefer: valid > fewest collisions > least compression > shortest distance.
    // Stable tiebreak by array order (down, up, right, left).
    candidates.sort((a, b) => {
      if (a.valid !== b.valid) return a.valid ? -1 : 1;
      if (a.collisions !== b.collisions) return a.collisions - b.collisions;
      if (a.compression !== b.compression) return a.compression - b.compression;
      return a.dist - b.dist;
    });

    const best = candidates[0];
    other.col = best.col;
    other.row = best.row;
    other.width = Math.max(1, best.width);
    other.height = Math.max(1, best.height);
    this.clamp(other);
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
