import type { App } from "obsidian";
import type IrisHomepagePlugin from "./main";
import type { WidgetConfig } from "./types";
import { isBuiltinWidget } from "./types";
import { BaseWidget } from "./widgets/base-widget";
import { RecentNotesWidget } from "./widgets/recent-notes";
import { EmbeddedNoteWidget } from "./widgets/embedded-note";
import { NewNoteWidget } from "./widgets/new-note";
import { CommandWidget } from "./widgets/command";
import { QuickSwitcherWidget } from "./widgets/quick-switcher";
import { OpenUrlWidget } from "./widgets/open-url";
import { ViewEmbedWidget } from "./widgets/view-embed";
import { BaseFileWidget } from "./widgets/base-file";
import { WebSearchWidget } from "./widgets/web-search";
import { MessageWidget } from "./widgets/message";
import { AnalogClockWidget } from "./widgets/analog-clock";
import { RegisteredWidget } from "./widgets/registered-widget";

/**
 * Build the BaseWidget subclass that renders a given WidgetConfig.
 *
 * Resolution order:
 *   1. Built-in widget types (recent-notes, embedded-note, ...)
 *   2. Registered third-party widgets (other Iris plugins)
 *   3. ViewEmbedWidget if Obsidian has a view of this type
 *   4. RegisteredWidget with null registration → renders "unavailable" placeholder
 */
export function createWidget(
  app: App,
  wrapper: HTMLElement,
  config: WidgetConfig,
  plugin: IrisHomepagePlugin
): BaseWidget {
  if (isBuiltinWidget(config.type)) {
    switch (config.type) {
      case "recent-notes":
        return new RecentNotesWidget(app, wrapper, config, plugin);
      case "embedded-note":
        return new EmbeddedNoteWidget(app, wrapper, config, plugin);
      case "new-note":
        return new NewNoteWidget(app, wrapper, config, plugin);
      case "command":
        return new CommandWidget(app, wrapper, config, plugin);
      case "quick-switcher":
        return new QuickSwitcherWidget(app, wrapper, config, plugin);
      case "open-url":
        return new OpenUrlWidget(app, wrapper, config, plugin);
      case "base":
        return new BaseFileWidget(app, wrapper, config, plugin);
      case "web-search":
        return new WebSearchWidget(app, wrapper, config, plugin);
      case "message":
        return new MessageWidget(app, wrapper, config, plugin);
      case "analog-clock":
        return new AnalogClockWidget(app, wrapper, config, plugin);
    }
  }

  const registered = plugin.widgetRegistry.get(config.type);
  if (registered) {
    return new RegisteredWidget(app, wrapper, config, plugin, registered);
  }

  // Fall back to view-embed only if Obsidian has a view of this type; otherwise
  // show the "unavailable" placeholder so orphaned configs don't crash.
  const registry = (app as any).viewRegistry;
  const viewByType: Map<string, unknown> | undefined = registry?.viewByType instanceof Map
    ? registry.viewByType
    : registry?.viewByType
      ? new Map(Object.entries(registry.viewByType))
      : undefined;
  if (viewByType?.has(config.type)) {
    return new ViewEmbedWidget(app, wrapper, config, plugin);
  }
  return new RegisteredWidget(app, wrapper, config, plugin, null);
}
