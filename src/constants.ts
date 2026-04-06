import type { IrisHomepageSettings, BuiltinWidgetType } from "./types";

export const VIEW_TYPE_HOMEPAGE = "iris-homepage-view";
export const ROW_HEIGHT = 60;
export const GRID_GAP = 12;

export const DEFAULT_SETTINGS: IrisHomepageSettings = {
  columns: 8,
  rows: 0,
  widgets: [
    {
      id: "default-recent",
      type: "recent-notes",
      col: 0,
      row: 0,
      width: 4,
      height: 4,
    },
  ],
  openOnStartup: true,
  replaceNewTab: true,
  borderless: false,
  taskFolder: "Tasks",
};

export const BUILTIN_WIDGETS: Record<BuiltinWidgetType, { label: string; icon: string; width: number; height: number }> = {
  "recent-notes": { label: "Recent Notes", icon: "clock", width: 4, height: 4 },
  "embedded-note": { label: "Embedded Note", icon: "file-text", width: 4, height: 6 },
  "new-note": { label: "New Note", icon: "plus", width: 2, height: 2 },
  "new-task": { label: "New Task", icon: "check-square", width: 2, height: 2 },
  "command": { label: "Command", icon: "terminal", width: 2, height: 2 },
  "quick-switcher": { label: "Quick Switcher", icon: "search", width: 8, height: 1 },
  "iris-tasks-view": { label: "Tasks", icon: "list-checks", width: 4, height: 6 },
};

export const HIDDEN_VIEW_TYPES = new Set([
  VIEW_TYPE_HOMEPAGE,
  "empty",
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
