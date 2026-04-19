import { App, MarkdownRenderer, TFile, FuzzySuggestModal, EventRef } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

class NoteSuggestModal extends FuzzySuggestModal<TFile> {
  private files: TFile[];
  private onChoose: (file: TFile) => void;

  constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}

export class EmbeddedNoteWidget extends BaseWidget {
  private modifyRef: EventRef | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    if (this.config.notePath) {
      this.modifyRef = this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === this.config.notePath) {
          this.render();
        }
      });
    }

    this.render();
  }

  render(): void {
    this.clearBody();

    if (!this.config.notePath) {
      this.renderPicker();
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(this.config.notePath);
    if (!(file instanceof TFile)) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "Note not found" });
      return;
    }

    const contentEl = this.bodyEl.createDiv({ cls: "iris-hp-embedded-content" });

    this.app.vault.cachedRead(file).then((content) => {
      MarkdownRenderer.render(this.app, content, contentEl, file.path, this.plugin);
    });
  }

  private renderPicker(): void {
    const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-embedded-picker" });
    placeholder.createDiv({ cls: "iris-hp-empty", text: "No note selected" });

    const chooseBtn = placeholder.createEl("button", {
      cls: "iris-hp-embedded-choose",
      text: "Choose note",
    });

    chooseBtn.addEventListener("click", () => {
      const files = this.app.vault.getMarkdownFiles();
      new NoteSuggestModal(this.app, files, (file) => {
        this.config.notePath = file.path;
        this.plugin.saveSettings();
      }).open();
    });
  }

  destroy(): void {
    if (this.modifyRef) {
      this.app.vault.offref(this.modifyRef);
      this.modifyRef = null;
    }
    super.destroy();
  }
}
