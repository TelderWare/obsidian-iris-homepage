import { App, EventRef, TFile, TFolder } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";
import { TASK_FOLDER, getDisplayTitle } from "../utils";

interface TaskEntry {
  file: TFile;
  title: string;
  closes: string | null;
}

export class TaskListWidget extends BaseWidget {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventRefs: EventRef[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private lastHeight = 0;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);

    const scheduleRender = (file?: TFile | { path: string }) => {
      if (file && !file.path.startsWith(TASK_FOLDER + "/")) return;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.render(), 500);
    };

    this.eventRefs.push(
      this.app.vault.on("create", (f) => scheduleRender(f)),
      this.app.vault.on("delete", (f) => scheduleRender(f)),
      this.app.vault.on("modify", (f) => scheduleRender(f)),
      this.app.vault.on("rename", (f) => scheduleRender(f)),
    );

    this.resizeObserver = new ResizeObserver(() => {
      const h = this.bodyEl.clientHeight;
      if (Math.abs(h - this.lastHeight) < 4) return;
      this.lastHeight = h;
      this.render();
    });
    this.resizeObserver.observe(this.bodyEl);

    this.render();
  }

  render(): void {
    this.bodyEl.empty();

    const tasks = this.getTasks();

    const itemHeight = 32;
    const available = this.bodyEl.clientHeight || 200;
    const max = Math.max(1, Math.floor(available / itemHeight));
    const displayed = tasks.slice(0, max);

    if (displayed.length === 0) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "No tasks" });
      return;
    }

    const listEl = this.bodyEl.createEl("ul", { cls: "iris-hp-task-list" });

    for (const { file, title } of displayed) {
      const li = listEl.createEl("li", { cls: "iris-hp-task-item" });
      li.createSpan({ cls: "iris-hp-task-name", text: title });

      li.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }

  private getTasks(): TaskEntry[] {
    const folder = this.app.vault.getAbstractFileByPath(TASK_FOLDER);
    if (!folder || !(folder instanceof TFolder)) return [];

    const tasks: TaskEntry[] = [];

    for (const child of folder.children) {
      if (!(child instanceof TFile) || child.extension !== "md") continue;
      const fm = this.app.metadataCache.getFileCache(child)?.frontmatter;
      if (fm?.status === "completed") continue;
      tasks.push({
        file: child,
        title: getDisplayTitle(this.app, child),
        closes: fm?.closes ?? null,
      });
    }

    tasks.sort((a, b) => {
      if (a.closes && b.closes) return a.closes.localeCompare(b.closes);
      if (a.closes) return -1;
      if (b.closes) return 1;
      return 0;
    });

    return tasks;
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const ref of this.eventRefs) {
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
    super.destroy();
  }
}
