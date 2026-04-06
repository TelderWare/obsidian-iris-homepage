import { App, Notice, setIcon } from "obsidian";
import * as chrono from "chrono-node";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { formatDate, getApiKey } from "../utils";

export class CreateTaskWidget extends BaseWidget {
  private popover: HTMLElement | null = null;
  private onDocClick = (e: MouseEvent) => this.handleOutsideClick(e);

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    const btn = this.bodyEl.createDiv({ cls: "iris-hp-create-task" });

    const icon = btn.createDiv({ cls: "iris-hp-create-task-icon" });
    setIcon(icon, "check-square");

    btn.createDiv({ cls: "iris-hp-create-task-label", text: "New task" });

    btn.addEventListener("click", () => this.togglePopover());
  }

  private togglePopover(): void {
    if (this.popover) {
      this.closePopover();
      return;
    }
    this.openPopover();
  }

  private openPopover(): void {
    const pop = this.containerEl.createDiv({ cls: "iris-hp-task-popover" });
    this.popover = pop;

    const titleInput = this.addField(pop, "", "Task name…");
    const dueInput = this.addField(pop, "Due", "tomorrow 3pm, next Friday…");

    const btn = pop.createEl("button", { cls: "iris-hp-task-submit", text: "Create" });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submit(titleInput, dueInput);
    });

    pop.addEventListener("mousedown", (e) => e.stopPropagation());
    pop.addEventListener("click", (e) => e.stopPropagation());

    // Flip popover upward if it would overflow the viewport
    requestAnimationFrame(() => {
      const popRect = pop.getBoundingClientRect();
      if (popRect.bottom > window.innerHeight) {
        pop.addClass("iris-hp-task-popover-above");
      }
    });

    setTimeout(() => document.addEventListener("click", this.onDocClick), 0);
    titleInput.focus();
  }

  private addField(parent: HTMLElement, label: string, placeholder: string): HTMLInputElement {
    const row = parent.createDiv({ cls: "iris-hp-task-field" });
    if (label) row.createEl("label", { text: label });
    const input = row.createEl("input", { type: "text" });
    if (placeholder) input.placeholder = placeholder;
    return input;
  }

  private async submit(
    titleInput: HTMLInputElement,
    dueInput: HTMLInputElement,
  ): Promise<void> {
    const title = titleInput.value.trim();
    if (!title) { new Notice("Task title is required"); return; }

    const lines = ["---"];
    const raw = dueInput.value.trim();
    if (raw) {
      const due = await this.parseDate(raw);
      if (!due) { new Notice("Couldn't understand that date"); return; }
      lines.push(`closes: ${due.date}`);
      if (due.time) lines.push(`closeTime: "${due.time}"`);
    }
    lines.push(`displayTitle: "${title}"`);
    lines.push("status: ", "---", "");

    await this.ensureFolder();

    const safeName = title.replace(/[\\/:*?"<>|]/g, "_");
    let path = `${this.plugin.settings.taskFolder}/${safeName}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      let i = 1;
      while (this.app.vault.getAbstractFileByPath(`${this.plugin.settings.taskFolder}/${safeName} ${i}.md`)) i++;
      path = `${this.plugin.settings.taskFolder}/${safeName} ${i}.md`;
    }

    await this.app.vault.create(path, lines.join("\n"));
    new Notice(`Task "${title}" created`);
    this.closePopover();
  }

  private closePopover(): void {
    document.removeEventListener("click", this.onDocClick);
    if (this.popover) {
      this.popover.remove();
      this.popover = null;
    }
  }

  private handleOutsideClick(e: MouseEvent): void {
    if (this.popover && !this.popover.contains(e.target as Node)) {
      this.closePopover();
    }
  }

  private async parseDate(input: string): Promise<{ date: string; time: string | null } | null> {
    const lower = input.toLowerCase();
    if (lower === "asap") return { date: "ASAP", time: null };
    if (lower === "eventually") return { date: "Eventually", time: null };

    const results = chrono.parse(input);
    if (results.length > 0) {
      const start = results[0].start;
      const parsed = start.date();
      let time: string | null = null;
      if (start.isCertain("hour")) {
        const hh = String(parsed.getHours()).padStart(2, "0");
        const mm = String(parsed.getMinutes()).padStart(2, "0");
        time = `${hh}:${mm}`;
      }
      return { date: formatDate(parsed), time };
    }

    // Fallback to Claude API (via Iris Relay when available)
    const relay = (this.app as any).irisRelay;
    const apiKey = getApiKey(this.app);
    if (!relay && !apiKey) return null;

    try {
      const todayStr = formatDate(new Date());
      const requestBody = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{
          role: "user",
          content: `Today is ${todayStr}. Parse this into a date and optional time. Return ONLY valid JSON: {"date":"YYYY-MM-DD","time":"HH:mm"} or {"date":"YYYY-MM-DD","time":null}. If the input conveys immediate urgency, return {"date":"Immediately","time":null}. If the input conveys low priority or no rush, return {"date":"Eventually","time":null}. Input: "${input}"`,
        }],
      };

      let text: string;
      if (relay) {
        const json = await relay.request(requestBody, 1, true);
        text = json?.content?.[0]?.text ?? "";
      } else {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey!,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) return null;
        const body = await res.json();
        text = body?.content?.[0]?.text ?? "";
      }

      const match = text.match(/\{[^}]+\}/);
      if (!match) return null;
      const obj = JSON.parse(match[0]);
      if (!obj.date || (!/^\d{4}-\d{2}-\d{2}$/.test(obj.date) && obj.date !== "Immediately" && obj.date !== "Eventually")) return null;
      return { date: obj.date, time: obj.time || null };
    } catch {
      return null;
    }
  }

  private async ensureFolder(): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(this.plugin.settings.taskFolder)) {
      await this.app.vault.createFolder(this.plugin.settings.taskFolder);
    }
  }

  destroy(): void {
    this.closePopover();
    super.destroy();
  }
}
