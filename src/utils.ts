import { App, TFile } from "obsidian";

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
