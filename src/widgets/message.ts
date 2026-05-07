import { App, Modal, Setting, setIcon } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

class MessagePromptModal extends Modal {
  private text: string;
  private onSubmit: (text: string) => void;

  constructor(app: App, text: string, onSubmit: (text: string) => void) {
    super(app);
    this.text = text;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Set message" });

    new Setting(contentEl).setName("Message").addTextArea((t) => {
      t.setPlaceholder("Type a message…").setValue(this.text).onChange((v) => (this.text = v));
      t.inputEl.rows = 4;
      t.inputEl.style.width = "100%";
    });

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Save").setCta().onClick(() => {
        this.onSubmit(this.text.trim());
        this.close();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class MessageWidget extends BaseWidget {
  private resizeOb: ResizeObserver | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    const configBtn = this.containerEl.createEl("button", {
      cls: "iris-hp-widget-configure clickable-icon",
      attr: { "aria-label": "Edit message" },
    });
    setIcon(configBtn, "pencil");
    configBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openPrompt();
    });

    this.render();
  }

  render(): void {
    this.clearBody();
    this.resizeOb?.disconnect();
    this.resizeOb = null;

    const text = (this.config.data?.message as string | undefined) ?? "";
    const wrapper = this.bodyEl.createDiv({ cls: "iris-hp-message" });

    if (!text) {
      wrapper.addClass("iris-hp-message-empty");
      wrapper.setText("No message set");
      return;
    }

    const textEl = wrapper.createDiv({ cls: "iris-hp-message-text" });
    textEl.setText(text);

    this.resizeOb = new ResizeObserver(() => this.fitText(wrapper, textEl));
    this.resizeOb.observe(wrapper);
  }

  private fitText(container: HTMLElement, textEl: HTMLElement): void {
    const maxH = container.clientHeight;
    if (!maxH) return;

    textEl.style.fontSize = "";
    const initial = parseFloat(getComputedStyle(textEl).fontSize);
    if (textEl.getBoundingClientRect().height <= maxH) return;

    let lo = 6, hi = initial;
    while (hi - lo > 0.5) {
      const mid = (lo + hi) / 2;
      textEl.style.fontSize = `${mid}px`;
      if (textEl.getBoundingClientRect().height > maxH) hi = mid;
      else lo = mid;
    }
    textEl.style.fontSize = `${lo}px`;
  }

  destroy(): void {
    this.resizeOb?.disconnect();
    super.destroy();
  }

  private openPrompt(): void {
    const current = (this.config.data?.message as string | undefined) ?? "";
    new MessagePromptModal(this.app, current, (text) => {
      if (!this.config.data) this.config.data = {};
      this.config.data.message = text;
      this.plugin.saveSettings();
      this.render();
    }).open();
  }
}
