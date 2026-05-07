/**
 * FLIP-animate widgets reflowing inside the grid.
 *
 * Usage:
 *   const snapshot = snapshotPositions(gridEl);
 *   // ...mutate layout so elements move to new grid positions...
 *   animateReflow(gridEl, snapshot);
 */

/** Snapshot bounding rects for all widget wrappers keyed by widget ID. */
export function snapshotPositions(gridEl: HTMLElement): Map<string, DOMRect> {
  const positions = new Map<string, DOMRect>();
  gridEl.querySelectorAll<HTMLElement>(".iris-hp-widget-wrapper").forEach((el) => {
    const id = el.dataset.widgetId;
    if (id) positions.set(id, el.getBoundingClientRect());
  });
  return positions;
}

/**
 * FLIP-animate widgets from old positions to their current grid positions.
 * Call after the DOM has been updated with new grid positions.
 */
export function animateReflow(gridEl: HTMLElement, oldPositions: Map<string, DOMRect>): void {
  // Force layout so new positions are computed.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  gridEl.offsetHeight;

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
