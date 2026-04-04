import { PluginSettingTab, App, Setting } from "obsidian";
import type IrisHomepagePlugin from "./main";
import { resolveWidgetLabel } from "./constants";

export class IrisHomepageSettingsTab extends PluginSettingTab {
  private plugin: IrisHomepagePlugin;

  constructor(app: App, plugin: IrisHomepagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "General" });

    new Setting(containerEl)
      .setName("Grid columns")
      .setDesc("Number of columns in the widget grid (2-16)")
      .addDropdown((drop) => {
        for (let i = 2; i <= 16; i++) {
          drop.addOption(String(i), String(i));
        }
        drop.setValue(String(this.plugin.settings.columns));
        drop.onChange(async (val) => {
          this.plugin.settings.columns = parseInt(val, 10);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Show the homepage when Obsidian starts")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (val) => {
          this.plugin.settings.openOnStartup = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Replace new tabs")
      .setDesc("Open the homepage instead of an empty new tab")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.replaceNewTab).onChange(async (val) => {
          this.plugin.settings.replaceNewTab = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Show greeting")
      .setDesc("Display a time-based greeting at the top")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showGreeting).onChange(async (val) => {
          this.plugin.settings.showGreeting = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.showGreeting) {
      new Setting(containerEl)
        .setName("Greeting name")
        .setDesc("Name to use in the greeting (leave empty for no name)")
        .addText((text) =>
          text
            .setPlaceholder("Your name")
            .setValue(this.plugin.settings.greetingName)
            .onChange(async (val) => {
              this.plugin.settings.greetingName = val.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    containerEl.createEl("h2", { text: "Widgets" });

    for (let i = 0; i < this.plugin.settings.widgets.length; i++) {
      const config = this.plugin.settings.widgets[i];
      const label = resolveWidgetLabel(config.type);

      new Setting(containerEl)
        .setName(label)
        .setDesc(`Position: col ${config.col + 1}, row ${config.row + 1} | Size: ${config.width}x${config.height}`)
        .addButton((btn) =>
          btn
            .setButtonText("Remove")
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.widgets.splice(i, 1);
              await this.plugin.saveSettings();
              this.display();
            })
        );

      if (config.type === "recent-notes") {
        new Setting(containerEl)
          .setClass("iris-hp-setting-indent")
          .setName("Max items")
          .addText((text) =>
            text.setValue(String(config.maxItems ?? 10)).onChange(async (val) => {
              const num = parseInt(val, 10);
              if (!isNaN(num) && num > 0) {
                config.maxItems = num;
                await this.plugin.saveSettings();
              }
            })
          );

        new Setting(containerEl)
          .setClass("iris-hp-setting-indent")
          .setName("Sort by")
          .addDropdown((drop) => {
            drop.addOption("modified", "Last modified");
            drop.addOption("opened", "Last opened");
            drop.setValue(config.sortBy ?? "modified");
            drop.onChange(async (val) => {
              config.sortBy = val as "modified" | "opened";
              await this.plugin.saveSettings();
            });
          });
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
