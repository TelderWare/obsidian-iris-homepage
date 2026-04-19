import { App, Modal, Setting, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { IconSuggestModal } from "../icon-picker";

class UrlPromptModal extends Modal {
  private url: string;
  private label: string;
  private icon: string;
  private onSubmit: (url: string, label: string, icon: string) => void;

  constructor(app: App, url: string, label: string, icon: string, onSubmit: (url: string, label: string, icon: string) => void) {
    super(app);
    this.url = url;
    this.label = label;
    this.icon = icon;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Open URL" });

    new Setting(contentEl).setName("URL").addText((t) =>
      t.setPlaceholder("https://example.com").setValue(this.url).onChange((v) => (this.url = v))
    );

    new Setting(contentEl).setName("Label").addText((t) =>
      t.setPlaceholder("Optional").setValue(this.label).onChange((v) => (this.label = v))
    );

    const iconSetting = new Setting(contentEl).setName("Icon");
    const iconPreview = iconSetting.controlEl.createDiv({ cls: "iris-hp-icon-preview" });
    const refreshPreview = () => {
      iconPreview.empty();
      setIcon(iconPreview, this.icon || "link");
    };
    refreshPreview();
    iconSetting.addButton((b) =>
      b.setButtonText("Pick icon").onClick(() => {
        new IconSuggestModal(this.app, (icon) => {
          this.icon = icon;
          refreshPreview();
        }).open();
      })
    );

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Save").setCta().onClick(() => {
        this.onSubmit(this.url.trim(), this.label.trim(), this.icon);
        this.close();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class OpenUrlWidget extends BaseWidget {
  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    const configBtn = this.containerEl.createEl("button", {
      cls: "iris-hp-widget-configure clickable-icon",
      attr: { "aria-label": "Set URL" },
    });
    setIcon(configBtn, "link");
    configBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openPrompt();
    });

    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    if (!this.config.url) {
      const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-command" });
      const icon = placeholder.createDiv({ cls: "iris-hp-command-icon" });
      setIcon(icon, "link");
      placeholder.createDiv({ cls: "iris-hp-command-label", text: "No URL set" });
      return;
    }

    const label = this.config.urlLabel || this.config.url;

    const btn = this.bodyEl.createDiv({
      cls: "iris-hp-command",
      attr: { "aria-label": label },
    });

    const icon = btn.createDiv({ cls: "iris-hp-command-icon" });
    setIcon(icon, this.config.icon ?? "link");

    btn.createDiv({ cls: "iris-hp-command-label", text: label });

    btn.addEventListener("click", () => {
      window.open(this.config.url, "_blank");
    });
  }

  private openPrompt(): void {
    new UrlPromptModal(this.app, this.config.url ?? "", this.config.urlLabel ?? "", this.config.icon ?? "", (url, label, icon) => {
      this.config.url = url;
      this.config.urlLabel = label;
      this.config.icon = icon || undefined;
      this.plugin.saveSettings();
      this.render();
    }).open();
  }
}
