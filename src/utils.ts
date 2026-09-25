import { App, TFile, View, WorkspaceLeaf, getIcon } from "obsidian";
import { VIEW_TYPE_ICON_MAP } from "./constants";

export function buildHiddenFilter(app: App): (path: string) => boolean {
  const patterns: string[] = (app.vault as any).config?.userIgnoreFilters ?? [];
  const regexes = patterns.map((p) => { try { return new RegExp(p); } catch { return null; } }).filter(Boolean) as RegExp[];
  const isUserIgnored: ((path: string) => boolean) | undefined =
    (app.metadataCache as any).isUserIgnored?.bind(app.metadataCache);
  return (path: string) => {
    // Dot-prefixed path segments are hidden by Obsidian/the OS.
    if (path.split("/").some((seg) => seg.startsWith("."))) return true;
    if (isUserIgnored && isUserIgnored(path)) return true;
    return regexes.some((re) => re.test(path));
  };
}

export function getDisplayTitle(app: App, file: TFile): string {
  return app.metadataCache.getFileCache(file)?.frontmatter?.displayTitle ?? file.basename;
}

export function isInternalPluginEnabled(app: App, id: string): boolean {
  const plugins = (app as unknown as {
    internalPlugins?: { plugins?: Record<string, { enabled?: boolean }> };
  }).internalPlugins?.plugins;
  return plugins?.[id]?.enabled === true;
}

const viewIconCache = new Map<string, string>();

/**
 * Icon for an Obsidian view type. Core views use the static map; plugin views
 * report their own icon via View.getIcon(), read from an open leaf of that
 * type if there is one, otherwise from a throwaway instance built with the
 * registered view factory (never loaded or attached). Falls back to "box".
 */
export function resolveViewIcon(app: App, viewType: string): string {
  const known = VIEW_TYPE_ICON_MAP[viewType];
  if (known) return known;
  const cached = viewIconCache.get(viewType);
  if (cached) return cached;

  let icon: string | undefined;
  try {
    icon = app.workspace.getLeavesOfType(viewType)[0]?.view.getIcon();
  } catch { /* ignore */ }

  if (!icon) {
    try {
      const registry = (app as any).viewRegistry;
      const factory: ((leaf: WorkspaceLeaf) => View) | undefined =
        registry?.viewByType instanceof Map ? registry.viewByType.get(viewType) : registry?.viewByType?.[viewType];
      if (typeof factory === "function") {
        const leaf = new (WorkspaceLeaf as any)(app) as WorkspaceLeaf;
        icon = factory(leaf).getIcon();
      }
    } catch { /* plugin view constructors may assume a live leaf */ }
  }

  if (!icon || !getIcon(icon)) return "box";
  // Only cache hits, so a type that failed to probe can still pick up its
  // icon later from an open leaf.
  viewIconCache.set(viewType, icon);
  return icon;
}
