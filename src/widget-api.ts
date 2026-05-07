import type { App } from "obsidian";

/**
 * Convention-based widget discovery. Any Obsidian plugin can expose homepage
 * widgets by defining an `irisHomepageWidgets()` method on its plugin class
 * that returns an array of `IrisWidgetDefinition`. The homepage scans every
 * enabled plugin on load and whenever the plugin set changes — no imports,
 * no version checks, no explicit unregistration required.
 *
 *   export default class IrisTasksPlugin extends Plugin {
 *     irisHomepageWidgets(): IrisWidgetDefinition[] {
 *       return [{
 *         type: "iris-tasks:today",
 *         label: "Today's Tasks",
 *         icon: "check-square",
 *         defaultSizePx: { width: 320, height: 400 },
 *         create: (ctx) => {
 *           const el = ctx.containerEl.createDiv({ text: "…" });
 *           return { destroy: () => el.remove() };
 *         },
 *       }];
 *     }
 *   }
 */
export const IRIS_HOMEPAGE_WIDGETS_METHOD = "irisHomepageWidgets" as const;

/** Stable, read-only view of a widget instance's saved state. */
export interface IrisWidgetInstanceConfig {
  readonly id: string;
  readonly type: string;
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
  /** Per-instance data owned by the widget author. Persisted verbatim. */
  readonly data?: Readonly<Record<string, unknown>>;
}

/** Context handed to a widget factory on creation. */
export interface IrisWidgetContext {
  readonly app: App;
  /** Append your DOM here. The homepage owns the card chrome and resize handles. */
  readonly containerEl: HTMLElement;
  readonly config: IrisWidgetInstanceConfig;
  /** Persist per-instance data. Merges into `config.data`. */
  saveData(data: Record<string, unknown>): Promise<void>;
}

/** Controller returned by a widget factory — the homepage calls these hooks. */
export interface IrisWidgetInstance {
  /** Tear down DOM, disposables, and external subscriptions. */
  destroy(): void;
  /** Invoked when the widget's cell dimensions change (grid gap, resize). */
  onResize?(): void;
  /** Invoked when `config.data` changed externally (e.g. settings UI). */
  onConfigChange?(config: IrisWidgetInstanceConfig): void;
}

/** Static metadata + factory for a widget type. */
export interface IrisWidgetDefinition {
  /**
   * Globally unique widget type. Convention: `<plugin-id>:<widget-name>`, e.g.
   * `"iris-tasks:today"`. Collisions with built-in widget types are ignored
   * (the built-in wins).
   */
  type: string;
  /** Human-readable name shown in the widget picker. */
  label: string;
  /** Lucide icon name (same registry Obsidian uses). */
  icon: string;
  /**
   * Preferred pixel size for a fresh instance. The homepage converts this to
   * grid cells based on the active grid's current cell dimensions, then
   * clamps to fit — so a widget that declares 320×240 gets roughly that many
   * pixels on the user's current layout, regardless of their column count.
   */
  defaultSizePx: { width: number; height: number };
  /** Lower-bound pixel size. Converted to cells the same way; defaults to 1×1 cell. */
  minSizePx?: { width: number; height: number };
  /** Construct a widget instance. Called once per mounted widget card. */
  create(ctx: IrisWidgetContext): IrisWidgetInstance;
}

/** Plugin-instance shape the homepage probes during scanning. */
export interface IrisHomepageWidgetProvider {
  [IRIS_HOMEPAGE_WIDGETS_METHOD]?: () => IrisWidgetDefinition[];
}

/**
 * Internal registry. Populated by scanning enabled plugins for the
 * `irisHomepageWidgets()` convention. Built-in widgets are NOT tracked here.
 */
export class WidgetRegistry {
  private definitions = new Map<string, IrisWidgetDefinition>();
  private listeners = new Set<() => void>();
  private reservedTypes: ReadonlySet<string>;

  constructor(reservedTypes: Iterable<string>) {
    this.reservedTypes = new Set(reservedTypes);
  }

  /**
   * Replace the full set of registered definitions. Emits a change event
   * only when the visible contents actually differ, so redundant scans are
   * free.
   */
  replaceAll(definitions: IrisWidgetDefinition[]): void {
    const next = new Map<string, IrisWidgetDefinition>();
    for (const def of definitions) {
      if (!def || typeof def.type !== "string" || !def.type) continue;
      if (this.reservedTypes.has(def.type)) {
        console.warn(`[iris-homepage] Skipping widget "${def.type}": reserved built-in type`);
        continue;
      }
      if (next.has(def.type)) {
        console.warn(`[iris-homepage] Skipping duplicate widget "${def.type}"`);
        continue;
      }
      next.set(def.type, def);
    }
    if (!this.differs(next)) return;
    this.definitions = next;
    this.emit();
  }

  get(type: string): IrisWidgetDefinition | undefined {
    return this.definitions.get(type);
  }

  list(): readonly IrisWidgetDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** Subscribe to change events. Returns an unsubscribe fn. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private differs(next: Map<string, IrisWidgetDefinition>): boolean {
    if (next.size !== this.definitions.size) return true;
    for (const [type, def] of next) {
      const prev = this.definitions.get(type);
      if (!prev) return true;
      if (prev === def) continue;
      // Compare only stable, user-visible fields. Plugins commonly construct
      // fresh closures for `create` on every irisHomepageWidgets() call, so a
      // different reference doesn't mean anything changed — and treating it
      // as a change spammed onChange → refreshViews on every layout-change,
      // which destroyed and re-created expensive widgets (e.g. the bases
      // embed) on a 200ms cadence, causing visible flicker.
      if (prev.label !== def.label || prev.icon !== def.icon) return true;
      if (prev.defaultSizePx.width !== def.defaultSizePx.width) return true;
      if (prev.defaultSizePx.height !== def.defaultSizePx.height) return true;
    }
    return false;
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
