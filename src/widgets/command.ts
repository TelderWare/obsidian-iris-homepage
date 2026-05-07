import { App, FuzzySuggestModal, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { IconSuggestModal } from "../icon-picker";

interface ObsidianCommand {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Obsidian commands follow a "<Plugin name>: <Command name>" convention.
 * On the homepage the source plugin is noise — the user picked the command
 * once and the icon already conveys identity. Strip the prefix so the tile
 * just reads "Manage workspaces" instead of "Workspaces: Manage workspaces".
 *
 * Only the *first* ": " is treated as the separator so commands whose own
 * name contains a colon (rare but possible) survive intact.
 */
function stripCommandPrefix(name: string): string {
  const idx = name.indexOf(": ");
  return idx === -1 ? name : name.slice(idx + 2);
}

class CommandSuggestModal extends FuzzySuggestModal<ObsidianCommand> {
  private commands: ObsidianCommand[];
  private onChoose: (cmd: ObsidianCommand) => void;

  constructor(app: App, commands: ObsidianCommand[], onChoose: (cmd: ObsidianCommand) => void) {
    super(app);
    this.commands = commands;
    this.onChoose = onChoose;
  }

  getItems(): ObsidianCommand[] {
    return this.commands;
  }

  getItemText(item: ObsidianCommand): string {
    return item.name;
  }

  onChooseItem(item: ObsidianCommand): void {
    this.onChoose(item);
  }
}

export class CommandWidget extends BaseWidget {
  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    const configBtn = this.containerEl.createEl("button", {
      cls: "iris-hp-widget-configure clickable-icon",
      attr: { "aria-label": "Set command" },
    });
    setIcon(configBtn, "terminal");
    configBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openCommandPicker();
    });

    const iconBtn = this.containerEl.createEl("button", {
      cls: "iris-hp-widget-configure iris-hp-widget-configure-icon clickable-icon",
      attr: { "aria-label": "Set icon" },
    });
    setIcon(iconBtn, "image");
    iconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new IconSuggestModal(this.app, (icon) => {
        this.config.icon = icon;
        this.plugin.saveSettings();
        this.render();
      }).open();
    });

    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    if (!this.config.commandId) {
      const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-command" });
      const icon = placeholder.createDiv({ cls: "iris-hp-command-icon" });
      setIcon(icon, "terminal");
      placeholder.createDiv({ cls: "iris-hp-command-label", text: "No command set" });
      return;
    }

    const cmd = this.getCommand(this.config.commandId);
    const label = stripCommandPrefix(cmd?.name ?? this.config.commandId);

    // A meaningful icon (user-chosen override or one supplied by the
    // command itself) carries the identity on its own — adding the text
    // label is redundant. Only show the label when we'd otherwise be
    // falling back to the generic "terminal" placeholder.
    const hasMeaningfulIcon = !!(this.config.icon ?? cmd?.icon);

    const btn = this.bodyEl.createDiv({
      cls: "iris-hp-command",
      attr: { "aria-label": label },
    });

    const icon = btn.createDiv({ cls: "iris-hp-command-icon" });
    setIcon(icon, this.config.icon ?? cmd?.icon ?? "terminal");

    if (!hasMeaningfulIcon) {
      btn.createDiv({ cls: "iris-hp-command-label", text: label });
    }

    btn.addEventListener("click", () => {
      (this.app as any).commands.executeCommandById(this.config.commandId);
    });
  }

  private openCommandPicker(): void {
    const commands = this.getAllCommands();
    new CommandSuggestModal(this.app, commands, (cmd) => {
      this.config.commandId = cmd.id;
      this.plugin.saveSettings();
      this.render();
    }).open();
  }

  private getAllCommands(): ObsidianCommand[] {
    const cmds = (this.app as any).commands?.commands;
    if (!cmds) return [];
    return Object.values(cmds) as ObsidianCommand[];
  }

  private getCommand(id: string): ObsidianCommand | undefined {
    const cmds = (this.app as any).commands?.commands;
    return cmds?.[id] as ObsidianCommand | undefined;
  }
}
