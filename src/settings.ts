import { PluginSettingTab, App, Setting } from "obsidian";
import type IrisHomepagePlugin from "./main";
import type { Homepage } from "./types";
import { resolveWidgetLabel } from "./constants";
import { GridEngine } from "./grid-engine";
import { getWorkspacesPlugin, getAllWorkspaceNames } from "./workspace-binder";

export class IrisHomepageSettingsTab extends PluginSettingTab {
  private plugin: IrisHomepagePlugin;
  private selectedWorkspaceName: string | null = null;

  constructor(app: App, plugin: IrisHomepagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** All workspace names worth showing: live workspaces ∪ stored configs ∪ active. */
  private listKnownWorkspaces(): string[] {
    const set = new Set<string>(getAllWorkspaceNames(this.app));
    for (const name of Object.keys(this.plugin.settings.homepages)) set.add(name);
    set.add(this.plugin.getCurrentWorkspaceName());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  private getSelectedHomepage(): Homepage {
    const known = this.listKnownWorkspaces();
    if (this.selectedWorkspaceName && known.includes(this.selectedWorkspaceName)) {
      return this.plugin.getHomepage(this.selectedWorkspaceName);
    }
    const fallback = this.plugin.getCurrentWorkspaceName();
    this.selectedWorkspaceName = fallback;
    return this.plugin.getHomepage(fallback);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.renderGlobalSection(containerEl);
    this.renderHomepagesSection(containerEl);
    this.renderSelectedHomepageSection(containerEl);
  }

  private renderGlobalSection(containerEl: HTMLElement): void {
    containerEl.createEl("h2", { text: "General" });

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Show the default homepage when Obsidian starts")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (val) => {
          this.plugin.settings.openOnStartup = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Replace new tabs")
      .setDesc("Open the default homepage instead of an empty new tab")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.replaceNewTab).onChange(async (val) => {
          this.plugin.settings.replaceNewTab = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Borderless widgets")
      .setDesc("Remove borders and backgrounds from widget cards on every homepage")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.borderless).onChange(async (val) => {
          this.plugin.settings.borderless = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (!this.plugin.settings.borderless) {
      new Setting(containerEl)
        .setName("Border width")
        .setDesc("Widget border thickness in pixels")
        .addSlider((slider) =>
          slider
            .setLimits(0, 4, 1)
            .setValue(this.plugin.settings.borderWidth)
            .setDynamicTooltip()
            .onChange(async (val) => {
              this.plugin.settings.borderWidth = val;
              await this.plugin.saveSettings();
            })
        );
    }
  }

  private renderHomepagesSection(containerEl: HTMLElement): void {
    containerEl.createEl("h2", { text: "Homepages" });

    const wsEnabled = !!getWorkspacesPlugin(this.app);
    if (!wsEnabled) {
      const notice = containerEl.createDiv({ cls: "setting-item-description" });
      notice.setText(
        "Homepages follow Obsidian's core Workspaces plugin. Enable Settings → Core plugins → Workspaces to manage multiple homepages.",
      );
    } else {
      const notice = containerEl.createDiv({ cls: "setting-item-description" });
      notice.setText(
        "Each saved workspace gets its own homepage layout. Add or remove homepages by adding or removing workspaces in the core Workspaces plugin.",
      );
    }

    const selected = this.getSelectedHomepage();
    const known = this.listKnownWorkspaces();

    new Setting(containerEl)
      .setName("Edit homepage for workspace")
      .setDesc("Pick which workspace's homepage layout to configure below")
      .addDropdown((drop) => {
        for (const name of known) {
          drop.addOption(name, name);
        }
        drop.setValue(selected.workspaceName);
        drop.onChange((val) => {
          this.selectedWorkspaceName = val;
          this.display();
        });
      });

    const currentName = this.plugin.getCurrentWorkspaceName();
    for (const name of known) {
      const cfg = this.plugin.settings.homepages[name];
      const isCurrent = name === currentName;
      new Setting(containerEl)
        .setName(name + (isCurrent ? " (active)" : ""))
        .setDesc(
          cfg
            ? `${cfg.widgets.length} widget${cfg.widgets.length === 1 ? "" : "s"}`
            : "No layout yet — will be created on first visit",
        );
    }
  }

  private renderSelectedHomepageSection(containerEl: HTMLElement): void {
    const hp = this.getSelectedHomepage();
    containerEl.createEl("h2", { text: `"${hp.workspaceName}" layout` });

    new Setting(containerEl)
      .setName("Grid columns")
      .setDesc("Number of columns in the widget grid (4-32)")
      .addDropdown((drop) => {
        for (let i = 4; i <= 32; i++) {
          drop.addOption(String(i), String(i));
        }
        drop.setValue(String(hp.columns));
        drop.onChange(async (val) => {
          hp.columns = parseInt(val, 10);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Grid rows")
      .setDesc("Number of rows in the widget grid (0 = auto-grow)")
      .addDropdown((drop) => {
        const engine = new GridEngine(hp.columns, hp.rows);
        const currentRows = hp.widgets.length > 0
          ? engine.getMaxRow(hp.widgets) + 1
          : 0;
        drop.addOption("0", `Auto (${currentRows})`);
        for (let i = 2; i <= 24; i++) {
          drop.addOption(String(i), String(i));
        }
        drop.setValue(String(hp.rows));
        drop.onChange(async (val) => {
          hp.rows = parseInt(val, 10);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Grid gap")
      .setDesc("Spacing between widgets in pixels (0-32)")
      .addSlider((slider) =>
        slider
          .setLimits(0, 32, 2)
          .setValue(hp.gridGap)
          .setDynamicTooltip()
          .onChange(async (val) => {
            hp.gridGap = val;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "Widgets" });

    for (let i = 0; i < hp.widgets.length; i++) {
      const config = hp.widgets[i];
      const label = resolveWidgetLabel(config.type);

      new Setting(containerEl)
        .setName(label)
        .setDesc(`Position: col ${config.col + 1}, row ${config.row + 1} | Size: ${config.width}x${config.height}`)
        .addButton((btn) =>
          btn
            .setButtonText("Remove")
            .setWarning()
            .onClick(async () => {
              hp.widgets.splice(i, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );

      if (config.type === "command" && config.commandId) {
        const cmd = (this.app as any).commands?.commands?.[config.commandId];
        new Setting(containerEl)
          .setClass("iris-hp-setting-indent")
          .setName("Command")
          .setDesc(cmd?.name ?? config.commandId);
      }

      if (config.type === "embedded-note") {
        new Setting(containerEl)
          .setClass("iris-hp-setting-indent")
          .setName("Note path")
          .setDesc("Path to the note to embed")
          .addText((text) =>
            text
              .setPlaceholder("path/to/note.md")
              .setValue(config.notePath ?? "")
              .onChange(async (val) => {
                config.notePath = val.trim();
                await this.plugin.saveSettings();
              })
          );
      }
    }
  }
}
