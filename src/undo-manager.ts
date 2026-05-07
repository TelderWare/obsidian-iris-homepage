import type { WidgetConfig } from "./types";

/**
 * Tracks undo/redo snapshots of a widget layout.
 *
 * Snapshots are stored as JSON strings so callers always get a deep-cloned
 * array back from `undo()` / `redo()` — safe to mutate without clobbering
 * history.
 */
export class UndoManager {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  constructor(private readonly maxEntries: number = 50) {}

  /** Snapshot `widgets` onto the undo stack and clear the redo stack. Call BEFORE mutating. */
  push(widgets: WidgetConfig[]): void {
    this.undoStack.push(JSON.stringify(widgets));
    if (this.undoStack.length > this.maxEntries) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  /** Pop the most recent snapshot. Returns null if nothing to undo. Caller must pass current state so redo works. */
  undo(current: WidgetConfig[]): WidgetConfig[] | null {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(JSON.stringify(current));
    return JSON.parse(this.undoStack.pop()!) as WidgetConfig[];
  }

  /** Pop the most recent redo snapshot. Returns null if nothing to redo. */
  redo(current: WidgetConfig[]): WidgetConfig[] | null {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(JSON.stringify(current));
    return JSON.parse(this.redoStack.pop()!) as WidgetConfig[];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
