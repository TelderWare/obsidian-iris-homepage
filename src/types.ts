export const BUILTIN_WIDGET_TYPES = ["recent-notes", "embedded-note"] as const;
export type BuiltinWidgetType = (typeof BUILTIN_WIDGET_TYPES)[number];

export interface WidgetConfig {
  id: string;
  type: string;
  col: number;
  row: number;
  width: number;
  height: number;
  // recent-notes
  maxItems?: number;
  sortBy?: "opened" | "modified";
  // embedded-note
  notePath?: string;
  // view embeds
  viewState?: Record<string, unknown>;
}

export interface IrisHomepageSettings {
  columns: number;
  widgets: WidgetConfig[];
  openOnStartup: boolean;
  replaceNewTab: boolean;
  showGreeting: boolean;
  greetingName: string;
}

export function isBuiltinWidget(type: string): type is BuiltinWidgetType {
  return (BUILTIN_WIDGET_TYPES as readonly string[]).includes(type);
}
