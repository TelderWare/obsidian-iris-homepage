export const BUILTIN_WIDGET_TYPES = ["recent-notes", "embedded-note", "new-note", "command", "quick-switcher", "open-url", "base", "web-search", "message", "analog-clock"] as const;
export type BuiltinWidgetType = (typeof BUILTIN_WIDGET_TYPES)[number];

export interface WidgetConfig {
  id: string;
  type: string;
  col: number;
  row: number;
  width: number;
  height: number;
  // embedded-note
  notePath?: string;
  // base
  basePath?: string;
  // command
  commandId?: string;
  // open-url
  url?: string;
  urlLabel?: string;
  // custom icon override (command, open-url)
  icon?: string;
  // view embeds
  viewState?: Record<string, unknown>;
  // recent-notes per-instance filters
  recentNotesFilter?: { folderPath?: string; limit?: number };
  // externally-registered widgets (owned by other Iris plugins)
  data?: Record<string, unknown>;
}

/**
 * Per-workspace homepage layout. Each entry in `IrisHomepageSettings.homepages`
 * is keyed by an Obsidian workspace name (from the core Workspaces plugin),
 * and `workspaceName` mirrors that key so callers can read it off the object
 * directly. The plugin auto-creates a config the first time a workspace is seen.
 */
export interface HomepageConfig {
  /** Mirrors the storage key. Also serves as the homepage's display name. */
  workspaceName: string;
  icon?: string;
  columns: number;
  rows: number;
  gridGap: number;
  widgets: WidgetConfig[];
}

/** Alias kept for readability — the runtime homepage object is the stored config itself. */
export type Homepage = HomepageConfig;

export interface IrisHomepageSettings {
  /** Keyed by workspace name. Lazy-created on first access. */
  homepages: Record<string, HomepageConfig>;
  openOnStartup: boolean;
  replaceNewTab: boolean;
  /** Bordered vs borderless widget chrome. Global — applies to every homepage. */
  borderless: boolean;
  /** Widget border width in px. Global. Has no visible effect while `borderless` is on. */
  borderWidth: number;
  gridVersion?: number;
  recentFiles?: string[];
  hiddenRecentNotes?: string[];
}

export function isBuiltinWidget(type: string): type is BuiltinWidgetType {
  return (BUILTIN_WIDGET_TYPES as readonly string[]).includes(type);
}
