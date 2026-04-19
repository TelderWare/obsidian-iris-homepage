import { App, FuzzyMatch, FuzzySuggestModal, getIconIds, setIcon } from "obsidian";

export class IconSuggestModal extends FuzzySuggestModal<string> {
  private icons: string[];
  private onChoose: (icon: string) => void;

  constructor(app: App, onChoose: (icon: string) => void) {
    super(app);
    this.icons = getIconIds();
    this.onChoose = onChoose;
    this.setPlaceholder("Pick an icon…");
  }

  getItems(): string[] {
    return this.icons;
  }

  getItemText(item: string): string {
    return item;
  }

  renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
    super.renderSuggestion(item, el);
    const iconEl = el.createSpan({ cls: "iris-hp-icon-suggest-icon" });
    setIcon(iconEl, item.item);
  }

  onChooseItem(item: string): void {
    this.onChoose(item);
  }
}
