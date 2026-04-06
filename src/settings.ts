import { PluginSettingTab, App, Setting } from "obsidian";
import type IrisHomepagePlugin from "./main";
import { resolveWidgetLabel } from "./constants";
import { getApiKey, setApiKey } from "./utils";

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
          drop.addOption(String(i * 2), String(i));
        }
        drop.setValue(String(this.plugin.settings.columns));
        drop.onChange(async (val) => {
          this.plugin.settings.columns = parseInt(val, 10);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Grid rows")
      .setDesc("Number of rows in the widget grid (0 = auto-grow)")
      .addDropdown((drop) => {
        drop.addOption("0", "Auto");
        for (let i = 2; i <= 24; i++) {
          drop.addOption(String(i), String(i));
        }
        drop.setValue(String(this.plugin.settings.rows));
        drop.onChange(async (val) => {
          this.plugin.settings.rows = parseInt(val, 10);
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
      .setName("Borderless widgets")
      .setDesc("Remove borders and backgrounds from widget cards")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.borderless).onChange(async (val) => {
          this.plugin.settings.borderless = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Task folder")
      .setDesc("Folder where new tasks are created")
      .addText((text) =>
        text
          .setPlaceholder("Tasks")
          .setValue(this.plugin.settings.taskFolder)
          .onChange(async (val) => {
            this.plugin.settings.taskFolder = val.trim() || "Tasks";
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h2", { text: "AI" });

    const apiKeySetting = new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Used as a fallback for natural language date parsing when chrono-node can't interpret the input");

    const existingKey = getApiKey(this.app);

    apiKeySetting.addText((text) => {
      text
        .setPlaceholder(existingKey ? "••••••••" : "sk-ant-…")
        .onChange(() => {});
      const inputEl = text.inputEl;
      inputEl.type = "password";
      inputEl.style.width = "220px";

      apiKeySetting.addButton((btn) =>
        btn.setButtonText("Save").onClick(async () => {
          const val = inputEl.value.trim();
          if (val) {
            setApiKey(this.app, val);
            inputEl.value = "";
            inputEl.placeholder = "••••••••";
          }
        })
      );

      if (existingKey) {
        apiKeySetting.addButton((btn) =>
          btn.setButtonText("Clear").setWarning().onClick(async () => {
            setApiKey(this.app, "");
            inputEl.placeholder = "sk-ant-…";
            inputEl.value = "";
          })
        );
      }
    });

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
