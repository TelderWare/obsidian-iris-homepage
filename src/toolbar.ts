import { setIcon } from "obsidian";

export interface TrashZoneCallbacks {
  /** Invoked when a widget wrapper is dropped on the trash zone. */
  onTrashDrop: (widgetId: string) => void;
  /** Returns the ID currently being dragged, if any. */
  getDraggedWidgetId: () => string | null;
}

/**
 * Floating "Done editing" confirm button, bottom-right. Visible only in edit
 * mode so the user can exit without going through the right-click menu.
 */
export function renderDoneButton(root: HTMLElement, onClick: () => void): void {
  const btn = root.createEl("button", {
    cls: "iris-hp-done-btn mod-cta",
    text: "Done",
    attr: { "aria-label": "Done editing" },
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
}

/**
 * Build the edit-mode trash drop zone (centered at the bottom). The floating
 * toolbar is gone — edit/undo/redo/add are now in the right-click menu; only
 * the trash stays visible because drag-to-delete needs a visible drop target.
 */
export function renderTrashZone(root: HTMLElement, cb: TrashZoneCallbacks): void {
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
    const widgetId = cb.getDraggedWidgetId();
    if (!widgetId) return;
    cb.onTrashDrop(widgetId);
  });
}
