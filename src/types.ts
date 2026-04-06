export const BUILTIN_WIDGET_TYPES = ["recent-notes", "embedded-note", "new-note", "new-task", "command", "quick-switcher", "iris-tasks-view"] as const;
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
  // command
  commandId?: string;
  // view embeds
  viewState?: Record<string, unknown>;
}

export interface IrisHomepageSettings {
  columns: number;
  widgets: WidgetConfig[];
  openOnStartup: boolean;
  replaceNewTab: boolean;
  borderless: boolean;
  taskFolder: string;
  gridVersion?: number;
}

export function isBuiltinWidget(type: string): type is BuiltinWidgetType {
  return (BUILTIN_WIDGET_TYPES as readonly string[]).includes(type);
}
