import { App, TFile } from "obsidian";

export const SECRET_KEY_ANTHROPIC = "anthropic-api-key";

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getApiKey(app: App): string {
  return (app as any).vault?.secretStorage?.getSecret?.(SECRET_KEY_ANTHROPIC) ?? "";
}

export function setApiKey(app: App, value: string): void {
  (app as any).vault.secretStorage.setSecret(SECRET_KEY_ANTHROPIC, value);
}

export function buildHiddenFilter(app: App): (path: string) => boolean {
  const patterns: string[] = (app.vault as any).config?.userIgnoreFilters ?? [];
  if (patterns.length === 0) return () => false;
  const regexes = patterns.map((p) => { try { return new RegExp(p); } catch { return null; } }).filter(Boolean) as RegExp[];
  return (path: string) => regexes.some((re) => re.test(path));
}

export function getDisplayTitle(app: App, file: TFile): string {
  return app.metadataCache.getFileCache(file)?.frontmatter?.displayTitle ?? file.basename;
}
