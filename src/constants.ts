import type { IrisHomepageSettings, BuiltinWidgetType, HomepageConfig } from "./types";

export const VIEW_TYPE_HOMEPAGE = "iris-homepage-view";
export const GRID_GAP = 12;

/**
 * Workspace name used when the core Workspaces plugin is disabled or no
 * workspace is active. The plugin always has at least one homepage under
 * this key as a fallback.
 */
export const FALLBACK_WORKSPACE_NAME = "Default";

/**
 * Layout used to seed a homepage the first time a workspace becomes active.
 * `workspaceName` is filled in by the caller from the workspace name being seeded.
 */
export function defaultHomepageConfig(workspaceName: string): HomepageConfig {
  return {
    workspaceName,
    columns: 8,
    rows: 9,
    gridGap: GRID_GAP,
    widgets: [
      {
        id: `default-quick-switcher-${workspaceName}`,
        type: "quick-switcher",
        col: 2,
        row: 4,
        width: 4,
        height: 1,
      },
    ],
  };
}

export const DEFAULT_SETTINGS: IrisHomepageSettings = {
  homepages: { [FALLBACK_WORKSPACE_NAME]: defaultHomepageConfig(FALLBACK_WORKSPACE_NAME) },
  openOnStartup: true,
  replaceNewTab: true,
  borderless: false,
  borderWidth: 1,
};

export interface BuiltinWidgetMeta {
  label: string;
  icon: string;
  width: number;
  height: number;
  /** Internal plugin id this widget wraps; if set and the plugin is disabled, the widget is hidden from the picker. */
  corePluginId?: string;
  /** Human-readable name of the core plugin, shown as a subtitle in the picker. */
  corePluginLabel?: string;
}

export const BUILTIN_WIDGETS: Record<BuiltinWidgetType, BuiltinWidgetMeta> = {
  "recent-notes": { label: "Recent Notes", icon: "clock", width: 4, height: 4 },
  "embedded-note": { label: "Embedded Note", icon: "file-text", width: 4, height: 6 },
  "new-note": { label: "New Note", icon: "plus", width: 2, height: 2 },
  "command": { label: "Command", icon: "terminal", width: 2, height: 2 },
  "quick-switcher": { label: "Quick Switcher", icon: "search", width: 8, height: 1 },
  "open-url": { label: "Open URL", icon: "link", width: 2, height: 2 },
  "base": { label: "Base", icon: "database", width: 4, height: 6, corePluginId: "bases", corePluginLabel: "Bases" },
  "web-search": { label: "Web Search", icon: "globe", width: 6, height: 1, corePluginId: "webviewer", corePluginLabel: "Web Viewer" },
  "message": { label: "Message", icon: "message-square", width: 4, height: 2 },
  "analog-clock": { label: "Analog Clock", icon: "clock", width: 3, height: 3 },
};

export const HIDDEN_VIEW_TYPES = new Set([
  VIEW_TYPE_HOMEPAGE,
  "empty",
  // Vanilla Bases view — picked via the dedicated "base" builtin widget instead,
  // which lets the user choose a .base file.
  "bases",
  // File-dependent views that don't work as standalone homepage widgets.
  "markdown",
  "canvas",
  "audio",
  "image",
  "pdf",
  "video",
]);

/** Known core Obsidian view types for grouping in the picker. */
export const CORE_VIEW_TYPES = new Set([
  "markdown",
  "canvas",
  "graph",
  "localgraph",
  "file-explorer",
  "search",
  "tag",
  "backlink",
  "outgoing-link",
  "outline",
  "bookmarks",
  "all-properties",
  "file-properties",
  "audio",
  "image",
  "pdf",
  "video",
  "release-notes",
]);

export const DEFAULT_VIEW_EMBED_SIZE = { width: 2, height: 3 };

export const VIEW_TYPE_ICON_MAP: Record<string, string> = {
  "file-explorer": "folder",
  "search": "search",
  "graph": "git-fork",
  "localgraph": "git-fork",
  "backlink": "links-coming-in",
  "outgoing-link": "links-going-out",
  "tag": "tag",
  "outline": "list",
  "bookmarks": "bookmark",
  "canvas": "layout-dashboard",
  "markdown": "file-text",
  "all-properties": "list-tree",
  "file-properties": "list-tree",
  "audio": "headphones",
  "image": "image",
  "pdf": "file-text",
  "video": "play-circle",
  "release-notes": "info",
};

export function humanizeViewType(type: string): string {
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveWidgetLabel(type: string): string {
  if (type in BUILTIN_WIDGETS) {
    return BUILTIN_WIDGETS[type as BuiltinWidgetType].label;
  }
  return humanizeViewType(type);
}

export function resolveWidgetIcon(type: string): string {
  if (type in BUILTIN_WIDGETS) {
    return BUILTIN_WIDGETS[type as BuiltinWidgetType].icon;
  }
  return VIEW_TYPE_ICON_MAP[type] || "box";
}
