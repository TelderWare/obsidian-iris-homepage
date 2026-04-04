import { App, TFile } from "obsidian";

export function buildHiddenFilter(app: App): (path: string) => boolean {
  const patterns: string[] = (app.vault as any).config?.userIgnoreFilters ?? [];
  if (patterns.length === 0) return () => false;
  const regexes = patterns.map((p) => { try { return new RegExp(p); } catch { return null; } }).filter(Boolean) as RegExp[];
  return (path: string) => regexes.some((re) => re.test(path));
}

export function getDisplayTitle(app: App, file: TFile): string {
  return app.metadataCache.getFileCache(file)?.frontmatter?.displayTitle ?? file.basename;
}
