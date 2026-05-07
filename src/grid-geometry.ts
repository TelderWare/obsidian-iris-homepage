/**
 * Pure geometry helpers for the grid. No Obsidian or plugin imports — easy to unit test.
 */

/** Set CSS grid position on an element. Coordinates are 0-indexed; CSS is 1-indexed. */
export function setGridPos(el: HTMLElement, col: number, row: number, w: number, h: number): void {
  el.style.gridColumn = `${col + 1} / span ${w}`;
  el.style.gridRow = `${row + 1} / span ${h}`;
}

/** Measure the cell size in px given the grid's bounding rect, column count, row count, and gap. */
export function getCellSize(
  gridRect: DOMRect,
  cols: number,
  rows: number,
  gap: number
): { cellW: number; cellH: number } {
  return {
    cellW: (gridRect.width - gap * (cols - 1)) / cols,
    cellH: (gridRect.height - gap * (rows - 1)) / rows,
  };
}
