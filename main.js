var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => IrisHomepagePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian11 = require("obsidian");

// src/constants.ts
var VIEW_TYPE_HOMEPAGE = "iris-homepage-view";
var ROW_HEIGHT = 60;
var GRID_GAP = 12;
var DEFAULT_SETTINGS = {
  columns: 8,
  widgets: [
    {
      id: "default-recent",
      type: "recent-notes",
      col: 0,
      row: 0,
      width: 4,
      height: 4
    }
  ],
  openOnStartup: true,
  replaceNewTab: true,
  borderless: false
};
var BUILTIN_WIDGETS = {
  "recent-notes": { label: "Recent Notes", icon: "clock", width: 4, height: 4 },
  "embedded-note": { label: "Embedded Note", icon: "file-text", width: 4, height: 6 },
  "new-note": { label: "New Note", icon: "plus", width: 2, height: 2 },
  "create-task": { label: "Create Task", icon: "check-square", width: 2, height: 2 },
  "command": { label: "Command", icon: "terminal", width: 2, height: 2 },
  "quick-switcher": { label: "Quick Switcher", icon: "search", width: 8, height: 1 },
  "iris-tasks-view": { label: "Tasks", icon: "list-checks", width: 4, height: 6 }
};
var HIDDEN_VIEW_TYPES = /* @__PURE__ */ new Set([
  VIEW_TYPE_HOMEPAGE,
  "empty"
]);
var CORE_VIEW_TYPES = /* @__PURE__ */ new Set([
  "markdown",
  "canvas",
  "graph",
  "localgraph",
  "file-explorer",
  "search",
  "tag",
  "backlink",
  "outgoing-link",
  "outline",
  "bookmarks",
  "all-properties",
  "file-properties",
  "audio",
  "image",
  "pdf",
  "video",
  "release-notes"
]);
var VIEW_TYPE_ICON_MAP = {
  "file-explorer": "folder",
  "search": "search",
  "graph": "git-fork",
  "localgraph": "git-fork",
  "backlink": "links-coming-in",
  "outgoing-link": "links-going-out",
  "tag": "tag",
  "outline": "list",
  "bookmarks": "bookmark",
  "canvas": "layout-dashboard",
  "markdown": "file-text",
  "all-properties": "list-tree",
  "file-properties": "list-tree",
  "audio": "headphones",
  "image": "image",
  "pdf": "file-text",
  "video": "play-circle",
  "release-notes": "info"
};
function humanizeViewType(type) {
  return type.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function resolveWidgetLabel(type) {
  if (type in BUILTIN_WIDGETS) {
    return BUILTIN_WIDGETS[type].label;
  }
  return humanizeViewType(type);
}

// src/homepage-view.ts
var import_obsidian9 = require("obsidian");

// src/types.ts
var BUILTIN_WIDGET_TYPES = ["recent-notes", "embedded-note", "new-note", "create-task", "command", "quick-switcher", "iris-tasks-view"];
function isBuiltinWidget(type) {
  return BUILTIN_WIDGET_TYPES.includes(type);
}

// src/grid-engine.ts
var MAX_COLS = 32;
function cellKey(row, col) {
  return row * MAX_COLS + col;
}
var GridEngine = class {
  constructor(columns) {
    this.columns = columns;
  }
  setColumns(columns) {
    this.columns = columns;
  }
  buildOccupancyMap(widgets, excludeId) {
    const map = /* @__PURE__ */ new Map();
    for (const w of widgets) {
      if (w.id === excludeId) continue;
      for (let r = w.row; r < w.row + w.height; r++) {
        for (let c = w.col; c < w.col + w.width; c++) {
          map.set(cellKey(r, c), w.id);
        }
      }
    }
    return map;
  }
  canPlaceWithMap(map, col, row, width, height) {
    if (col < 0 || row < 0 || col + width > this.columns) return false;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (map.has(cellKey(r, c))) return false;
      }
    }
    return true;
  }
  removeFromMap(map, widget) {
    for (let r = widget.row; r < widget.row + widget.height; r++) {
      for (let c = widget.col; c < widget.col + widget.width; c++) {
        map.delete(cellKey(r, c));
      }
    }
  }
  addToMap(map, widget) {
    for (let r = widget.row; r < widget.row + widget.height; r++) {
      for (let c = widget.col; c < widget.col + widget.width; c++) {
        map.set(cellKey(r, c), widget.id);
      }
    }
  }
  compact(widgets, pinnedId) {
    const sorted = [...widgets].sort((a, b) => a.row - b.row || a.col - b.col);
    const map = this.buildOccupancyMap(widgets);
    for (const widget of sorted) {
      if (widget.id === pinnedId) continue;
      this.removeFromMap(map, widget);
      let targetRow = 0;
      while (targetRow < widget.row) {
        if (this.canPlaceWithMap(map, widget.col, targetRow, widget.width, widget.height)) {
          widget.row = targetRow;
          break;
        }
        targetRow++;
      }
      this.addToMap(map, widget);
    }
  }
  clamp(widget) {
    widget.width = Math.min(widget.width, this.columns);
    widget.width = Math.max(widget.width, 1);
    widget.height = Math.max(widget.height, 1);
    if (widget.col + widget.width > this.columns) {
      widget.col = this.columns - widget.width;
    }
    if (widget.col < 0) widget.col = 0;
    if (widget.row < 0) widget.row = 0;
  }
  findFirstAvailable(widgets, width, height) {
    const map = this.buildOccupancyMap(widgets);
    const maxRow = this.getMaxRow(widgets) + 2;
    for (let row = 0; row <= maxRow; row++) {
      for (let col = 0; col <= this.columns - width; col++) {
        if (this.canPlaceWithMap(map, col, row, width, height)) {
          return { col, row };
        }
      }
    }
    return { col: 0, row: maxRow + 1 };
  }
  resolveCollisions(widgets, movedWidget) {
    const map = this.buildOccupancyMap(widgets, movedWidget.id);
    const displaced = /* @__PURE__ */ new Set();
    for (let r = movedWidget.row; r < movedWidget.row + movedWidget.height; r++) {
      for (let c = movedWidget.col; c < movedWidget.col + movedWidget.width; c++) {
        const occupant = map.get(cellKey(r, c));
        if (occupant) displaced.add(occupant);
      }
    }
    if (displaced.size === 0) return;
    for (const id of displaced) {
      const w = widgets.find((w2) => w2.id === id);
      if (!w) continue;
      w.row = movedWidget.row + movedWidget.height;
    }
    this.compactSubset(widgets, displaced);
  }
  /** Compact only the given widget IDs, leaving others in place. */
  compactSubset(widgets, ids) {
    const sorted = widgets.filter((w) => ids.has(w.id)).sort((a, b) => a.row - b.row || a.col - b.col);
    const map = this.buildOccupancyMap(widgets);
    for (const widget of sorted) {
      this.removeFromMap(map, widget);
      let targetRow = 0;
      while (targetRow < widget.row) {
        if (this.canPlaceWithMap(map, widget.col, targetRow, widget.width, widget.height)) {
          widget.row = targetRow;
          break;
        }
        targetRow++;
      }
      this.addToMap(map, widget);
    }
  }
  getMaxRow(widgets) {
    let max = 0;
    for (const w of widgets) {
      max = Math.max(max, w.row + w.height - 1);
    }
    return max;
  }
  pixelToCell(x, y, cellWidth, cellHeight) {
    return {
      col: Math.max(0, Math.min(this.columns - 1, Math.floor(x / cellWidth))),
      row: Math.max(0, Math.floor(y / cellHeight))
    };
  }
};

// src/widgets/recent-notes.ts
var import_obsidian = require("obsidian");

// src/widgets/base-widget.ts
var BaseWidget = class {
  constructor(app, containerEl, config, plugin) {
    this.app = app;
    this.containerEl = containerEl;
    this.config = config;
    this.plugin = plugin;
    this.bodyEl = this.buildCard();
  }
  buildCard() {
    this.containerEl.empty();
    this.containerEl.addClass("iris-hp-widget");
    const bodyEl = this.containerEl.createDiv({ cls: "iris-hp-widget-body" });
    for (const edge of ["tl", "tr", "bl", "br", "t", "r", "b", "l"]) {
      const handle = this.containerEl.createDiv({ cls: `iris-hp-resize-handle iris-hp-resize-${edge}` });
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.containerEl.dispatchEvent(
          new CustomEvent("widget-resize-start", { bubbles: true, detail: { widgetId: this.config.id, corner: edge, event: e } })
        );
      });
    }
    return bodyEl;
  }
  destroy() {
    this.containerEl.empty();
  }
};

// src/utils.ts
var TASK_FOLDER = "Tasks";
var SECRET_KEY_ANTHROPIC = "anthropic-api-key";
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getApiKey(app) {
  return app.vault?.secretStorage?.getSecret?.(SECRET_KEY_ANTHROPIC) ?? "";
}
function setApiKey(app, value) {
  app.vault.secretStorage.setSecret(SECRET_KEY_ANTHROPIC, value);
}
function buildHiddenFilter(app) {
  const patterns = app.vault.config?.userIgnoreFilters ?? [];
  if (patterns.length === 0) return () => false;
  const regexes = patterns.map((p) => {
    try {
      return new RegExp(p);
    } catch {
      return null;
    }
  }).filter(Boolean);
  return (path) => regexes.some((re) => re.test(path));
}
function getDisplayTitle(app, file) {
  return app.metadataCache.getFileCache(file)?.frontmatter?.displayTitle ?? file.basename;
}

// src/widgets/recent-notes.ts
var RecentNotesWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.debounceTimer = null;
    this.eventRef = null;
    this.resizeObserver = null;
    this.lastHeight = 0;
    this.hiddenFilter = buildHiddenFilter(this.app);
    this.eventRef = this.app.vault.on("modify", () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.render(), 1e3);
    });
    this.resizeObserver = new ResizeObserver(() => {
      const h = this.bodyEl.clientHeight;
      if (Math.abs(h - this.lastHeight) < 4) return;
      this.lastHeight = h;
      this.render();
    });
    this.resizeObserver.observe(this.bodyEl);
    this.render();
  }
  render() {
    this.bodyEl.empty();
    const files = this.getRecentFiles();
    const itemHeight = 32;
    const titleHeight = 28;
    const available = (this.bodyEl.clientHeight || 200) - titleHeight;
    const max = Math.max(1, Math.floor(available / itemHeight));
    const displayed = files.slice(0, max);
    if (displayed.length === 0) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "No recent notes" });
      return;
    }
    this.bodyEl.createEl("h6", { cls: "iris-hp-widget-title", text: "Recent notes" });
    const listEl = this.bodyEl.createDiv({ cls: "iris-hp-list" });
    for (const file of displayed) {
      const item = listEl.createDiv({ cls: "iris-hp-list-item" });
      const self = item.createDiv({ cls: "iris-hp-list-item-self is-clickable" });
      const inner = self.createDiv({ cls: "iris-hp-list-item-inner" });
      inner.setText(getDisplayTitle(this.app, file));
      self.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }
  getRecentFiles() {
    const recentPaths = this.app.workspace.getLastOpenFiles?.() ?? [];
    const files = [];
    for (const path of recentPaths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof import_obsidian.TFile && file.extension === "md" && !this.hiddenFilter(file.path)) {
        files.push(file);
      }
    }
    return files;
  }
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.eventRef) {
      this.app.vault.offref(this.eventRef);
      this.eventRef = null;
    }
    super.destroy();
  }
};

// src/widgets/embedded-note.ts
var import_obsidian2 = require("obsidian");
var NoteSuggestModal = class extends import_obsidian2.FuzzySuggestModal {
  constructor(app, files, onChoose) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
  }
  getItems() {
    return this.files;
  }
  getItemText(item) {
    return item.path;
  }
  onChooseItem(item) {
    this.onChoose(item);
  }
};
var EmbeddedNoteWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.modifyRef = null;
    if (this.config.notePath) {
      this.modifyRef = this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian2.TFile && file.path === this.config.notePath) {
          this.render();
        }
      });
    }
    this.render();
  }
  render() {
    this.bodyEl.empty();
    if (!this.config.notePath) {
      this.renderPicker();
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(this.config.notePath);
    if (!(file instanceof import_obsidian2.TFile)) {
      this.bodyEl.createDiv({ cls: "iris-hp-empty", text: "Note not found" });
      return;
    }
    const contentEl = this.bodyEl.createDiv({ cls: "iris-hp-embedded-content" });
    const openBtn = this.bodyEl.createEl("button", {
      cls: "iris-hp-embedded-open clickable-icon",
      attr: { "aria-label": "Open note" }
    });
    (0, import_obsidian2.setIcon)(openBtn, "external-link");
    openBtn.addEventListener("click", () => {
      this.app.workspace.getLeaf(false).openFile(file);
    });
    this.app.vault.cachedRead(file).then((content) => {
      import_obsidian2.MarkdownRenderer.render(this.app, content, contentEl, file.path, this.plugin);
    });
  }
  renderPicker() {
    const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-embedded-picker" });
    placeholder.createDiv({ cls: "iris-hp-empty", text: "No note selected" });
    const chooseBtn = placeholder.createEl("button", {
      cls: "iris-hp-embedded-choose",
      text: "Choose note"
    });
    chooseBtn.addEventListener("click", () => {
      const files = this.app.vault.getMarkdownFiles();
      new NoteSuggestModal(this.app, files, (file) => {
        this.config.notePath = file.path;
        this.plugin.saveSettings();
      }).open();
    });
  }
  destroy() {
    if (this.modifyRef) {
      this.app.vault.offref(this.modifyRef);
      this.modifyRef = null;
    }
    super.destroy();
  }
};

// src/widgets/new-note.ts
var import_obsidian3 = require("obsidian");
var NewNoteWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }
  render() {
    this.bodyEl.empty();
    const btn = this.bodyEl.createDiv({ cls: "iris-hp-new-note" });
    const icon = btn.createDiv({ cls: "iris-hp-new-note-icon" });
    (0, import_obsidian3.setIcon)(icon, "plus");
    btn.createDiv({ cls: "iris-hp-new-note-label", text: "New note" });
    btn.addEventListener("click", () => this.createNote());
  }
  async createNote() {
    const name = this.nextUntitledName();
    const file = await this.app.vault.create(name, "");
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
  nextUntitledName() {
    const existing = new Set(
      this.app.vault.getFiles().filter((f) => f instanceof import_obsidian3.TFile).map((f) => f.path)
    );
    if (!existing.has("Untitled.md")) return "Untitled.md";
    let i = 1;
    while (existing.has(`Untitled ${i}.md`)) i++;
    return `Untitled ${i}.md`;
  }
};

// src/widgets/create-task.ts
var import_obsidian4 = require("obsidian");

// node_modules/chrono-node/dist/esm/types.js
var Meridiem;
(function(Meridiem2) {
  Meridiem2[Meridiem2["AM"] = 0] = "AM";
  Meridiem2[Meridiem2["PM"] = 1] = "PM";
})(Meridiem || (Meridiem = {}));
var Weekday;
(function(Weekday2) {
  Weekday2[Weekday2["SUNDAY"] = 0] = "SUNDAY";
  Weekday2[Weekday2["MONDAY"] = 1] = "MONDAY";
  Weekday2[Weekday2["TUESDAY"] = 2] = "TUESDAY";
  Weekday2[Weekday2["WEDNESDAY"] = 3] = "WEDNESDAY";
  Weekday2[Weekday2["THURSDAY"] = 4] = "THURSDAY";
  Weekday2[Weekday2["FRIDAY"] = 5] = "FRIDAY";
  Weekday2[Weekday2["SATURDAY"] = 6] = "SATURDAY";
})(Weekday || (Weekday = {}));
var Month;
(function(Month2) {
  Month2[Month2["JANUARY"] = 1] = "JANUARY";
  Month2[Month2["FEBRUARY"] = 2] = "FEBRUARY";
  Month2[Month2["MARCH"] = 3] = "MARCH";
  Month2[Month2["APRIL"] = 4] = "APRIL";
  Month2[Month2["MAY"] = 5] = "MAY";
  Month2[Month2["JUNE"] = 6] = "JUNE";
  Month2[Month2["JULY"] = 7] = "JULY";
  Month2[Month2["AUGUST"] = 8] = "AUGUST";
  Month2[Month2["SEPTEMBER"] = 9] = "SEPTEMBER";
  Month2[Month2["OCTOBER"] = 10] = "OCTOBER";
  Month2[Month2["NOVEMBER"] = 11] = "NOVEMBER";
  Month2[Month2["DECEMBER"] = 12] = "DECEMBER";
})(Month || (Month = {}));

// node_modules/chrono-node/dist/esm/utils/dates.js
function assignSimilarDate(component, target) {
  component.assign("day", target.getDate());
  component.assign("month", target.getMonth() + 1);
  component.assign("year", target.getFullYear());
}
function assignSimilarTime(component, target) {
  component.assign("hour", target.getHours());
  component.assign("minute", target.getMinutes());
  component.assign("second", target.getSeconds());
  component.assign("millisecond", target.getMilliseconds());
  component.assign("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}
function implySimilarDate(component, target) {
  component.imply("day", target.getDate());
  component.imply("month", target.getMonth() + 1);
  component.imply("year", target.getFullYear());
}
function implySimilarTime(component, target) {
  component.imply("hour", target.getHours());
  component.imply("minute", target.getMinutes());
  component.imply("second", target.getSeconds());
  component.imply("millisecond", target.getMilliseconds());
  component.imply("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}

// node_modules/chrono-node/dist/esm/timezone.js
var TIMEZONE_ABBR_MAP = {
  ACDT: 630,
  ACST: 570,
  ADT: -180,
  AEDT: 660,
  AEST: 600,
  AFT: 270,
  AKDT: -480,
  AKST: -540,
  ALMT: 360,
  AMST: -180,
  AMT: -240,
  ANAST: 720,
  ANAT: 720,
  AQTT: 300,
  ART: -180,
  AST: -240,
  AWDT: 540,
  AWST: 480,
  AZOST: 0,
  AZOT: -60,
  AZST: 300,
  AZT: 240,
  BNT: 480,
  BOT: -240,
  BRST: -120,
  BRT: -180,
  BST: 60,
  BTT: 360,
  CAST: 480,
  CAT: 120,
  CCT: 390,
  CDT: -300,
  CEST: 120,
  CET: {
    timezoneOffsetDuringDst: 2 * 60,
    timezoneOffsetNonDst: 60,
    dstStart: (year) => getLastWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2),
    dstEnd: (year) => getLastWeekdayOfMonth(year, Month.OCTOBER, Weekday.SUNDAY, 3)
  },
  CHADT: 825,
  CHAST: 765,
  CKT: -600,
  CLST: -180,
  CLT: -240,
  COT: -300,
  CST: -360,
  CT: {
    timezoneOffsetDuringDst: -5 * 60,
    timezoneOffsetNonDst: -6 * 60,
    dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  CVT: -60,
  CXT: 420,
  ChST: 600,
  DAVT: 420,
  EASST: -300,
  EAST: -360,
  EAT: 180,
  ECT: -300,
  EDT: -240,
  EEST: 180,
  EET: 120,
  EGST: 0,
  EGT: -60,
  EST: -300,
  ET: {
    timezoneOffsetDuringDst: -4 * 60,
    timezoneOffsetNonDst: -5 * 60,
    dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  FJST: 780,
  FJT: 720,
  FKST: -180,
  FKT: -240,
  FNT: -120,
  GALT: -360,
  GAMT: -540,
  GET: 240,
  GFT: -180,
  GILT: 720,
  GMT: 0,
  GST: 240,
  GYT: -240,
  HAA: -180,
  HAC: -300,
  HADT: -540,
  HAE: -240,
  HAP: -420,
  HAR: -360,
  HAST: -600,
  HAT: -90,
  HAY: -480,
  HKT: 480,
  HLV: -210,
  HNA: -240,
  HNC: -360,
  HNE: -300,
  HNP: -480,
  HNR: -420,
  HNT: -150,
  HNY: -540,
  HOVT: 420,
  ICT: 420,
  IDT: 180,
  IOT: 360,
  IRDT: 270,
  IRKST: 540,
  IRKT: 540,
  IRST: 210,
  IST: 330,
  JST: 540,
  KGT: 360,
  KRAST: 480,
  KRAT: 480,
  KST: 540,
  KUYT: 240,
  LHDT: 660,
  LHST: 630,
  LINT: 840,
  MAGST: 720,
  MAGT: 720,
  MART: -510,
  MAWT: 300,
  MDT: -360,
  MESZ: 120,
  MEZ: 60,
  MHT: 720,
  MMT: 390,
  MSD: 240,
  MSK: 180,
  MST: -420,
  MT: {
    timezoneOffsetDuringDst: -6 * 60,
    timezoneOffsetNonDst: -7 * 60,
    dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  MUT: 240,
  MVT: 300,
  MYT: 480,
  NCT: 660,
  NDT: -90,
  NFT: 690,
  NOVST: 420,
  NOVT: 360,
  NPT: 345,
  NST: -150,
  NUT: -660,
  NZDT: 780,
  NZST: 720,
  OMSST: 420,
  OMST: 420,
  PDT: -420,
  PET: -300,
  PETST: 720,
  PETT: 720,
  PGT: 600,
  PHOT: 780,
  PHT: 480,
  PKT: 300,
  PMDT: -120,
  PMST: -180,
  PONT: 660,
  PST: -480,
  PT: {
    timezoneOffsetDuringDst: -7 * 60,
    timezoneOffsetNonDst: -8 * 60,
    dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
    dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2)
  },
  PWT: 540,
  PYST: -180,
  PYT: -240,
  RET: 240,
  SAMT: 240,
  SAST: 120,
  SBT: 660,
  SCT: 240,
  SGT: 480,
  SRT: -180,
  SST: -660,
  TAHT: -600,
  TFT: 300,
  TJT: 300,
  TKT: 780,
  TLT: 540,
  TMT: 300,
  TVT: 720,
  ULAT: 480,
  UTC: 0,
  UYST: -120,
  UYT: -180,
  UZT: 300,
  VET: -210,
  VLAST: 660,
  VLAT: 660,
  VUT: 660,
  WAST: 120,
  WAT: 60,
  WEST: 60,
  WESZ: 60,
  WET: 0,
  WEZ: 0,
  WFT: 720,
  WGST: -120,
  WGT: -180,
  WIB: 420,
  WIT: 540,
  WITA: 480,
  WST: 780,
  WT: 0,
  YAKST: 600,
  YAKT: 600,
  YAPT: 600,
  YEKST: 360,
  YEKT: 360
};
function getNthWeekdayOfMonth(year, month, weekday, n, hour = 0) {
  let dayOfMonth = 0;
  let i = 0;
  while (i < n) {
    dayOfMonth++;
    const date = new Date(year, month - 1, dayOfMonth);
    if (date.getDay() === weekday)
      i++;
  }
  return new Date(year, month - 1, dayOfMonth, hour);
}
function getLastWeekdayOfMonth(year, month, weekday, hour = 0) {
  const oneIndexedWeekday = weekday === 0 ? 7 : weekday;
  const date = new Date(year, month - 1 + 1, 1, 12);
  const firstWeekdayNextMonth = date.getDay() === 0 ? 7 : date.getDay();
  let dayDiff;
  if (firstWeekdayNextMonth === oneIndexedWeekday)
    dayDiff = 7;
  else if (firstWeekdayNextMonth < oneIndexedWeekday)
    dayDiff = 7 + firstWeekdayNextMonth - oneIndexedWeekday;
  else
    dayDiff = firstWeekdayNextMonth - oneIndexedWeekday;
  date.setDate(date.getDate() - dayDiff);
  return new Date(year, month - 1, date.getDate(), hour);
}
function toTimezoneOffset(timezoneInput, date, timezoneOverrides = {}) {
  if (timezoneInput == null) {
    return null;
  }
  if (typeof timezoneInput === "number") {
    return timezoneInput;
  }
  const matchedTimezone = timezoneOverrides[timezoneInput] ?? TIMEZONE_ABBR_MAP[timezoneInput];
  if (matchedTimezone == null) {
    return null;
  }
  if (typeof matchedTimezone == "number") {
    return matchedTimezone;
  }
  if (date == null) {
    return null;
  }
  if (date > matchedTimezone.dstStart(date.getFullYear()) && !(date > matchedTimezone.dstEnd(date.getFullYear()))) {
    return matchedTimezone.timezoneOffsetDuringDst;
  }
  return matchedTimezone.timezoneOffsetNonDst;
}

// node_modules/chrono-node/dist/esm/calculation/duration.js
var EmptyDuration = {
  day: 0,
  second: 0,
  millisecond: 0
};
function addDuration(ref, duration) {
  let date = new Date(ref);
  if (duration["y"]) {
    duration["year"] = duration["y"];
    delete duration["y"];
  }
  if (duration["mo"]) {
    duration["month"] = duration["mo"];
    delete duration["mo"];
  }
  if (duration["M"]) {
    duration["month"] = duration["M"];
    delete duration["M"];
  }
  if (duration["w"]) {
    duration["week"] = duration["w"];
    delete duration["w"];
  }
  if (duration["d"]) {
    duration["day"] = duration["d"];
    delete duration["d"];
  }
  if (duration["h"]) {
    duration["hour"] = duration["h"];
    delete duration["h"];
  }
  if (duration["m"]) {
    duration["minute"] = duration["m"];
    delete duration["m"];
  }
  if (duration["s"]) {
    duration["second"] = duration["s"];
    delete duration["s"];
  }
  if (duration["ms"]) {
    duration["millisecond"] = duration["ms"];
    delete duration["ms"];
  }
  if ("year" in duration) {
    const floor = Math.floor(duration["year"]);
    date.setFullYear(date.getFullYear() + floor);
    const remainingFraction = duration["year"] - floor;
    if (remainingFraction > 0) {
      duration.month = duration?.month ?? 0;
      duration.month += remainingFraction * 12;
    }
  }
  if ("quarter" in duration) {
    const floor = Math.floor(duration["quarter"]);
    date.setMonth(date.getMonth() + floor * 3);
  }
  if ("month" in duration) {
    const floor = Math.floor(duration["month"]);
    date.setMonth(date.getMonth() + floor);
    const remainingFraction = duration["month"] - floor;
    if (remainingFraction > 0) {
      duration.week = duration?.week ?? 0;
      duration.week += remainingFraction * 4;
    }
  }
  if ("week" in duration) {
    const floor = Math.floor(duration["week"]);
    date.setDate(date.getDate() + floor * 7);
    const remainingFraction = duration["week"] - floor;
    if (remainingFraction > 0) {
      duration.day = duration?.day ?? 0;
      duration.day += Math.round(remainingFraction * 7);
    }
  }
  if ("day" in duration) {
    const floor = Math.floor(duration["day"]);
    date.setDate(date.getDate() + floor);
    const remainingFraction = duration["day"] - floor;
    if (remainingFraction > 0) {
      duration.hour = duration?.hour ?? 0;
      duration.hour += Math.round(remainingFraction * 24);
    }
  }
  if ("hour" in duration) {
    const floor = Math.floor(duration["hour"]);
    date.setHours(date.getHours() + floor);
    const remainingFraction = duration["hour"] - floor;
    if (remainingFraction > 0) {
      duration.minute = duration?.minute ?? 0;
      duration.minute += Math.round(remainingFraction * 60);
    }
  }
  if ("minute" in duration) {
    const floor = Math.floor(duration["minute"]);
    date.setMinutes(date.getMinutes() + floor);
    const remainingFraction = duration["minute"] - floor;
    if (remainingFraction > 0) {
      duration.second = duration?.second ?? 0;
      duration.second += Math.round(remainingFraction * 60);
    }
  }
  if ("second" in duration) {
    const floor = Math.floor(duration["second"]);
    date.setSeconds(date.getSeconds() + floor);
    const remainingFraction = duration["second"] - floor;
    if (remainingFraction > 0) {
      duration.millisecond = duration?.millisecond ?? 0;
      duration.millisecond += Math.round(remainingFraction * 1e3);
    }
  }
  if ("millisecond" in duration) {
    const floor = Math.floor(duration["millisecond"]);
    date.setMilliseconds(date.getMilliseconds() + floor);
  }
  return date;
}
function reverseDuration(duration) {
  const reversed = {};
  for (const key in duration) {
    reversed[key] = -duration[key];
  }
  return reversed;
}

// node_modules/chrono-node/dist/esm/results.js
var ReferenceWithTimezone = class _ReferenceWithTimezone {
  instant;
  timezoneOffset;
  constructor(instant, timezoneOffset) {
    this.instant = instant ?? /* @__PURE__ */ new Date();
    this.timezoneOffset = timezoneOffset ?? null;
  }
  static fromDate(date) {
    return new _ReferenceWithTimezone(date);
  }
  static fromInput(input, timezoneOverrides) {
    if (input instanceof Date) {
      return _ReferenceWithTimezone.fromDate(input);
    }
    const instant = input?.instant ?? /* @__PURE__ */ new Date();
    const timezoneOffset = toTimezoneOffset(input?.timezone, instant, timezoneOverrides);
    return new _ReferenceWithTimezone(instant, timezoneOffset);
  }
  getDateWithAdjustedTimezone() {
    const date = new Date(this.instant);
    if (this.timezoneOffset !== null) {
      date.setMinutes(date.getMinutes() - this.getSystemTimezoneAdjustmentMinute(this.instant));
    }
    return date;
  }
  getSystemTimezoneAdjustmentMinute(date, overrideTimezoneOffset) {
    if (!date || date.getTime() < 0) {
      date = /* @__PURE__ */ new Date();
    }
    const currentTimezoneOffset = -date.getTimezoneOffset();
    const targetTimezoneOffset = overrideTimezoneOffset ?? this.timezoneOffset ?? currentTimezoneOffset;
    return currentTimezoneOffset - targetTimezoneOffset;
  }
  getTimezoneOffset() {
    return this.timezoneOffset ?? -this.instant.getTimezoneOffset();
  }
};
var ParsingComponents = class _ParsingComponents {
  knownValues;
  impliedValues;
  reference;
  _tags = /* @__PURE__ */ new Set();
  constructor(reference, knownComponents) {
    this.reference = reference;
    this.knownValues = {};
    this.impliedValues = {};
    if (knownComponents) {
      for (const key in knownComponents) {
        this.knownValues[key] = knownComponents[key];
      }
    }
    const date = reference.getDateWithAdjustedTimezone();
    this.imply("day", date.getDate());
    this.imply("month", date.getMonth() + 1);
    this.imply("year", date.getFullYear());
    this.imply("hour", 12);
    this.imply("minute", 0);
    this.imply("second", 0);
    this.imply("millisecond", 0);
  }
  static createRelativeFromReference(reference, duration = EmptyDuration) {
    let date = addDuration(reference.getDateWithAdjustedTimezone(), duration);
    const components = new _ParsingComponents(reference);
    components.addTag("result/relativeDate");
    if ("hour" in duration || "minute" in duration || "second" in duration || "millisecond" in duration) {
      components.addTag("result/relativeDateAndTime");
      assignSimilarTime(components, date);
      assignSimilarDate(components, date);
      components.assign("timezoneOffset", reference.getTimezoneOffset());
    } else {
      implySimilarTime(components, date);
      components.imply("timezoneOffset", reference.getTimezoneOffset());
      if ("day" in duration) {
        components.assign("day", date.getDate());
        components.assign("month", date.getMonth() + 1);
        components.assign("year", date.getFullYear());
        components.assign("weekday", date.getDay());
      } else if ("week" in duration) {
        components.assign("day", date.getDate());
        components.assign("month", date.getMonth() + 1);
        components.assign("year", date.getFullYear());
        components.imply("weekday", date.getDay());
      } else {
        components.imply("day", date.getDate());
        if ("month" in duration) {
          components.assign("month", date.getMonth() + 1);
          components.assign("year", date.getFullYear());
        } else {
          components.imply("month", date.getMonth() + 1);
          if ("year" in duration) {
            components.assign("year", date.getFullYear());
          } else {
            components.imply("year", date.getFullYear());
          }
        }
      }
    }
    return components;
  }
  get(component) {
    if (component in this.knownValues) {
      return this.knownValues[component];
    }
    if (component in this.impliedValues) {
      return this.impliedValues[component];
    }
    return null;
  }
  isCertain(component) {
    return component in this.knownValues;
  }
  getCertainComponents() {
    return Object.keys(this.knownValues);
  }
  imply(component, value) {
    if (component in this.knownValues) {
      return this;
    }
    this.impliedValues[component] = value;
    return this;
  }
  assign(component, value) {
    this.knownValues[component] = value;
    delete this.impliedValues[component];
    return this;
  }
  addDurationAsImplied(duration) {
    const currentDate = this.dateWithoutTimezoneAdjustment();
    const date = addDuration(currentDate, duration);
    if ("day" in duration || "week" in duration || "month" in duration || "year" in duration) {
      this.delete(["day", "weekday", "month", "year"]);
      this.imply("day", date.getDate());
      this.imply("weekday", date.getDay());
      this.imply("month", date.getMonth() + 1);
      this.imply("year", date.getFullYear());
    }
    if ("second" in duration || "minute" in duration || "hour" in duration) {
      this.delete(["second", "minute", "hour"]);
      this.imply("second", date.getSeconds());
      this.imply("minute", date.getMinutes());
      this.imply("hour", date.getHours());
    }
    return this;
  }
  delete(components) {
    if (typeof components === "string") {
      components = [components];
    }
    for (const component of components) {
      delete this.knownValues[component];
      delete this.impliedValues[component];
    }
  }
  clone() {
    const component = new _ParsingComponents(this.reference);
    component.knownValues = {};
    component.impliedValues = {};
    for (const key in this.knownValues) {
      component.knownValues[key] = this.knownValues[key];
    }
    for (const key in this.impliedValues) {
      component.impliedValues[key] = this.impliedValues[key];
    }
    return component;
  }
  isOnlyDate() {
    return !this.isCertain("hour") && !this.isCertain("minute") && !this.isCertain("second");
  }
  isOnlyTime() {
    return !this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month") && !this.isCertain("year");
  }
  isOnlyWeekdayComponent() {
    return this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month");
  }
  isDateWithUnknownYear() {
    return this.isCertain("month") && !this.isCertain("year");
  }
  isValidDate() {
    const date = this.dateWithoutTimezoneAdjustment();
    if (date.getFullYear() !== this.get("year"))
      return false;
    if (date.getMonth() !== this.get("month") - 1)
      return false;
    if (date.getDate() !== this.get("day"))
      return false;
    if (this.get("hour") != null && date.getHours() != this.get("hour"))
      return false;
    if (this.get("minute") != null && date.getMinutes() != this.get("minute"))
      return false;
    return true;
  }
  toString() {
    return `[ParsingComponents {
            tags: ${JSON.stringify(Array.from(this._tags).sort())}, 
            knownValues: ${JSON.stringify(this.knownValues)}, 
            impliedValues: ${JSON.stringify(this.impliedValues)}}, 
            reference: ${JSON.stringify(this.reference)}]`;
  }
  date() {
    const date = this.dateWithoutTimezoneAdjustment();
    const timezoneAdjustment = this.reference.getSystemTimezoneAdjustmentMinute(date, this.get("timezoneOffset"));
    return new Date(date.getTime() + timezoneAdjustment * 6e4);
  }
  addTag(tag) {
    this._tags.add(tag);
    return this;
  }
  addTags(tags) {
    for (const tag of tags) {
      this._tags.add(tag);
    }
    return this;
  }
  tags() {
    return new Set(this._tags);
  }
  dateWithoutTimezoneAdjustment() {
    const date = new Date(this.get("year"), this.get("month") - 1, this.get("day"), this.get("hour"), this.get("minute"), this.get("second"), this.get("millisecond"));
    date.setFullYear(this.get("year"));
    return date;
  }
};
var ParsingResult = class _ParsingResult {
  refDate;
  index;
  text;
  reference;
  start;
  end;
  constructor(reference, index, text, start, end) {
    this.reference = reference;
    this.refDate = reference.instant;
    this.index = index;
    this.text = text;
    this.start = start || new ParsingComponents(reference);
    this.end = end;
  }
  clone() {
    const result = new _ParsingResult(this.reference, this.index, this.text);
    result.start = this.start ? this.start.clone() : null;
    result.end = this.end ? this.end.clone() : null;
    return result;
  }
  date() {
    return this.start.date();
  }
  addTag(tag) {
    this.start.addTag(tag);
    if (this.end) {
      this.end.addTag(tag);
    }
    return this;
  }
  addTags(tags) {
    this.start.addTags(tags);
    if (this.end) {
      this.end.addTags(tags);
    }
    return this;
  }
  tags() {
    const combinedTags = new Set(this.start.tags());
    if (this.end) {
      for (const tag of this.end.tags()) {
        combinedTags.add(tag);
      }
    }
    return combinedTags;
  }
  toString() {
    const tags = Array.from(this.tags()).sort();
    return `[ParsingResult {index: ${this.index}, text: '${this.text}', tags: ${JSON.stringify(tags)} ...}]`;
  }
};

// node_modules/chrono-node/dist/esm/utils/pattern.js
function repeatedTimeunitPattern(prefix, singleTimeunitPattern, connectorPattern = "\\s{0,5},?\\s{0,5}") {
  const singleTimeunitPatternNoCapture = singleTimeunitPattern.replace(/\((?!\?)/g, "(?:");
  return `${prefix}${singleTimeunitPatternNoCapture}(?:${connectorPattern}${singleTimeunitPatternNoCapture}){0,10}`;
}
function extractTerms(dictionary) {
  let keys;
  if (dictionary instanceof Array) {
    keys = [...dictionary];
  } else if (dictionary instanceof Map) {
    keys = Array.from(dictionary.keys());
  } else {
    keys = Object.keys(dictionary);
  }
  return keys;
}
function matchAnyPattern(dictionary) {
  const joinedTerms = extractTerms(dictionary).sort((a, b) => b.length - a.length).join("|").replace(/\./g, "\\.");
  return `(?:${joinedTerms})`;
}

// node_modules/chrono-node/dist/esm/calculation/years.js
function findMostLikelyADYear(yearNumber) {
  if (yearNumber < 100) {
    if (yearNumber > 50) {
      yearNumber = yearNumber + 1900;
    } else {
      yearNumber = yearNumber + 2e3;
    }
  }
  return yearNumber;
}
function findYearClosestToRef(refDate, day, month) {
  let date = new Date(refDate);
  date.setMonth(month - 1);
  date.setDate(day);
  const nextYear = addDuration(date, { "year": 1 });
  const lastYear = addDuration(date, { "year": -1 });
  if (Math.abs(nextYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
    date = nextYear;
  } else if (Math.abs(lastYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
    date = lastYear;
  }
  return date.getFullYear();
}

// node_modules/chrono-node/dist/esm/locales/en/constants.js
var WEEKDAY_DICTIONARY = {
  sunday: 0,
  sun: 0,
  "sun.": 0,
  monday: 1,
  mon: 1,
  "mon.": 1,
  tuesday: 2,
  tue: 2,
  "tue.": 2,
  wednesday: 3,
  wed: 3,
  "wed.": 3,
  thursday: 4,
  thurs: 4,
  "thurs.": 4,
  thur: 4,
  "thur.": 4,
  thu: 4,
  "thu.": 4,
  friday: 5,
  fri: 5,
  "fri.": 5,
  saturday: 6,
  sat: 6,
  "sat.": 6
};
var FULL_MONTH_NAME_DICTIONARY = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};
var MONTH_DICTIONARY = {
  ...FULL_MONTH_NAME_DICTIONARY,
  jan: 1,
  "jan.": 1,
  feb: 2,
  "feb.": 2,
  mar: 3,
  "mar.": 3,
  apr: 4,
  "apr.": 4,
  jun: 6,
  "jun.": 6,
  jul: 7,
  "jul.": 7,
  aug: 8,
  "aug.": 8,
  sep: 9,
  "sep.": 9,
  sept: 9,
  "sept.": 9,
  oct: 10,
  "oct.": 10,
  nov: 11,
  "nov.": 11,
  dec: 12,
  "dec.": 12
};
var INTEGER_WORD_DICTIONARY = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12
};
var ORDINAL_WORD_DICTIONARY = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  "thirtieth": 30,
  "thirty first": 31,
  "thirty-first": 31
};
var TIME_UNIT_DICTIONARY_NO_ABBR = {
  second: "second",
  seconds: "second",
  minute: "minute",
  minutes: "minute",
  hour: "hour",
  hours: "hour",
  day: "day",
  days: "day",
  week: "week",
  weeks: "week",
  month: "month",
  months: "month",
  quarter: "quarter",
  quarters: "quarter",
  year: "year",
  years: "year"
};
var TIME_UNIT_DICTIONARY = {
  s: "second",
  sec: "second",
  second: "second",
  seconds: "second",
  m: "minute",
  min: "minute",
  mins: "minute",
  minute: "minute",
  minutes: "minute",
  h: "hour",
  hr: "hour",
  hrs: "hour",
  hour: "hour",
  hours: "hour",
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  week: "week",
  weeks: "week",
  mo: "month",
  mon: "month",
  mos: "month",
  month: "month",
  months: "month",
  qtr: "quarter",
  quarter: "quarter",
  quarters: "quarter",
  y: "year",
  yr: "year",
  year: "year",
  years: "year",
  ...TIME_UNIT_DICTIONARY_NO_ABBR
};
var NUMBER_PATTERN = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY)}|[0-9]+|[0-9]+\\.[0-9]+|half(?:\\s{0,2}an?)?|an?\\b(?:\\s{0,2}few)?|few|several|the|a?\\s{0,2}couple\\s{0,2}(?:of)?)`;
function parseNumberPattern(match) {
  const num = match.toLowerCase();
  if (INTEGER_WORD_DICTIONARY[num] !== void 0) {
    return INTEGER_WORD_DICTIONARY[num];
  } else if (num === "a" || num === "an" || num == "the") {
    return 1;
  } else if (num.match(/few/)) {
    return 3;
  } else if (num.match(/half/)) {
    return 0.5;
  } else if (num.match(/couple/)) {
    return 2;
  } else if (num.match(/several/)) {
    return 7;
  }
  return parseFloat(num);
}
var ORDINAL_NUMBER_PATTERN = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY)}|[0-9]{1,2}(?:st|nd|rd|th)?)`;
function parseOrdinalNumberPattern(match) {
  let num = match.toLowerCase();
  if (ORDINAL_WORD_DICTIONARY[num] !== void 0) {
    return ORDINAL_WORD_DICTIONARY[num];
  }
  num = num.replace(/(?:st|nd|rd|th)$/i, "");
  return parseInt(num);
}
var YEAR_PATTERN = `(?:[1-9][0-9]{0,3}\\s{0,2}(?:BE|AD|BC|BCE|CE)|[1-2][0-9]{3}|[5-9][0-9]|2[0-5])`;
function parseYear(match) {
  if (/BE/i.test(match)) {
    match = match.replace(/BE/i, "");
    return parseInt(match) - 543;
  }
  if (/BCE?/i.test(match)) {
    match = match.replace(/BCE?/i, "");
    return -parseInt(match);
  }
  if (/(AD|CE)/i.test(match)) {
    match = match.replace(/(AD|CE)/i, "");
    return parseInt(match);
  }
  const rawYearNumber = parseInt(match);
  return findMostLikelyADYear(rawYearNumber);
}
var SINGLE_TIME_UNIT_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY)})`;
var SINGLE_TIME_UNIT_REGEX = new RegExp(SINGLE_TIME_UNIT_PATTERN, "i");
var SINGLE_TIME_UNIT_NO_ABBR_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY_NO_ABBR)})`;
var TIME_UNIT_CONNECTOR_PATTERN = `\\s{0,5},?(?:\\s*and)?\\s{0,5}`;
var TIME_UNITS_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
var TIME_UNITS_NO_ABBR_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_NO_ABBR_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
function parseDuration(timeunitText) {
  const fragments = {};
  let remainingText = timeunitText;
  let match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
  while (match) {
    collectDateTimeFragment(fragments, match);
    remainingText = remainingText.substring(match[0].length).trim();
    match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
  }
  if (Object.keys(fragments).length == 0) {
    return null;
  }
  return fragments;
}
function collectDateTimeFragment(fragments, match) {
  if (match[0].match(/^[a-zA-Z]+$/)) {
    return;
  }
  const num = parseNumberPattern(match[1]);
  const unit = TIME_UNIT_DICTIONARY[match[2].toLowerCase()];
  fragments[unit] = num;
}

// node_modules/chrono-node/dist/esm/common/parsers/AbstractParserWithWordBoundary.js
var AbstractParserWithWordBoundaryChecking = class {
  innerPatternHasChange(context, currentInnerPattern) {
    return this.innerPattern(context) !== currentInnerPattern;
  }
  patternLeftBoundary() {
    return `(\\W|^)`;
  }
  cachedInnerPattern = null;
  cachedPattern = null;
  pattern(context) {
    if (this.cachedInnerPattern) {
      if (!this.innerPatternHasChange(context, this.cachedInnerPattern)) {
        return this.cachedPattern;
      }
    }
    this.cachedInnerPattern = this.innerPattern(context);
    this.cachedPattern = new RegExp(`${this.patternLeftBoundary()}${this.cachedInnerPattern.source}`, this.cachedInnerPattern.flags);
    return this.cachedPattern;
  }
  extract(context, match) {
    const header = match[1] ?? "";
    match.index = match.index + header.length;
    match[0] = match[0].substring(header.length);
    for (let i = 2; i < match.length; i++) {
      match[i - 1] = match[i];
    }
    return this.innerExtract(context, match);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitWithinFormatParser.js
var PATTERN_WITH_OPTIONAL_PREFIX = new RegExp(`(?:(?:within|in|for)\\s*)?(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX = new RegExp(`(?:within|in|for)\\s*(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_WITH_PREFIX_STRICT = new RegExp(`(?:within|in|for)\\s*(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
var ENTimeUnitWithinFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern(context) {
    if (this.strictMode) {
      return PATTERN_WITH_PREFIX_STRICT;
    }
    return context.option.forwardDate ? PATTERN_WITH_OPTIONAL_PREFIX : PATTERN_WITH_PREFIX;
  }
  innerExtract(context, match) {
    if (match[0].match(/^for\s*the\s*\w+/)) {
      return null;
    }
    const timeUnits = parseDuration(match[1]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameLittleEndianParser.js
var PATTERN = new RegExp(`(?:on\\s{0,3})?(${ORDINAL_NUMBER_PATTERN})(?:\\s{0,3}(?:to|\\-|\\\u2013|until|through|till)?\\s{0,3}(${ORDINAL_NUMBER_PATTERN}))?(?:-|/|\\s{0,3}(?:of)?\\s{0,3})(${matchAnyPattern(MONTH_DICTIONARY)})(?:(?:-|/|,?\\s{0,3})(${YEAR_PATTERN}(?!\\w)))?(?=\\W|$)`, "i");
var DATE_GROUP = 1;
var DATE_TO_GROUP = 2;
var MONTH_NAME_GROUP = 3;
var YEAR_GROUP = 4;
var ENMonthNameLittleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN;
  }
  innerExtract(context, match) {
    const result = context.createParsingResult(match.index, match[0]);
    const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP].toLowerCase()];
    const day = parseOrdinalNumberPattern(match[DATE_GROUP]);
    if (day > 31) {
      match.index = match.index + match[DATE_GROUP].length;
      return null;
    }
    result.start.assign("month", month);
    result.start.assign("day", day);
    if (match[YEAR_GROUP]) {
      const yearNumber = parseYear(match[YEAR_GROUP]);
      result.start.assign("year", yearNumber);
    } else {
      const year = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year);
    }
    if (match[DATE_TO_GROUP]) {
      const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP]);
      result.end = result.start.clone();
      result.end.assign("day", endDate);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameMiddleEndianParser.js
var PATTERN2 = new RegExp(`(${matchAnyPattern(MONTH_DICTIONARY)})(?:-|/|\\s*,?\\s*)(${ORDINAL_NUMBER_PATTERN})(?!\\s*(?:am|pm))\\s*(?:(?:to|\\-)\\s*(${ORDINAL_NUMBER_PATTERN})\\s*)?(?:(?:-|/|\\s*,\\s*|\\s+)(${YEAR_PATTERN}))?(?=\\W|$)(?!\\:\\d)`, "i");
var MONTH_NAME_GROUP2 = 1;
var DATE_GROUP2 = 2;
var DATE_TO_GROUP2 = 3;
var YEAR_GROUP2 = 4;
var ENMonthNameMiddleEndianParser = class extends AbstractParserWithWordBoundaryChecking {
  shouldSkipYearLikeDate;
  constructor(shouldSkipYearLikeDate) {
    super();
    this.shouldSkipYearLikeDate = shouldSkipYearLikeDate;
  }
  innerPattern() {
    return PATTERN2;
  }
  innerExtract(context, match) {
    const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP2].toLowerCase()];
    const day = parseOrdinalNumberPattern(match[DATE_GROUP2]);
    if (day > 31) {
      return null;
    }
    if (this.shouldSkipYearLikeDate) {
      if (!match[DATE_TO_GROUP2] && !match[YEAR_GROUP2] && match[DATE_GROUP2].match(/^2[0-5]$/)) {
        return null;
      }
    }
    const components = context.createParsingComponents({
      day,
      month
    }).addTag("parser/ENMonthNameMiddleEndianParser");
    if (match[YEAR_GROUP2]) {
      const year = parseYear(match[YEAR_GROUP2]);
      components.assign("year", year);
    } else {
      const year = findYearClosestToRef(context.refDate, day, month);
      components.imply("year", year);
    }
    if (!match[DATE_TO_GROUP2]) {
      return components;
    }
    const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP2]);
    const result = context.createParsingResult(match.index, match[0]);
    result.start = components;
    result.end = components.clone();
    result.end.assign("day", endDate);
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENMonthNameParser.js
var PATTERN3 = new RegExp(`((?:in)\\s*)?(${matchAnyPattern(MONTH_DICTIONARY)})\\s*(?:(?:,|-|of)?\\s*(${YEAR_PATTERN})?)?(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)`, "i");
var PREFIX_GROUP = 1;
var MONTH_NAME_GROUP3 = 2;
var YEAR_GROUP3 = 3;
var ENMonthNameParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN3;
  }
  innerExtract(context, match) {
    const monthName = match[MONTH_NAME_GROUP3].toLowerCase();
    if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY[monthName]) {
      return null;
    }
    const result = context.createParsingResult(match.index + (match[PREFIX_GROUP] || "").length, match.index + match[0].length);
    result.start.imply("day", 1);
    result.start.addTag("parser/ENMonthNameParser");
    const month = MONTH_DICTIONARY[monthName];
    result.start.assign("month", month);
    if (match[YEAR_GROUP3]) {
      const year = parseYear(match[YEAR_GROUP3]);
      result.start.assign("year", year);
    } else {
      const year = findYearClosestToRef(context.refDate, 1, month);
      result.start.imply("year", year);
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENYearMonthDayParser.js
var PATTERN4 = new RegExp(`([0-9]{4})[-\\.\\/\\s](?:(${matchAnyPattern(MONTH_DICTIONARY)})|([0-9]{1,2}))[-\\.\\/\\s]([0-9]{1,2})(?=\\W|$)`, "i");
var YEAR_NUMBER_GROUP = 1;
var MONTH_NAME_GROUP4 = 2;
var MONTH_NUMBER_GROUP = 3;
var DATE_NUMBER_GROUP = 4;
var ENYearMonthDayParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMonthDateOrder;
  constructor(strictMonthDateOrder) {
    super();
    this.strictMonthDateOrder = strictMonthDateOrder;
  }
  innerPattern() {
    return PATTERN4;
  }
  innerExtract(context, match) {
    const year = parseInt(match[YEAR_NUMBER_GROUP]);
    let day = parseInt(match[DATE_NUMBER_GROUP]);
    let month = match[MONTH_NUMBER_GROUP] ? parseInt(match[MONTH_NUMBER_GROUP]) : MONTH_DICTIONARY[match[MONTH_NAME_GROUP4].toLowerCase()];
    if (month < 1 || month > 12) {
      if (this.strictMonthDateOrder) {
        return null;
      }
      if (day >= 1 && day <= 12) {
        [month, day] = [day, month];
      }
    }
    if (day < 1 || day > 31) {
      return null;
    }
    return {
      day,
      month,
      year
    };
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENSlashMonthFormatParser.js
var PATTERN5 = new RegExp("([0-9]|0[1-9]|1[012])/([0-9]{4})", "i");
var MONTH_GROUP = 1;
var YEAR_GROUP4 = 2;
var ENSlashMonthFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN5;
  }
  innerExtract(context, match) {
    const year = parseInt(match[YEAR_GROUP4]);
    const month = parseInt(match[MONTH_GROUP]);
    return context.createParsingComponents().imply("day", 1).assign("month", month).assign("year", year);
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/AbstractTimeExpressionParser.js
function primaryTimePattern(leftBoundary, primaryPrefix, primarySuffix, flags) {
  return new RegExp(`${leftBoundary}${primaryPrefix}(\\d{1,4})(?:(?:\\.|:|\uFF1A)(\\d{1,2})(?:(?::|\uFF1A)(\\d{2})(?:\\.(\\d{1,6}))?)?)?(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?${primarySuffix}`, flags);
}
function followingTimePatten(followingPhase, followingSuffix) {
  return new RegExp(`^(${followingPhase})(\\d{1,4})(?:(?:\\.|\\:|\\\uFF1A)(\\d{1,2})(?:(?:\\.|\\:|\\\uFF1A)(\\d{1,2})(?:\\.(\\d{1,6}))?)?)?(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?${followingSuffix}`, "i");
}
var HOUR_GROUP = 2;
var MINUTE_GROUP = 3;
var SECOND_GROUP = 4;
var MILLI_SECOND_GROUP = 5;
var AM_PM_HOUR_GROUP = 6;
var AbstractTimeExpressionParser = class {
  strictMode;
  constructor(strictMode = false) {
    this.strictMode = strictMode;
  }
  patternFlags() {
    return "i";
  }
  primaryPatternLeftBoundary() {
    return `(^|\\s|T|\\b)`;
  }
  primarySuffix() {
    return `(?!/)(?=\\W|$)`;
  }
  followingSuffix() {
    return `(?!/)(?=\\W|$)`;
  }
  pattern(context) {
    return this.getPrimaryTimePatternThroughCache();
  }
  extract(context, match) {
    const startComponents = this.extractPrimaryTimeComponents(context, match);
    if (!startComponents) {
      if (match[0].match(/^\d{4}/)) {
        match.index += 4;
        return null;
      }
      match.index += match[0].length;
      return null;
    }
    const index = match.index + match[1].length;
    const text = match[0].substring(match[1].length);
    const result = context.createParsingResult(index, text, startComponents);
    match.index += match[0].length;
    const remainingText = context.text.substring(match.index);
    const followingPattern = this.getFollowingTimePatternThroughCache();
    const followingMatch = followingPattern.exec(remainingText);
    if (text.match(/^\d{3,4}/) && followingMatch) {
      if (followingMatch[0].match(/^\s*([+-])\s*\d{2,4}$/)) {
        return null;
      }
      if (followingMatch[0].match(/^\s*([+-])\s*\d{2}\W\d{2}/)) {
        return null;
      }
    }
    if (!followingMatch || followingMatch[0].match(/^\s*([+-])\s*\d{3,4}$/)) {
      return this.checkAndReturnWithoutFollowingPattern(result);
    }
    result.end = this.extractFollowingTimeComponents(context, followingMatch, result);
    if (result.end) {
      result.text += followingMatch[0];
    }
    return this.checkAndReturnWithFollowingPattern(result);
  }
  extractPrimaryTimeComponents(context, match, strict2 = false) {
    const components = context.createParsingComponents();
    let minute = 0;
    let meridiem = null;
    let hour = parseInt(match[HOUR_GROUP]);
    if (hour > 100) {
      if (match[HOUR_GROUP].length == 4 && match[MINUTE_GROUP] == null && !match[AM_PM_HOUR_GROUP]) {
        return null;
      }
      if (this.strictMode || match[MINUTE_GROUP] != null) {
        return null;
      }
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (hour > 24) {
      return null;
    }
    if (match[MINUTE_GROUP] != null) {
      if (match[MINUTE_GROUP].length == 1 && !match[AM_PM_HOUR_GROUP]) {
        return null;
      }
      minute = parseInt(match[MINUTE_GROUP]);
    }
    if (minute >= 60) {
      return null;
    }
    if (hour > 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP] != null) {
      if (hour > 12)
        return null;
      const ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
      if (ampm == "a") {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
        }
      }
      if (ampm == "p") {
        meridiem = Meridiem.PM;
        if (hour != 12) {
          hour += 12;
        }
      }
    }
    components.assign("hour", hour);
    components.assign("minute", minute);
    if (meridiem !== null) {
      components.assign("meridiem", meridiem);
    } else {
      if (hour < 12) {
        components.imply("meridiem", Meridiem.AM);
      } else {
        components.imply("meridiem", Meridiem.PM);
      }
    }
    if (match[MILLI_SECOND_GROUP] != null) {
      const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
      if (millisecond >= 1e3)
        return null;
      components.assign("millisecond", millisecond);
    }
    if (match[SECOND_GROUP] != null) {
      const second = parseInt(match[SECOND_GROUP]);
      if (second >= 60)
        return null;
      components.assign("second", second);
    }
    return components;
  }
  extractFollowingTimeComponents(context, match, result) {
    const components = context.createParsingComponents();
    if (match[MILLI_SECOND_GROUP] != null) {
      const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
      if (millisecond >= 1e3)
        return null;
      components.assign("millisecond", millisecond);
    }
    if (match[SECOND_GROUP] != null) {
      const second = parseInt(match[SECOND_GROUP]);
      if (second >= 60)
        return null;
      components.assign("second", second);
    }
    let hour = parseInt(match[HOUR_GROUP]);
    let minute = 0;
    let meridiem = -1;
    if (match[MINUTE_GROUP] != null) {
      minute = parseInt(match[MINUTE_GROUP]);
    } else if (hour > 100) {
      minute = hour % 100;
      hour = Math.floor(hour / 100);
    }
    if (minute >= 60 || hour > 24) {
      return null;
    }
    if (hour >= 12) {
      meridiem = Meridiem.PM;
    }
    if (match[AM_PM_HOUR_GROUP] != null) {
      if (hour > 12) {
        return null;
      }
      const ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
      if (ampm == "a") {
        meridiem = Meridiem.AM;
        if (hour == 12) {
          hour = 0;
          if (!components.isCertain("day")) {
            components.imply("day", components.get("day") + 1);
          }
        }
      }
      if (ampm == "p") {
        meridiem = Meridiem.PM;
        if (hour != 12)
          hour += 12;
      }
      if (!result.start.isCertain("meridiem")) {
        if (meridiem == Meridiem.AM) {
          result.start.imply("meridiem", Meridiem.AM);
          if (result.start.get("hour") == 12) {
            result.start.assign("hour", 0);
          }
        } else {
          result.start.imply("meridiem", Meridiem.PM);
          if (result.start.get("hour") != 12) {
            result.start.assign("hour", result.start.get("hour") + 12);
          }
        }
      }
    }
    components.assign("hour", hour);
    components.assign("minute", minute);
    if (meridiem >= 0) {
      components.assign("meridiem", meridiem);
    } else {
      const startAtPM = result.start.isCertain("meridiem") && result.start.get("hour") > 12;
      if (startAtPM) {
        if (result.start.get("hour") - 12 > hour) {
          components.imply("meridiem", Meridiem.AM);
        } else if (hour <= 12) {
          components.assign("hour", hour + 12);
          components.assign("meridiem", Meridiem.PM);
        }
      } else if (hour > 12) {
        components.imply("meridiem", Meridiem.PM);
      } else if (hour <= 12) {
        components.imply("meridiem", Meridiem.AM);
      }
    }
    if (components.date().getTime() < result.start.date().getTime()) {
      components.imply("day", components.get("day") + 1);
    }
    return components;
  }
  checkAndReturnWithoutFollowingPattern(result) {
    if (result.text.match(/^\d$/)) {
      return null;
    }
    if (result.text.match(/^\d\d\d+$/)) {
      return null;
    }
    if (result.text.match(/\d[apAP]$/)) {
      return null;
    }
    const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)$/);
    if (endingWithNumbers) {
      const endingNumbers = endingWithNumbers[1];
      if (this.strictMode) {
        return null;
      }
      if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
        return null;
      }
      const endingNumberVal = parseInt(endingNumbers);
      if (endingNumberVal > 24) {
        return null;
      }
    }
    return result;
  }
  checkAndReturnWithFollowingPattern(result) {
    if (result.text.match(/^\d+-\d+$/)) {
      return null;
    }
    const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)\s*-\s*(\d[\d.]+)$/);
    if (endingWithNumbers) {
      if (this.strictMode) {
        return null;
      }
      const startingNumbers = endingWithNumbers[1];
      const endingNumbers = endingWithNumbers[2];
      if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
        return null;
      }
      const endingNumberVal = parseInt(endingNumbers);
      const startingNumberVal = parseInt(startingNumbers);
      if (endingNumberVal > 24 || startingNumberVal > 24) {
        return null;
      }
    }
    return result;
  }
  cachedPrimaryPrefix = null;
  cachedPrimarySuffix = null;
  cachedPrimaryTimePattern = null;
  getPrimaryTimePatternThroughCache() {
    const primaryPrefix = this.primaryPrefix();
    const primarySuffix = this.primarySuffix();
    if (this.cachedPrimaryPrefix === primaryPrefix && this.cachedPrimarySuffix === primarySuffix) {
      return this.cachedPrimaryTimePattern;
    }
    this.cachedPrimaryTimePattern = primaryTimePattern(this.primaryPatternLeftBoundary(), primaryPrefix, primarySuffix, this.patternFlags());
    this.cachedPrimaryPrefix = primaryPrefix;
    this.cachedPrimarySuffix = primarySuffix;
    return this.cachedPrimaryTimePattern;
  }
  cachedFollowingPhase = null;
  cachedFollowingSuffix = null;
  cachedFollowingTimePatten = null;
  getFollowingTimePatternThroughCache() {
    const followingPhase = this.followingPhase();
    const followingSuffix = this.followingSuffix();
    if (this.cachedFollowingPhase === followingPhase && this.cachedFollowingSuffix === followingSuffix) {
      return this.cachedFollowingTimePatten;
    }
    this.cachedFollowingTimePatten = followingTimePatten(followingPhase, followingSuffix);
    this.cachedFollowingPhase = followingPhase;
    this.cachedFollowingSuffix = followingSuffix;
    return this.cachedFollowingTimePatten;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeExpressionParser.js
var ENTimeExpressionParser = class extends AbstractTimeExpressionParser {
  constructor(strictMode) {
    super(strictMode);
  }
  followingPhase() {
    return "\\s*(?:\\-|\\\u2013|\\~|\\\u301C|to|until|through|till|\\?)\\s*";
  }
  primaryPrefix() {
    return "(?:(?:at|from)\\s*)??";
  }
  primarySuffix() {
    return "(?:\\s*(?:o\\W*clock|at\\s*night|in\\s*the\\s*(?:morning|afternoon)))?(?!/)(?=\\W|$)";
  }
  extractPrimaryTimeComponents(context, match) {
    const components = super.extractPrimaryTimeComponents(context, match);
    if (!components) {
      return components;
    }
    if (match[0].endsWith("night")) {
      const hour = components.get("hour");
      if (hour >= 6 && hour < 12) {
        components.assign("hour", components.get("hour") + 12);
        components.assign("meridiem", Meridiem.PM);
      } else if (hour < 6) {
        components.assign("meridiem", Meridiem.AM);
      }
    }
    if (match[0].endsWith("afternoon")) {
      components.assign("meridiem", Meridiem.PM);
      const hour = components.get("hour");
      if (hour >= 0 && hour <= 6) {
        components.assign("hour", components.get("hour") + 12);
      }
    }
    if (match[0].endsWith("morning")) {
      components.assign("meridiem", Meridiem.AM);
      const hour = components.get("hour");
      if (hour < 12) {
        components.assign("hour", components.get("hour"));
      }
    }
    return components.addTag("parser/ENTimeExpressionParser");
  }
  extractFollowingTimeComponents(context, match, result) {
    const followingComponents = super.extractFollowingTimeComponents(context, match, result);
    if (followingComponents) {
      followingComponents.addTag("parser/ENTimeExpressionParser");
    }
    return followingComponents;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitAgoFormatParser.js
var PATTERN6 = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
var STRICT_PATTERN = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
var ENTimeUnitAgoFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN : PATTERN6;
  }
  innerExtract(context, match) {
    const duration = parseDuration(match[1]);
    if (!duration) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, reverseDuration(duration));
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitLaterFormatParser.js
var PATTERN7 = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:later|after|from now|henceforth|forward|out)(?=(?:\\W|$))`, "i");
var STRICT_PATTERN2 = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(later|after|from now)(?=\\W|$)`, "i");
var GROUP_NUM_TIMEUNITS = 1;
var ENTimeUnitLaterFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  innerPattern() {
    return this.strictMode ? STRICT_PATTERN2 : PATTERN7;
  }
  innerExtract(context, match) {
    const timeUnits = parseDuration(match[GROUP_NUM_TIMEUNITS]);
    if (!timeUnits) {
      return null;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
  }
};

// node_modules/chrono-node/dist/esm/common/abstractRefiners.js
var Filter = class {
  refine(context, results) {
    return results.filter((r) => this.isValid(context, r));
  }
};
var MergingRefiner = class {
  refine(context, results) {
    if (results.length < 2) {
      return results;
    }
    const mergedResults = [];
    let curResult = results[0];
    let nextResult = null;
    for (let i = 1; i < results.length; i++) {
      nextResult = results[i];
      const textBetween = context.text.substring(curResult.index + curResult.text.length, nextResult.index);
      if (!this.shouldMergeResults(textBetween, curResult, nextResult, context)) {
        mergedResults.push(curResult);
        curResult = nextResult;
      } else {
        const left = curResult;
        const right = nextResult;
        const mergedResult = this.mergeResults(textBetween, left, right, context);
        context.debug(() => {
          console.log(`${this.constructor.name} merged ${left} and ${right} into ${mergedResult}`);
        });
        curResult = mergedResult;
      }
    }
    if (curResult != null) {
      mergedResults.push(curResult);
    }
    return mergedResults;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/AbstractMergeDateRangeRefiner.js
var AbstractMergeDateRangeRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    return !currentResult.end && !nextResult.end && textBetween.match(this.patternBetween()) != null;
  }
  mergeResults(textBetween, fromResult, toResult) {
    if (!fromResult.start.isOnlyWeekdayComponent() && !toResult.start.isOnlyWeekdayComponent()) {
      toResult.start.getCertainComponents().forEach((key) => {
        if (!fromResult.start.isCertain(key)) {
          fromResult.start.imply(key, toResult.start.get(key));
        }
      });
      fromResult.start.getCertainComponents().forEach((key) => {
        if (!toResult.start.isCertain(key)) {
          toResult.start.imply(key, fromResult.start.get(key));
        }
      });
    }
    if (fromResult.start.date() > toResult.start.date()) {
      let fromDate = fromResult.start.date();
      let toDate = toResult.start.date();
      if (toResult.start.isOnlyWeekdayComponent() && addDuration(toDate, { day: 7 }) > fromDate) {
        toDate = addDuration(toDate, { day: 7 });
        toResult.start.imply("day", toDate.getDate());
        toResult.start.imply("month", toDate.getMonth() + 1);
        toResult.start.imply("year", toDate.getFullYear());
      } else if (fromResult.start.isOnlyWeekdayComponent() && addDuration(fromDate, { day: -7 }) < toDate) {
        fromDate = addDuration(fromDate, { day: -7 });
        fromResult.start.imply("day", fromDate.getDate());
        fromResult.start.imply("month", fromDate.getMonth() + 1);
        fromResult.start.imply("year", fromDate.getFullYear());
      } else if (toResult.start.isDateWithUnknownYear() && addDuration(toDate, { year: 1 }) > fromDate) {
        toDate = addDuration(toDate, { year: 1 });
        toResult.start.imply("year", toDate.getFullYear());
      } else if (fromResult.start.isDateWithUnknownYear() && addDuration(fromDate, { year: -1 }) < toDate) {
        fromDate = addDuration(fromDate, { year: -1 });
        fromResult.start.imply("year", fromDate.getFullYear());
      } else {
        [toResult, fromResult] = [fromResult, toResult];
      }
    }
    const result = fromResult.clone();
    result.start = fromResult.start;
    result.end = toResult.start;
    result.index = Math.min(fromResult.index, toResult.index);
    if (fromResult.index < toResult.index) {
      result.text = fromResult.text + textBetween + toResult.text;
    } else {
      result.text = toResult.text + textBetween + fromResult.text;
    }
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeDateRangeRefiner.js
var ENMergeDateRangeRefiner = class extends AbstractMergeDateRangeRefiner {
  patternBetween() {
    return /^\s*(to|-|–|until|through|till)\s*$/i;
  }
};

// node_modules/chrono-node/dist/esm/calculation/mergingCalculation.js
function mergeDateTimeResult(dateResult, timeResult) {
  const result = dateResult.clone();
  const beginDate = dateResult.start;
  const beginTime = timeResult.start;
  result.start = mergeDateTimeComponent(beginDate, beginTime);
  if (dateResult.end != null || timeResult.end != null) {
    const endDate = dateResult.end == null ? dateResult.start : dateResult.end;
    const endTime = timeResult.end == null ? timeResult.start : timeResult.end;
    const endDateTime = mergeDateTimeComponent(endDate, endTime);
    if (dateResult.end == null && endDateTime.date().getTime() < result.start.date().getTime()) {
      const nextDay = new Date(endDateTime.date().getTime());
      nextDay.setDate(nextDay.getDate() + 1);
      if (endDateTime.isCertain("day")) {
        assignSimilarDate(endDateTime, nextDay);
      } else {
        implySimilarDate(endDateTime, nextDay);
      }
    }
    result.end = endDateTime;
  }
  return result;
}
function mergeDateTimeComponent(dateComponent, timeComponent) {
  const dateTimeComponent = dateComponent.clone();
  if (timeComponent.isCertain("hour")) {
    dateTimeComponent.assign("hour", timeComponent.get("hour"));
    dateTimeComponent.assign("minute", timeComponent.get("minute"));
    if (timeComponent.isCertain("second")) {
      dateTimeComponent.assign("second", timeComponent.get("second"));
      if (timeComponent.isCertain("millisecond")) {
        dateTimeComponent.assign("millisecond", timeComponent.get("millisecond"));
      } else {
        dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
      }
    } else {
      dateTimeComponent.imply("second", timeComponent.get("second"));
      dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
    }
  } else {
    dateTimeComponent.imply("hour", timeComponent.get("hour"));
    dateTimeComponent.imply("minute", timeComponent.get("minute"));
    dateTimeComponent.imply("second", timeComponent.get("second"));
    dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
  }
  if (timeComponent.isCertain("timezoneOffset")) {
    dateTimeComponent.assign("timezoneOffset", timeComponent.get("timezoneOffset"));
  }
  if (timeComponent.isCertain("meridiem")) {
    dateTimeComponent.assign("meridiem", timeComponent.get("meridiem"));
  } else if (timeComponent.get("meridiem") != null && dateTimeComponent.get("meridiem") == null) {
    dateTimeComponent.imply("meridiem", timeComponent.get("meridiem"));
  }
  if (dateTimeComponent.get("meridiem") == Meridiem.PM && dateTimeComponent.get("hour") < 12) {
    if (timeComponent.isCertain("hour")) {
      dateTimeComponent.assign("hour", dateTimeComponent.get("hour") + 12);
    } else {
      dateTimeComponent.imply("hour", dateTimeComponent.get("hour") + 12);
    }
  }
  dateTimeComponent.addTags(dateComponent.tags());
  dateTimeComponent.addTags(timeComponent.tags());
  return dateTimeComponent;
}

// node_modules/chrono-node/dist/esm/common/refiners/AbstractMergeDateTimeRefiner.js
var AbstractMergeDateTimeRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    return (currentResult.start.isOnlyDate() && nextResult.start.isOnlyTime() || nextResult.start.isOnlyDate() && currentResult.start.isOnlyTime()) && textBetween.match(this.patternBetween()) != null;
  }
  mergeResults(textBetween, currentResult, nextResult) {
    const result = currentResult.start.isOnlyDate() ? mergeDateTimeResult(currentResult, nextResult) : mergeDateTimeResult(nextResult, currentResult);
    result.index = currentResult.index;
    result.text = currentResult.text + textBetween + nextResult.text;
    return result;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeDateTimeRefiner.js
var ENMergeDateTimeRefiner = class extends AbstractMergeDateTimeRefiner {
  patternBetween() {
    return new RegExp("^\\s*(T|at|after|before|on|of|,|-|\\.|\u2219|:)?\\s*$");
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/ExtractTimezoneAbbrRefiner.js
var TIMEZONE_NAME_PATTERN = new RegExp("^\\s*,?\\s*\\(?([A-Z]{2,4})\\)?(?=\\W|$)", "i");
var ExtractTimezoneAbbrRefiner = class {
  timezoneOverrides;
  constructor(timezoneOverrides) {
    this.timezoneOverrides = timezoneOverrides;
  }
  refine(context, results) {
    const timezoneOverrides = context.option.timezones ?? {};
    results.forEach((result) => {
      const suffix = context.text.substring(result.index + result.text.length);
      const match = TIMEZONE_NAME_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      const timezoneAbbr = match[1].toUpperCase();
      const refDate = result.start.date() ?? result.refDate ?? /* @__PURE__ */ new Date();
      const tzOverrides = { ...this.timezoneOverrides, ...timezoneOverrides };
      const extractedTimezoneOffset = toTimezoneOffset(timezoneAbbr, refDate, tzOverrides);
      if (extractedTimezoneOffset == null) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting timezone: '${timezoneAbbr}' into: ${extractedTimezoneOffset} for: ${result.start}`);
      });
      const currentTimezoneOffset = result.start.get("timezoneOffset");
      if (currentTimezoneOffset !== null && extractedTimezoneOffset != currentTimezoneOffset) {
        if (result.start.isCertain("timezoneOffset")) {
          return;
        }
        if (timezoneAbbr != match[1]) {
          return;
        }
      }
      if (result.start.isOnlyDate()) {
        if (timezoneAbbr != match[1]) {
          return;
        }
      }
      result.text += match[0];
      if (!result.start.isCertain("timezoneOffset")) {
        result.start.assign("timezoneOffset", extractedTimezoneOffset);
      }
      if (result.end != null && !result.end.isCertain("timezoneOffset")) {
        result.end.assign("timezoneOffset", extractedTimezoneOffset);
      }
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/ExtractTimezoneOffsetRefiner.js
var TIMEZONE_OFFSET_PATTERN = new RegExp("^\\s*(?:\\(?(?:GMT|UTC)\\s?)?([+-])(\\d{1,2})(?::?(\\d{2}))?\\)?", "i");
var TIMEZONE_OFFSET_SIGN_GROUP = 1;
var TIMEZONE_OFFSET_HOUR_OFFSET_GROUP = 2;
var TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP = 3;
var ExtractTimezoneOffsetRefiner = class {
  refine(context, results) {
    results.forEach(function(result) {
      if (result.start.isCertain("timezoneOffset")) {
        return;
      }
      const suffix = context.text.substring(result.index + result.text.length);
      const match = TIMEZONE_OFFSET_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting timezone: '${match[0]}' into : ${result}`);
      });
      const hourOffset = parseInt(match[TIMEZONE_OFFSET_HOUR_OFFSET_GROUP]);
      const minuteOffset = parseInt(match[TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP] || "0");
      let timezoneOffset = hourOffset * 60 + minuteOffset;
      if (timezoneOffset > 14 * 60) {
        return;
      }
      if (match[TIMEZONE_OFFSET_SIGN_GROUP] === "-") {
        timezoneOffset = -timezoneOffset;
      }
      if (result.end != null) {
        result.end.assign("timezoneOffset", timezoneOffset);
      }
      result.start.assign("timezoneOffset", timezoneOffset);
      result.text += match[0];
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/OverlapRemovalRefiner.js
var OverlapRemovalRefiner = class {
  refine(context, results) {
    if (results.length < 2) {
      return results;
    }
    const filteredResults = [];
    let prevResult = results[0];
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      if (result.index >= prevResult.index + prevResult.text.length) {
        filteredResults.push(prevResult);
        prevResult = result;
        continue;
      }
      let kept = null;
      let removed = null;
      if (result.text.length > prevResult.text.length) {
        kept = result;
        removed = prevResult;
      } else {
        kept = prevResult;
        removed = result;
      }
      context.debug(() => {
        console.log(`${this.constructor.name} remove ${removed} by ${kept}`);
      });
      prevResult = kept;
    }
    if (prevResult != null) {
      filteredResults.push(prevResult);
    }
    return filteredResults;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/ForwardDateRefiner.js
var ForwardDateRefiner = class {
  refine(context, results) {
    if (!context.option.forwardDate) {
      return results;
    }
    results.forEach((result) => {
      let refDate = context.reference.getDateWithAdjustedTimezone();
      if (result.start.isOnlyTime() && context.reference.instant > result.start.date()) {
        const refDate2 = context.reference.getDateWithAdjustedTimezone();
        const refFollowingDay = new Date(refDate2);
        refFollowingDay.setDate(refFollowingDay.getDate() + 1);
        implySimilarDate(result.start, refFollowingDay);
        context.debug(() => {
          console.log(`${this.constructor.name} adjusted ${result} time from the ref date (${refDate2}) to the following day (${refFollowingDay})`);
        });
        if (result.end && result.end.isOnlyTime()) {
          implySimilarDate(result.end, refFollowingDay);
          if (result.start.date() > result.end.date()) {
            refFollowingDay.setDate(refFollowingDay.getDate() + 1);
            implySimilarDate(result.end, refFollowingDay);
          }
        }
      }
      if (result.start.isOnlyWeekdayComponent() && refDate > result.start.date()) {
        let daysToAdd = result.start.get("weekday") - refDate.getDay();
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        refDate = addDuration(refDate, { day: daysToAdd });
        implySimilarDate(result.start, refDate);
        context.debug(() => {
          console.log(`${this.constructor.name} adjusted ${result} weekday (${result.start})`);
        });
        if (result.end && result.end.isOnlyWeekdayComponent()) {
          let daysToAdd2 = result.end.get("weekday") - refDate.getDay();
          if (daysToAdd2 <= 0) {
            daysToAdd2 += 7;
          }
          refDate = addDuration(refDate, { day: daysToAdd2 });
          implySimilarDate(result.end, refDate);
          context.debug(() => {
            console.log(`${this.constructor.name} adjusted ${result} weekday (${result.end})`);
          });
        }
      }
      if (result.start.isDateWithUnknownYear() && refDate > result.start.date()) {
        for (let i = 0; i < 3 && refDate > result.start.date(); i++) {
          result.start.imply("year", result.start.get("year") + 1);
          context.debug(() => {
            console.log(`${this.constructor.name} adjusted ${result} year (${result.start})`);
          });
          if (result.end && !result.end.isCertain("year")) {
            result.end.imply("year", result.end.get("year") + 1);
            context.debug(() => {
              console.log(`${this.constructor.name} adjusted ${result} month (${result.start})`);
            });
          }
        }
      }
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/UnlikelyFormatFilter.js
var UnlikelyFormatFilter = class extends Filter {
  strictMode;
  constructor(strictMode) {
    super();
    this.strictMode = strictMode;
  }
  isValid(context, result) {
    if (result.text.replace(" ", "").match(/^\d*(\.\d*)?$/)) {
      context.debug(() => {
        console.log(`Removing unlikely result '${result.text}'`);
      });
      return false;
    }
    if (!result.start.isValidDate()) {
      context.debug(() => {
        console.log(`Removing invalid result: ${result} (${result.start})`);
      });
      return false;
    }
    if (result.end && !result.end.isValidDate()) {
      context.debug(() => {
        console.log(`Removing invalid result: ${result} (${result.end})`);
      });
      return false;
    }
    if (this.strictMode) {
      return this.isStrictModeValid(context, result);
    }
    return true;
  }
  isStrictModeValid(context, result) {
    if (result.start.isOnlyWeekdayComponent()) {
      context.debug(() => {
        console.log(`(Strict) Removing weekday only component: ${result} (${result.end})`);
      });
      return false;
    }
    return true;
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/ISOFormatParser.js
var PATTERN8 = new RegExp("([0-9]{4})\\-([0-9]{1,2})\\-([0-9]{1,2})(?:T([0-9]{1,2}):([0-9]{1,2})(?::([0-9]{1,2})(?:\\.(\\d{1,4}))?)?(Z|([+-]\\d{2}):?(\\d{2})?)?)?(?=\\W|$)", "i");
var YEAR_NUMBER_GROUP2 = 1;
var MONTH_NUMBER_GROUP2 = 2;
var DATE_NUMBER_GROUP2 = 3;
var HOUR_NUMBER_GROUP = 4;
var MINUTE_NUMBER_GROUP = 5;
var SECOND_NUMBER_GROUP = 6;
var MILLISECOND_NUMBER_GROUP = 7;
var TZD_GROUP = 8;
var TZD_HOUR_OFFSET_GROUP = 9;
var TZD_MINUTE_OFFSET_GROUP = 10;
var ISOFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN8;
  }
  innerExtract(context, match) {
    const components = context.createParsingComponents({
      "year": parseInt(match[YEAR_NUMBER_GROUP2]),
      "month": parseInt(match[MONTH_NUMBER_GROUP2]),
      "day": parseInt(match[DATE_NUMBER_GROUP2])
    });
    if (match[HOUR_NUMBER_GROUP] != null) {
      components.assign("hour", parseInt(match[HOUR_NUMBER_GROUP]));
      components.assign("minute", parseInt(match[MINUTE_NUMBER_GROUP]));
      if (match[SECOND_NUMBER_GROUP] != null) {
        components.assign("second", parseInt(match[SECOND_NUMBER_GROUP]));
      }
      if (match[MILLISECOND_NUMBER_GROUP] != null) {
        components.assign("millisecond", parseInt(match[MILLISECOND_NUMBER_GROUP]));
      }
      if (match[TZD_GROUP] != null) {
        let offset = 0;
        if (match[TZD_HOUR_OFFSET_GROUP]) {
          const hourOffset = parseInt(match[TZD_HOUR_OFFSET_GROUP]);
          let minuteOffset = 0;
          if (match[TZD_MINUTE_OFFSET_GROUP] != null) {
            minuteOffset = parseInt(match[TZD_MINUTE_OFFSET_GROUP]);
          }
          offset = hourOffset * 60;
          if (offset < 0) {
            offset -= minuteOffset;
          } else {
            offset += minuteOffset;
          }
        }
        components.assign("timezoneOffset", offset);
      }
    }
    return components.addTag("parser/ISOFormatParser");
  }
};

// node_modules/chrono-node/dist/esm/common/refiners/MergeWeekdayComponentRefiner.js
var MergeWeekdayComponentRefiner = class extends MergingRefiner {
  mergeResults(textBetween, currentResult, nextResult) {
    const newResult = nextResult.clone();
    newResult.index = currentResult.index;
    newResult.text = currentResult.text + textBetween + newResult.text;
    newResult.start.assign("weekday", currentResult.start.get("weekday"));
    if (newResult.end) {
      newResult.end.assign("weekday", currentResult.start.get("weekday"));
    }
    return newResult;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    const weekdayThenNormalDate = currentResult.start.isOnlyWeekdayComponent() && !currentResult.start.isCertain("hour") && nextResult.start.isCertain("day");
    return weekdayThenNormalDate && textBetween.match(/^,?\s*$/) != null;
  }
};

// node_modules/chrono-node/dist/esm/configurations.js
function includeCommonConfiguration(configuration2, strictMode = false) {
  configuration2.parsers.unshift(new ISOFormatParser());
  configuration2.refiners.unshift(new MergeWeekdayComponentRefiner());
  configuration2.refiners.unshift(new ExtractTimezoneOffsetRefiner());
  configuration2.refiners.unshift(new OverlapRemovalRefiner());
  configuration2.refiners.push(new ExtractTimezoneAbbrRefiner());
  configuration2.refiners.push(new OverlapRemovalRefiner());
  configuration2.refiners.push(new ForwardDateRefiner());
  configuration2.refiners.push(new UnlikelyFormatFilter(strictMode));
  return configuration2;
}

// node_modules/chrono-node/dist/esm/common/casualReferences.js
function now(reference) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  assignSimilarTime(component, targetDate);
  component.assign("timezoneOffset", reference.getTimezoneOffset());
  component.addTag("casualReference/now");
  return component;
}
function today(reference) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  implySimilarTime(component, targetDate);
  component.delete("meridiem");
  component.addTag("casualReference/today");
  return component;
}
function yesterday(reference) {
  return theDayBefore(reference, 1).addTag("casualReference/yesterday");
}
function tomorrow(reference) {
  return theDayAfter(reference, 1).addTag("casualReference/tomorrow");
}
function theDayBefore(reference, numDay) {
  return theDayAfter(reference, -numDay);
}
function theDayAfter(reference, nDays) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  const newDate = new Date(targetDate.getTime());
  newDate.setDate(newDate.getDate() + nDays);
  assignSimilarDate(component, newDate);
  implySimilarTime(component, newDate);
  component.delete("meridiem");
  return component;
}
function tonight(reference, implyHour = 22) {
  const targetDate = reference.getDateWithAdjustedTimezone();
  const component = new ParsingComponents(reference, {});
  assignSimilarDate(component, targetDate);
  component.imply("hour", implyHour);
  component.imply("meridiem", Meridiem.PM);
  component.addTag("casualReference/tonight");
  return component;
}
function evening(reference, implyHour = 20) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.PM);
  component.imply("hour", implyHour);
  component.addTag("casualReference/evening");
  return component;
}
function midnight(reference) {
  const component = new ParsingComponents(reference, {});
  if (reference.getDateWithAdjustedTimezone().getHours() > 2) {
    component.addDurationAsImplied({ day: 1 });
  }
  component.assign("hour", 0);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/midnight");
  return component;
}
function morning(reference, implyHour = 6) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.AM);
  component.imply("hour", implyHour);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/morning");
  return component;
}
function afternoon(reference, implyHour = 15) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.PM);
  component.imply("hour", implyHour);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/afternoon");
  return component;
}
function noon(reference) {
  const component = new ParsingComponents(reference, {});
  component.imply("meridiem", Meridiem.AM);
  component.assign("hour", 12);
  component.imply("minute", 0);
  component.imply("second", 0);
  component.imply("millisecond", 0);
  component.addTag("casualReference/noon");
  return component;
}

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENCasualDateParser.js
var PATTERN9 = /(now|today|tonight|tomorrow|overmorrow|tmr|tmrw|yesterday|last\s*night)(?=\W|$)/i;
var ENCasualDateParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern(context) {
    return PATTERN9;
  }
  innerExtract(context, match) {
    let targetDate = context.refDate;
    const lowerText = match[0].toLowerCase();
    let component = context.createParsingComponents();
    switch (lowerText) {
      case "now":
        component = now(context.reference);
        break;
      case "today":
        component = today(context.reference);
        break;
      case "yesterday":
        component = yesterday(context.reference);
        break;
      case "tomorrow":
      case "tmr":
      case "tmrw":
        component = tomorrow(context.reference);
        break;
      case "tonight":
        component = tonight(context.reference);
        break;
      case "overmorrow":
        component = theDayAfter(context.reference, 2);
        break;
      default:
        if (lowerText.match(/last\s*night/)) {
          if (targetDate.getHours() > 6) {
            const previousDay = new Date(targetDate.getTime());
            previousDay.setDate(previousDay.getDate() - 1);
            targetDate = previousDay;
          }
          assignSimilarDate(component, targetDate);
          component.imply("hour", 0);
        }
        break;
    }
    component.addTag("parser/ENCasualDateParser");
    return component;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENCasualTimeParser.js
var PATTERN10 = /(?:this)?\s{0,3}(morning|afternoon|evening|night|midnight|midday|noon)(?=\W|$)/i;
var ENCasualTimeParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN10;
  }
  innerExtract(context, match) {
    let component = null;
    switch (match[1].toLowerCase()) {
      case "afternoon":
        component = afternoon(context.reference);
        break;
      case "evening":
      case "night":
        component = evening(context.reference);
        break;
      case "midnight":
        component = midnight(context.reference);
        break;
      case "morning":
        component = morning(context.reference);
        break;
      case "noon":
      case "midday":
        component = noon(context.reference);
        break;
    }
    if (component) {
      component.addTag("parser/ENCasualTimeParser");
    }
    return component;
  }
};

// node_modules/chrono-node/dist/esm/calculation/weekdays.js
function createParsingComponentsAtWeekday(reference, weekday, modifier) {
  const refDate = reference.getDateWithAdjustedTimezone();
  const daysToWeekday = getDaysToWeekday(refDate, weekday, modifier);
  let components = new ParsingComponents(reference);
  components = components.addDurationAsImplied({ day: daysToWeekday });
  components.assign("weekday", weekday);
  return components;
}
function getDaysToWeekday(refDate, weekday, modifier) {
  const refWeekday = refDate.getDay();
  switch (modifier) {
    case "this":
      return getDaysForwardToWeekday(refDate, weekday);
    case "last":
      return getBackwardDaysToWeekday(refDate, weekday);
    case "next":
      if (refWeekday == Weekday.SUNDAY) {
        return weekday == Weekday.SUNDAY ? 7 : weekday;
      }
      if (refWeekday == Weekday.SATURDAY) {
        if (weekday == Weekday.SATURDAY)
          return 7;
        if (weekday == Weekday.SUNDAY)
          return 8;
        return 1 + weekday;
      }
      if (weekday < refWeekday && weekday != Weekday.SUNDAY) {
        return getDaysForwardToWeekday(refDate, weekday);
      } else {
        return getDaysForwardToWeekday(refDate, weekday) + 7;
      }
  }
  return getDaysToWeekdayClosest(refDate, weekday);
}
function getDaysToWeekdayClosest(refDate, weekday) {
  const backward = getBackwardDaysToWeekday(refDate, weekday);
  const forward = getDaysForwardToWeekday(refDate, weekday);
  return forward < -backward ? forward : backward;
}
function getDaysForwardToWeekday(refDate, weekday) {
  const refWeekday = refDate.getDay();
  let forwardCount = weekday - refWeekday;
  if (forwardCount < 0) {
    forwardCount += 7;
  }
  return forwardCount;
}
function getBackwardDaysToWeekday(refDate, weekday) {
  const refWeekday = refDate.getDay();
  let backwardCount = weekday - refWeekday;
  if (backwardCount >= 0) {
    backwardCount -= 7;
  }
  return backwardCount;
}

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENWeekdayParser.js
var PATTERN11 = new RegExp(`(?:(?:\\,|\\(|\\\uFF08)\\s*)?(?:on\\s*?)?(?:(this|last|past|next)\\s*)?(${matchAnyPattern(WEEKDAY_DICTIONARY)}|weekend|weekday)(?:\\s*(?:\\,|\\)|\\\uFF09))?(?:\\s*(this|last|past|next)\\s*week)?(?=\\W|$)`, "i");
var PREFIX_GROUP2 = 1;
var WEEKDAY_GROUP = 2;
var POSTFIX_GROUP = 3;
var ENWeekdayParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN11;
  }
  innerExtract(context, match) {
    const prefix = match[PREFIX_GROUP2];
    const postfix = match[POSTFIX_GROUP];
    let modifierWord = prefix || postfix;
    modifierWord = modifierWord || "";
    modifierWord = modifierWord.toLowerCase();
    let modifier = null;
    if (modifierWord == "last" || modifierWord == "past") {
      modifier = "last";
    } else if (modifierWord == "next") {
      modifier = "next";
    } else if (modifierWord == "this") {
      modifier = "this";
    }
    const weekday_word = match[WEEKDAY_GROUP].toLowerCase();
    let weekday;
    if (WEEKDAY_DICTIONARY[weekday_word] !== void 0) {
      weekday = WEEKDAY_DICTIONARY[weekday_word];
    } else if (weekday_word == "weekend") {
      weekday = modifier == "last" ? Weekday.SUNDAY : Weekday.SATURDAY;
    } else if (weekday_word == "weekday") {
      const refWeekday = context.reference.getDateWithAdjustedTimezone().getDay();
      if (refWeekday == Weekday.SUNDAY || refWeekday == Weekday.SATURDAY) {
        weekday = modifier == "last" ? Weekday.FRIDAY : Weekday.MONDAY;
      } else {
        weekday = refWeekday - 1;
        weekday = modifier == "last" ? weekday - 1 : weekday + 1;
        weekday = weekday % 5 + 1;
      }
    } else {
      return null;
    }
    return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENRelativeDateFormatParser.js
var PATTERN12 = new RegExp(`(this|last|past|next|after\\s*this)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY)})(?=\\s*)(?=\\W|$)`, "i");
var MODIFIER_WORD_GROUP = 1;
var RELATIVE_WORD_GROUP = 2;
var ENRelativeDateFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  innerPattern() {
    return PATTERN12;
  }
  innerExtract(context, match) {
    const modifier = match[MODIFIER_WORD_GROUP].toLowerCase();
    const unitWord = match[RELATIVE_WORD_GROUP].toLowerCase();
    const timeunit = TIME_UNIT_DICTIONARY[unitWord];
    if (modifier == "next" || modifier.startsWith("after")) {
      const timeUnits = {};
      timeUnits[timeunit] = 1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    if (modifier == "last" || modifier == "past") {
      const timeUnits = {};
      timeUnits[timeunit] = -1;
      return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
    const components = context.createParsingComponents();
    let date = new Date(context.reference.instant.getTime());
    if (unitWord.match(/week/i)) {
      date.setDate(date.getDate() - date.getDay());
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.imply("year", date.getFullYear());
    } else if (unitWord.match(/month/i)) {
      date.setDate(1);
      components.imply("day", date.getDate());
      components.assign("year", date.getFullYear());
      components.assign("month", date.getMonth() + 1);
    } else if (unitWord.match(/year/i)) {
      date.setDate(1);
      date.setMonth(0);
      components.imply("day", date.getDate());
      components.imply("month", date.getMonth() + 1);
      components.assign("year", date.getFullYear());
    }
    return components;
  }
};

// node_modules/chrono-node/dist/esm/common/parsers/SlashDateFormatParser.js
var PATTERN13 = new RegExp("([^\\d]|^)([0-3]{0,1}[0-9]{1})[\\/\\.\\-]([0-3]{0,1}[0-9]{1})(?:[\\/\\.\\-]([0-9]{4}|[0-9]{2}))?(\\W|$)", "i");
var OPENING_GROUP = 1;
var ENDING_GROUP = 5;
var FIRST_NUMBERS_GROUP = 2;
var SECOND_NUMBERS_GROUP = 3;
var YEAR_GROUP5 = 4;
var SlashDateFormatParser = class {
  groupNumberMonth;
  groupNumberDay;
  constructor(littleEndian) {
    this.groupNumberMonth = littleEndian ? SECOND_NUMBERS_GROUP : FIRST_NUMBERS_GROUP;
    this.groupNumberDay = littleEndian ? FIRST_NUMBERS_GROUP : SECOND_NUMBERS_GROUP;
  }
  pattern() {
    return PATTERN13;
  }
  extract(context, match) {
    const index = match.index + match[OPENING_GROUP].length;
    const indexEnd = match.index + match[0].length - match[ENDING_GROUP].length;
    if (index > 0) {
      const textBefore = context.text.substring(0, index);
      if (textBefore.match("\\d/?$")) {
        return;
      }
    }
    if (indexEnd < context.text.length) {
      const textAfter = context.text.substring(indexEnd);
      if (textAfter.match("^/?\\d")) {
        return;
      }
    }
    const text = context.text.substring(index, indexEnd);
    if (text.match(/^\d\.\d$/) || text.match(/^\d\.\d{1,2}\.\d{1,2}\s*$/)) {
      return;
    }
    if (!match[YEAR_GROUP5] && text.indexOf("/") < 0) {
      return;
    }
    const result = context.createParsingResult(index, text);
    let month = parseInt(match[this.groupNumberMonth]);
    let day = parseInt(match[this.groupNumberDay]);
    if (month < 1 || month > 12) {
      if (month > 12) {
        if (day >= 1 && day <= 12 && month <= 31) {
          [day, month] = [month, day];
        } else {
          return null;
        }
      }
    }
    if (day < 1 || day > 31) {
      return null;
    }
    result.start.assign("day", day);
    result.start.assign("month", month);
    if (match[YEAR_GROUP5]) {
      const rawYearNumber = parseInt(match[YEAR_GROUP5]);
      const year = findMostLikelyADYear(rawYearNumber);
      result.start.assign("year", year);
    } else {
      const year = findYearClosestToRef(context.refDate, day, month);
      result.start.imply("year", year);
    }
    return result.addTag("parser/SlashDateFormatParser");
  }
};

// node_modules/chrono-node/dist/esm/locales/en/parsers/ENTimeUnitCasualRelativeFormatParser.js
var PATTERN14 = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
var PATTERN_NO_ABBR = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
var ENTimeUnitCasualRelativeFormatParser = class extends AbstractParserWithWordBoundaryChecking {
  allowAbbreviations;
  constructor(allowAbbreviations = true) {
    super();
    this.allowAbbreviations = allowAbbreviations;
  }
  innerPattern() {
    return this.allowAbbreviations ? PATTERN14 : PATTERN_NO_ABBR;
  }
  innerExtract(context, match) {
    const prefix = match[1].toLowerCase();
    let duration = parseDuration(match[2]);
    if (!duration) {
      return null;
    }
    switch (prefix) {
      case "last":
      case "past":
      case "-":
        duration = reverseDuration(duration);
        break;
    }
    return ParsingComponents.createRelativeFromReference(context.reference, duration);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeRelativeAfterDateRefiner.js
function IsPositiveFollowingReference(result) {
  return result.text.match(/^[+-]/i) != null;
}
function IsNegativeFollowingReference(result) {
  return result.text.match(/^-/i) != null;
}
var ENMergeRelativeAfterDateRefiner = class extends MergingRefiner {
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(/^\s*$/i)) {
      return false;
    }
    return IsPositiveFollowingReference(nextResult) || IsNegativeFollowingReference(nextResult);
  }
  mergeResults(textBetween, currentResult, nextResult, context) {
    let timeUnits = parseDuration(nextResult.text);
    if (IsNegativeFollowingReference(nextResult)) {
      timeUnits = reverseDuration(timeUnits);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(currentResult.start.date()), timeUnits);
    return new ParsingResult(currentResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENMergeRelativeFollowByDateRefiner.js
function hasImpliedEarlierReferenceDate(result) {
  return result.text.match(/\s+(before|from)$/i) != null;
}
function hasImpliedLaterReferenceDate(result) {
  return result.text.match(/\s+(after|since)$/i) != null;
}
var ENMergeRelativeFollowByDateRefiner = class extends MergingRefiner {
  patternBetween() {
    return /^\s*$/i;
  }
  shouldMergeResults(textBetween, currentResult, nextResult) {
    if (!textBetween.match(this.patternBetween())) {
      return false;
    }
    if (!hasImpliedEarlierReferenceDate(currentResult) && !hasImpliedLaterReferenceDate(currentResult)) {
      return false;
    }
    return !!nextResult.start.get("day") && !!nextResult.start.get("month") && !!nextResult.start.get("year");
  }
  mergeResults(textBetween, currentResult, nextResult) {
    let duration = parseDuration(currentResult.text);
    if (hasImpliedEarlierReferenceDate(currentResult)) {
      duration = reverseDuration(duration);
    }
    const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(nextResult.start.date()), duration);
    return new ParsingResult(nextResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENExtractYearSuffixRefiner.js
var YEAR_SUFFIX_PATTERN = new RegExp(`^\\s*(${YEAR_PATTERN})`, "i");
var YEAR_GROUP6 = 1;
var ENExtractYearSuffixRefiner = class {
  refine(context, results) {
    results.forEach(function(result) {
      if (!result.start.isDateWithUnknownYear()) {
        return;
      }
      const suffix = context.text.substring(result.index + result.text.length);
      const match = YEAR_SUFFIX_PATTERN.exec(suffix);
      if (!match) {
        return;
      }
      if (match[0].trim().length <= 3) {
        return;
      }
      context.debug(() => {
        console.log(`Extracting year: '${match[0]}' into : ${result}`);
      });
      const year = parseYear(match[YEAR_GROUP6]);
      if (result.end != null) {
        result.end.assign("year", year);
      }
      result.start.assign("year", year);
      result.text += match[0];
    });
    return results;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/refiners/ENUnlikelyFormatFilter.js
var ENUnlikelyFormatFilter = class extends Filter {
  constructor() {
    super();
  }
  isValid(context, result) {
    const text = result.text.trim();
    if (text === context.text.trim()) {
      return true;
    }
    if (text.toLowerCase() === "may") {
      const textBefore = context.text.substring(0, result.index).trim();
      if (!textBefore.match(/\b(in)$/i)) {
        context.debug(() => {
          console.log(`Removing unlikely result: ${result}`);
        });
        return false;
      }
    }
    if (text.toLowerCase().endsWith("the second")) {
      const textAfter = context.text.substring(result.index + result.text.length).trim();
      if (textAfter.length > 0) {
        context.debug(() => {
          console.log(`Removing unlikely result: ${result}`);
        });
      }
      return false;
    }
    return true;
  }
};

// node_modules/chrono-node/dist/esm/locales/en/configuration.js
var ENDefaultConfiguration = class {
  createCasualConfiguration(littleEndian = false) {
    const option = this.createConfiguration(false, littleEndian);
    option.parsers.push(new ENCasualDateParser());
    option.parsers.push(new ENCasualTimeParser());
    option.parsers.push(new ENMonthNameParser());
    option.parsers.push(new ENRelativeDateFormatParser());
    option.parsers.push(new ENTimeUnitCasualRelativeFormatParser());
    option.refiners.push(new ENUnlikelyFormatFilter());
    return option;
  }
  createConfiguration(strictMode = true, littleEndian = false) {
    const options = includeCommonConfiguration({
      parsers: [
        new SlashDateFormatParser(littleEndian),
        new ENTimeUnitWithinFormatParser(strictMode),
        new ENMonthNameLittleEndianParser(),
        new ENMonthNameMiddleEndianParser(littleEndian),
        new ENWeekdayParser(),
        new ENSlashMonthFormatParser(),
        new ENTimeExpressionParser(strictMode),
        new ENTimeUnitAgoFormatParser(strictMode),
        new ENTimeUnitLaterFormatParser(strictMode)
      ],
      refiners: [new ENMergeDateTimeRefiner()]
    }, strictMode);
    options.parsers.unshift(new ENYearMonthDayParser(strictMode));
    options.refiners.unshift(new ENMergeRelativeFollowByDateRefiner());
    options.refiners.unshift(new ENMergeRelativeAfterDateRefiner());
    options.refiners.unshift(new OverlapRemovalRefiner());
    options.refiners.push(new ENMergeDateTimeRefiner());
    options.refiners.push(new ENExtractYearSuffixRefiner());
    options.refiners.push(new ENMergeDateRangeRefiner());
    return options;
  }
};

// node_modules/chrono-node/dist/esm/chrono.js
var Chrono = class _Chrono {
  parsers;
  refiners;
  defaultConfig = new ENDefaultConfiguration();
  constructor(configuration2) {
    configuration2 = configuration2 || this.defaultConfig.createCasualConfiguration();
    this.parsers = [...configuration2.parsers];
    this.refiners = [...configuration2.refiners];
  }
  clone() {
    return new _Chrono({
      parsers: [...this.parsers],
      refiners: [...this.refiners]
    });
  }
  parseDate(text, referenceDate, option) {
    const results = this.parse(text, referenceDate, option);
    return results.length > 0 ? results[0].start.date() : null;
  }
  parse(text, referenceDate, option) {
    const context = new ParsingContext(text, referenceDate, option);
    let results = [];
    this.parsers.forEach((parser) => {
      const parsedResults = _Chrono.executeParser(context, parser);
      results = results.concat(parsedResults);
    });
    results.sort((a, b) => {
      return a.index - b.index;
    });
    this.refiners.forEach(function(refiner) {
      results = refiner.refine(context, results);
    });
    return results;
  }
  static executeParser(context, parser) {
    const results = [];
    const pattern = parser.pattern(context);
    const originalText = context.text;
    let remainingText = context.text;
    let match = pattern.exec(remainingText);
    while (match) {
      const index = match.index + originalText.length - remainingText.length;
      match.index = index;
      const result = parser.extract(context, match);
      if (!result) {
        remainingText = originalText.substring(match.index + 1);
        match = pattern.exec(remainingText);
        continue;
      }
      let parsedResult = null;
      if (result instanceof ParsingResult) {
        parsedResult = result;
      } else if (result instanceof ParsingComponents) {
        parsedResult = context.createParsingResult(match.index, match[0]);
        parsedResult.start = result;
      } else {
        parsedResult = context.createParsingResult(match.index, match[0], result);
      }
      const parsedIndex = parsedResult.index;
      const parsedText = parsedResult.text;
      context.debug(() => console.log(`${parser.constructor.name} extracted (at index=${parsedIndex}) '${parsedText}'`));
      results.push(parsedResult);
      remainingText = originalText.substring(parsedIndex + parsedText.length);
      match = pattern.exec(remainingText);
    }
    return results;
  }
};
var ParsingContext = class {
  text;
  option;
  reference;
  refDate;
  constructor(text, refDate, option) {
    this.text = text;
    this.option = option ?? {};
    this.reference = ReferenceWithTimezone.fromInput(refDate, this.option.timezones);
    this.refDate = this.reference.instant;
  }
  createParsingComponents(components) {
    if (components instanceof ParsingComponents) {
      return components;
    }
    return new ParsingComponents(this.reference, components);
  }
  createParsingResult(index, textOrEndIndex, startComponents, endComponents) {
    const text = typeof textOrEndIndex === "string" ? textOrEndIndex : this.text.substring(index, textOrEndIndex);
    const start = startComponents ? this.createParsingComponents(startComponents) : null;
    const end = endComponents ? this.createParsingComponents(endComponents) : null;
    return new ParsingResult(this.reference, index, text, start, end);
  }
  debug(block) {
    if (this.option.debug) {
      if (this.option.debug instanceof Function) {
        this.option.debug(block);
      } else {
        const handler = this.option.debug;
        handler.debug(block);
      }
    }
  }
};

// node_modules/chrono-node/dist/esm/locales/en/index.js
var configuration = new ENDefaultConfiguration();
var casual = new Chrono(configuration.createCasualConfiguration(false));
var strict = new Chrono(configuration.createConfiguration(true, false));
var GB = new Chrono(configuration.createCasualConfiguration(true));

// node_modules/chrono-node/dist/esm/index.js
var casual2 = casual;
function parse(text, ref, option) {
  return casual2.parse(text, ref, option);
}

// src/widgets/create-task.ts
var CreateTaskWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.popover = null;
    this.onDocClick = (e) => this.handleOutsideClick(e);
    this.render();
  }
  render() {
    this.bodyEl.empty();
    const btn = this.bodyEl.createDiv({ cls: "iris-hp-create-task" });
    const icon = btn.createDiv({ cls: "iris-hp-create-task-icon" });
    (0, import_obsidian4.setIcon)(icon, "check-square");
    btn.createDiv({ cls: "iris-hp-create-task-label", text: "Create task" });
    btn.addEventListener("click", () => this.togglePopover());
  }
  togglePopover() {
    if (this.popover) {
      this.closePopover();
      return;
    }
    this.openPopover();
  }
  openPopover() {
    const pop = this.containerEl.createDiv({ cls: "iris-hp-task-popover" });
    this.popover = pop;
    const titleInput = this.addField(pop, "", "Task name\u2026");
    const dueInput = this.addField(pop, "Due", "tomorrow 3pm, next Friday\u2026");
    const btn = pop.createEl("button", { cls: "iris-hp-task-submit", text: "Create" });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.submit(titleInput, dueInput);
    });
    pop.addEventListener("mousedown", (e) => e.stopPropagation());
    pop.addEventListener("click", (e) => e.stopPropagation());
    setTimeout(() => document.addEventListener("click", this.onDocClick), 0);
    titleInput.focus();
  }
  addField(parent, label, placeholder) {
    const row = parent.createDiv({ cls: "iris-hp-task-field" });
    if (label) row.createEl("label", { text: label });
    const input = row.createEl("input", { type: "text" });
    if (placeholder) input.placeholder = placeholder;
    return input;
  }
  async submit(titleInput, dueInput) {
    const title = titleInput.value.trim();
    if (!title) {
      new import_obsidian4.Notice("Task title is required");
      return;
    }
    const lines = ["---"];
    const raw = dueInput.value.trim();
    if (raw) {
      const due = await this.parseDate(raw);
      if (!due) {
        new import_obsidian4.Notice("Couldn't understand that date");
        return;
      }
      lines.push(`closes: ${due.date}`);
      if (due.time) lines.push(`closeTime: "${due.time}"`);
    }
    lines.push(`displayTitle: "${title}"`);
    lines.push("status: ", "---", "");
    await this.ensureFolder();
    const safeName = title.replace(/[\\/:*?"<>|]/g, "_");
    let path = `${TASK_FOLDER}/${safeName}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) {
      let i = 1;
      while (this.app.vault.getAbstractFileByPath(`${TASK_FOLDER}/${safeName} ${i}.md`)) i++;
      path = `${TASK_FOLDER}/${safeName} ${i}.md`;
    }
    await this.app.vault.create(path, lines.join("\n"));
    new import_obsidian4.Notice(`Task "${title}" created`);
    this.closePopover();
  }
  closePopover() {
    document.removeEventListener("click", this.onDocClick);
    if (this.popover) {
      this.popover.remove();
      this.popover = null;
    }
  }
  handleOutsideClick(e) {
    if (this.popover && !this.popover.contains(e.target)) {
      this.closePopover();
    }
  }
  async parseDate(input) {
    const results = parse(input);
    if (results.length > 0) {
      const start = results[0].start;
      const parsed = start.date();
      let time = null;
      if (start.isCertain("hour")) {
        const hh = String(parsed.getHours()).padStart(2, "0");
        const mm = String(parsed.getMinutes()).padStart(2, "0");
        time = `${hh}:${mm}`;
      }
      return { date: formatDate(parsed), time };
    }
    const apiKey = getApiKey(this.app);
    if (!apiKey) return null;
    try {
      const todayStr = formatDate(/* @__PURE__ */ new Date());
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 64,
          messages: [{
            role: "user",
            content: `Today is ${todayStr}. Parse this into a date and optional time. Return ONLY valid JSON: {"date":"YYYY-MM-DD","time":"HH:mm"} or {"date":"YYYY-MM-DD","time":null}. Input: "${input}"`
          }]
        })
      });
      if (!res.ok) return null;
      const body = await res.json();
      const text = body?.content?.[0]?.text ?? "";
      const match = text.match(/\{[^}]+\}/);
      if (!match) return null;
      const obj = JSON.parse(match[0]);
      if (!obj.date || !/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) return null;
      return { date: obj.date, time: obj.time || null };
    } catch {
      return null;
    }
  }
  async ensureFolder() {
    if (!this.app.vault.getAbstractFileByPath(TASK_FOLDER)) {
      await this.app.vault.createFolder(TASK_FOLDER);
    }
  }
  destroy() {
    this.closePopover();
    super.destroy();
  }
};

// src/widgets/command.ts
var import_obsidian5 = require("obsidian");
var CommandSuggestModal = class extends import_obsidian5.FuzzySuggestModal {
  constructor(app, commands, onChoose) {
    super(app);
    this.commands = commands;
    this.onChoose = onChoose;
  }
  getItems() {
    return this.commands;
  }
  getItemText(item) {
    return item.name;
  }
  onChooseItem(item) {
    this.onChoose(item);
  }
};
var CommandWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    const configBtn = this.containerEl.createEl("button", {
      cls: "iris-hp-widget-configure clickable-icon",
      attr: { "aria-label": "Set command" }
    });
    (0, import_obsidian5.setIcon)(configBtn, "terminal");
    configBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openCommandPicker();
    });
    this.render();
  }
  render() {
    this.bodyEl.empty();
    if (!this.config.commandId) {
      const placeholder = this.bodyEl.createDiv({ cls: "iris-hp-command" });
      const icon2 = placeholder.createDiv({ cls: "iris-hp-command-icon" });
      (0, import_obsidian5.setIcon)(icon2, "terminal");
      placeholder.createDiv({ cls: "iris-hp-command-label", text: "No command set" });
      return;
    }
    const cmd = this.getCommand(this.config.commandId);
    const label = cmd?.name ?? this.config.commandId;
    const btn = this.bodyEl.createDiv({
      cls: "iris-hp-command",
      attr: { "aria-label": label }
    });
    const icon = btn.createDiv({ cls: "iris-hp-command-icon" });
    (0, import_obsidian5.setIcon)(icon, cmd?.icon ?? "terminal");
    btn.createDiv({ cls: "iris-hp-command-label", text: label });
    btn.addEventListener("click", () => {
      this.app.commands.executeCommandById(this.config.commandId);
    });
  }
  openCommandPicker() {
    const commands = this.getAllCommands();
    new CommandSuggestModal(this.app, commands, (cmd) => {
      this.config.commandId = cmd.id;
      this.plugin.saveSettings();
      this.render();
    }).open();
  }
  getAllCommands() {
    const cmds = this.app.commands?.commands;
    if (!cmds) return [];
    return Object.values(cmds);
  }
  getCommand(id) {
    const cmds = this.app.commands?.commands;
    return cmds?.[id];
  }
};

// src/widgets/quick-switcher.ts
var import_obsidian6 = require("obsidian");
var QuickSwitcherWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.searchTimer = null;
    this.hiddenFilter = buildHiddenFilter(this.app);
    this.render();
  }
  render() {
    this.bodyEl.empty();
    this.bodyEl.addClass("iris-hp-switcher-body");
    const inputRow = this.bodyEl.createDiv({ cls: "iris-hp-switcher-input-row" });
    const iconEl = inputRow.createDiv({ cls: "iris-hp-switcher-icon" });
    (0, import_obsidian6.setIcon)(iconEl, "search");
    const input = inputRow.createEl("input", {
      cls: "iris-hp-switcher-input",
      attr: { type: "text", placeholder: "Jump to note..." }
    });
    const results = this.bodyEl.createDiv({ cls: "iris-hp-switcher-results" });
    input.addEventListener("input", () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.updateResults(input.value.trim(), results);
      }, 120);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = results.querySelector(".iris-hp-switcher-item");
        first?.click();
      }
    });
  }
  updateResults(query, container) {
    container.empty();
    if (!query) return;
    const lower = query.toLowerCase();
    const files = this.app.vault.getMarkdownFiles().filter((f) => !this.hiddenFilter(f.path) && f.basename.toLowerCase().includes(lower)).sort((a, b) => {
      const aStarts = a.basename.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.basename.toLowerCase().startsWith(lower) ? 0 : 1;
      return aStarts - bStarts || a.basename.localeCompare(b.basename);
    }).slice(0, 20);
    for (const file of files) {
      const item = container.createDiv({ cls: "iris-hp-switcher-item" });
      item.createSpan({ text: getDisplayTitle(this.app, file) });
      item.addEventListener("click", () => {
        this.app.workspace.getLeaf(false).openFile(file);
      });
    }
  }
  destroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    super.destroy();
  }
};

// src/widgets/view-embed.ts
var import_obsidian7 = require("obsidian");
var ViewEmbedWidget = class extends BaseWidget {
  constructor(app, containerEl, config, plugin) {
    super(app, containerEl, config, plugin);
    this.embeddedView = null;
    this.resizeObserver = null;
    this.render();
  }
  render() {
    if (this.embeddedView) {
      const currentType = this.embeddedView.getViewType();
      if (currentType === this.config.type) {
        if (!this.bodyEl.contains(this.embeddedView.containerEl)) {
          this.bodyEl.empty();
          this.bodyEl.addClass("iris-hp-view-embed-body");
          this.bodyEl.appendChild(this.embeddedView.containerEl);
        }
        return;
      }
      this.cleanupView();
    }
    this.bodyEl.empty();
    this.bodyEl.addClass("iris-hp-view-embed-body");
    const loadingEl = this.bodyEl.createDiv({ cls: "iris-hp-view-embed-loading", text: "Loading..." });
    this.embedView().then((success) => {
      if (success) {
        loadingEl.remove();
      } else {
        loadingEl.setText("Failed to load view");
      }
    });
  }
  async embedView() {
    const registry = this.app.viewRegistry;
    if (!registry) return false;
    const viewCreator = registry.viewByType instanceof Map ? registry.viewByType.get(this.config.type) : registry.viewByType?.[this.config.type];
    if (!viewCreator) return false;
    const leaf = new import_obsidian7.WorkspaceLeaf(this.app);
    const view = viewCreator(leaf);
    leaf.view = view;
    this.embeddedView = view;
    this.bodyEl.appendChild(view.containerEl);
    view.containerEl.addClass("iris-hp-embedded-leaf");
    if (view.onOpen) {
      await view.onOpen();
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.triggerResize(view);
    });
    this.resizeObserver.observe(this.bodyEl);
    return true;
  }
  triggerResize(view) {
    const v = view;
    if (typeof v.onResize === "function") {
      v.onResize();
    }
    if (v.renderer) {
      if (typeof v.renderer.onResize === "function") {
        v.renderer.onResize();
      }
      if (typeof v.renderer.start === "function" && !v.renderer._running) {
        v.renderer.start();
      }
      if (typeof v.renderer.render === "function") {
        v.renderer.render();
      }
    }
  }
  cleanupView() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.embeddedView) {
      try {
        if (this.embeddedView.onClose) {
          this.embeddedView.onClose();
        }
      } catch {
      }
      this.embeddedView.containerEl.remove();
      this.embeddedView = null;
    }
  }
  destroy() {
    this.cleanupView();
    super.destroy();
  }
};

// src/widget-picker.ts
var import_obsidian8 = require("obsidian");
var WidgetPickerModal = class extends import_obsidian8.Modal {
  constructor() {
    super(...arguments);
    this.resolve = null;
    this.entries = [];
    this.filteredEntries = [];
    this.gridEl = null;
  }
  open() {
    this.entries = this.buildEntries();
    this.filteredEntries = this.entries;
    super.open();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("iris-hp-picker-modal");
    contentEl.empty();
    contentEl.createEl("h2", { cls: "iris-hp-picker-title", text: "Add Widget" });
    const searchInput = contentEl.createEl("input", {
      cls: "iris-hp-picker-search",
      attr: { type: "text", placeholder: "Search views..." }
    });
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      this.filteredEntries = query ? this.entries.filter((e) => e.label.toLowerCase().includes(query) || e.type.toLowerCase().includes(query)) : this.entries;
      this.renderGrid();
    });
    this.gridEl = contentEl.createDiv({ cls: "iris-hp-picker-grid" });
    this.renderGrid();
    searchInput.focus();
  }
  onClose() {
    if (this.resolve) {
      this.resolve(null);
      this.resolve = null;
    }
  }
  renderGrid() {
    if (!this.gridEl) return;
    this.gridEl.empty();
    const groups = [
      { label: "Home", entries: this.filteredEntries.filter((e) => e.group === "homepage") },
      { label: "Core", entries: this.filteredEntries.filter((e) => e.group === "core") },
      { label: "Plugins", entries: this.filteredEntries.filter((e) => e.group === "plugin") }
    ];
    for (const group of groups) {
      if (group.entries.length === 0) continue;
      this.gridEl.createEl("h3", { cls: "iris-hp-picker-group-label", text: group.label });
      const sectionEl = this.gridEl.createDiv({ cls: "iris-hp-picker-section" });
      for (const entry of group.entries) {
        const card = sectionEl.createDiv({ cls: "iris-hp-picker-card" });
        const iconEl = card.createDiv({ cls: "iris-hp-picker-card-icon" });
        (0, import_obsidian8.setIcon)(iconEl, entry.icon);
        card.createDiv({ cls: "iris-hp-picker-card-label", text: entry.label });
        card.addEventListener("click", () => {
          if (this.resolve) {
            this.resolve({ type: entry.type, width: entry.width, height: entry.height });
            this.resolve = null;
          }
          this.close();
        });
      }
    }
    if (this.filteredEntries.length === 0) {
      this.gridEl.createDiv({ cls: "iris-hp-picker-empty", text: "No matching views" });
    }
  }
  buildEntries() {
    const entries = [];
    for (const [type, meta] of Object.entries(BUILTIN_WIDGETS)) {
      entries.push({
        type,
        label: meta.label,
        icon: meta.icon,
        group: "homepage",
        width: meta.width,
        height: meta.height
      });
    }
    const registry = this.app.viewRegistry;
    if (registry && registry.viewByType) {
      const viewByType = registry.viewByType instanceof Map ? registry.viewByType : new Map(Object.entries(registry.viewByType));
      for (const viewType of viewByType.keys()) {
        if (HIDDEN_VIEW_TYPES.has(viewType)) continue;
        if (Object.prototype.hasOwnProperty.call(BUILTIN_WIDGETS, viewType)) continue;
        entries.push({
          type: viewType,
          label: humanizeViewType(viewType),
          icon: VIEW_TYPE_ICON_MAP[viewType] || "box",
          group: CORE_VIEW_TYPES.has(viewType) ? "core" : "plugin",
          width: 2,
          height: 3
        });
      }
    }
    return entries;
  }
};

// src/homepage-view.ts
var EMPTY_DRAG_IMG = new Image();
EMPTY_DRAG_IMG.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
var HomepageView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.widgetInstances = /* @__PURE__ */ new Map();
    this.editMode = false;
    this.draggedWidgetId = null;
    this.dragOffsetCol = 0;
    this.dragOffsetRow = 0;
    this.gridEl = null;
    this.ghostEl = null;
    this.pendingWidget = null;
    this.placingCleanup = null;
    this.plugin = plugin;
    this.engine = new GridEngine(plugin.settings.columns);
  }
  getViewType() {
    return VIEW_TYPE_HOMEPAGE;
  }
  getDisplayText() {
    return "Home";
  }
  getIcon() {
    return "home";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();
  }
  render() {
    if (this.placingCleanup) this.placingCleanup();
    this.engine.setColumns(this.plugin.settings.columns);
    this.widgetInstances.forEach((w) => w.destroy());
    this.widgetInstances.clear();
    const root = this.contentEl;
    root.empty();
    root.addClass("iris-hp-root");
    root.toggleClass("iris-hp-edit-mode", this.editMode);
    root.toggleClass("iris-hp-borderless", this.plugin.settings.borderless);
    const gridEl = root.createDiv({ cls: "iris-hp-grid" });
    this.gridEl = gridEl;
    gridEl.style.gridTemplateColumns = `repeat(${this.plugin.settings.columns}, 1fr)`;
    gridEl.style.gridAutoRows = `${ROW_HEIGHT}px`;
    gridEl.style.gap = `${GRID_GAP}px`;
    for (const config of this.plugin.settings.widgets) {
      this.renderWidget(gridEl, config);
    }
    if (this.plugin.settings.widgets.length === 0) {
      const hint = root.createDiv({ cls: "iris-hp-empty-state" });
      const icon = hint.createDiv({ cls: "iris-hp-empty-state-icon" });
      (0, import_obsidian9.setIcon)(icon, "pencil");
      hint.createEl("span", { text: "Click the pencil to get started" });
    }
    if (this.editMode) {
      const cols = this.plugin.settings.columns;
      const maxRow = this.engine.getMaxRow(this.plugin.settings.widgets);
      const rootStyle = getComputedStyle(this.contentEl);
      const rootPadding = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);
      const viewportRows = Math.floor((this.contentEl.clientHeight - rootPadding) / (ROW_HEIGHT + GRID_GAP));
      const rows = Math.max(maxRow + 2, viewportRows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dot = gridEl.createDiv({ cls: "iris-hp-grid-dot" });
          dot.style.gridColumn = `${c + 1}`;
          dot.style.gridRow = `${r + 1}`;
        }
      }
    }
    this.attachGridListeners(gridEl);
    this.renderToolbar(root);
  }
  renderToolbar(root) {
    const toolbar = root.createDiv({ cls: "iris-hp-toolbar" });
    const editBtn = toolbar.createEl("button", {
      cls: "iris-hp-toolbar-btn clickable-icon",
      attr: { "aria-label": this.editMode ? "Done editing" : "Edit layout" }
    });
    (0, import_obsidian9.setIcon)(editBtn, this.editMode ? "check" : "pencil");
    editBtn.addEventListener("click", () => {
      this.editMode = !this.editMode;
      this.render();
    });
    if (this.editMode) {
      const addBtn = toolbar.createEl("button", {
        cls: "iris-hp-toolbar-btn clickable-icon",
        attr: { "aria-label": "Add widget" }
      });
      (0, import_obsidian9.setIcon)(addBtn, "plus");
      addBtn.addEventListener("click", () => this.openPickerThenPlace());
      const trash = root.createDiv({ cls: "iris-hp-trash-zone" });
      (0, import_obsidian9.setIcon)(trash, "trash-2");
      trash.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        trash.addClass("iris-hp-trash-hover");
      });
      trash.addEventListener("dragleave", () => {
        trash.removeClass("iris-hp-trash-hover");
      });
      trash.addEventListener("drop", (e) => {
        e.preventDefault();
        trash.removeClass("iris-hp-trash-hover");
        if (!this.draggedWidgetId || !this.gridEl) return;
        const widgetId = this.draggedWidgetId;
        const gridEl = this.gridEl;
        this.draggedWidgetId = null;
        const deleteWidget = () => {
          const idx = this.plugin.settings.widgets.findIndex((w) => w.id === widgetId);
          if (idx === -1) return;
          const oldPositions = this.snapshotPositions(gridEl);
          this.plugin.settings.widgets.splice(idx, 1);
          this.engine.compact(this.plugin.settings.widgets);
          this.animateReflow(gridEl, oldPositions);
          this.plugin.saveData(this.plugin.settings);
        };
        const wrapper = gridEl.querySelector(
          `.iris-hp-widget-wrapper[data-widget-id="${widgetId}"]`
        );
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const trashRect = trash.getBoundingClientRect();
          const dx = trashRect.left + trashRect.width / 2 - (wrapperRect.left + wrapperRect.width / 2);
          const dy = trashRect.top + trashRect.height / 2 - (wrapperRect.top + wrapperRect.height / 2);
          wrapper.style.transition = "transform 0.25s ease, opacity 0.25s ease";
          wrapper.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
          wrapper.style.opacity = "0";
          wrapper.style.zIndex = "200";
          let deleted = false;
          const doDelete = () => {
            if (!deleted) {
              deleted = true;
              wrapper.remove();
              deleteWidget();
            }
          };
          wrapper.addEventListener("transitionend", doDelete, { once: true });
          setTimeout(doDelete, 350);
        } else {
          deleteWidget();
        }
      });
    }
  }
  async openPickerThenPlace() {
    const modal = new WidgetPickerModal(this.app);
    const result = await modal.open();
    if (!result || !this.gridEl) return;
    this.enterPlacingMode(result);
  }
  async openPickerAt(col, row) {
    const modal = new WidgetPickerModal(this.app);
    const result = await modal.open();
    if (!result) return;
    this.addWidgetAt(result, col, row);
  }
  enterPlacingMode(result) {
    this.pendingWidget = result;
    this.contentEl.addClass("iris-hp-placing");
    const gridEl = this.gridEl;
    const onMouseMove = (e) => {
      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;
      if (!this.ghostEl) {
        this.ghostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
      }
      const col = Math.max(0, Math.min(cell.col, this.plugin.settings.columns - result.width));
      const row = Math.max(0, cell.row);
      this.setGridPos(this.ghostEl, col, row, result.width, result.height);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
      }
    };
    const cleanup = () => {
      this.pendingWidget = null;
      this.contentEl.removeClass("iris-hp-placing");
      this.removeGhost();
      gridEl.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      this.placingCleanup = null;
    };
    this.placingCleanup = cleanup;
    gridEl.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
  }
  renderWidget(gridEl, config) {
    const wrapper = gridEl.createDiv({ cls: "iris-hp-widget-wrapper" });
    wrapper.dataset.widgetId = config.id;
    wrapper.setAttribute("draggable", "true");
    this.setGridPos(wrapper, config.col, config.row, config.width, config.height);
    let widget;
    if (isBuiltinWidget(config.type)) {
      switch (config.type) {
        case "recent-notes":
          widget = new RecentNotesWidget(this.app, wrapper, config, this.plugin);
          break;
        case "embedded-note":
          widget = new EmbeddedNoteWidget(this.app, wrapper, config, this.plugin);
          break;
        case "new-note":
          widget = new NewNoteWidget(this.app, wrapper, config, this.plugin);
          break;
        case "create-task":
          widget = new CreateTaskWidget(this.app, wrapper, config, this.plugin);
          break;
        case "command":
          widget = new CommandWidget(this.app, wrapper, config, this.plugin);
          break;
        case "quick-switcher":
          widget = new QuickSwitcherWidget(this.app, wrapper, config, this.plugin);
          break;
        case "iris-tasks-view":
          widget = new ViewEmbedWidget(this.app, wrapper, config, this.plugin);
          break;
      }
    } else {
      widget = new ViewEmbedWidget(this.app, wrapper, config, this.plugin);
    }
    this.widgetInstances.set(config.id, widget);
  }
  addWidgetAt(result, col, row) {
    const { width, height } = result;
    const clampedCol = Math.max(0, Math.min(col, this.plugin.settings.columns - width));
    const clampedRow = Math.max(0, row);
    const config = {
      id: crypto.randomUUID(),
      type: result.type,
      col: clampedCol,
      row: clampedRow,
      width,
      height
    };
    this.plugin.settings.widgets.push(config);
    this.engine.resolveCollisions(this.plugin.settings.widgets, config);
    this.plugin.saveSettings();
    this.render();
  }
  attachGridListeners(gridEl) {
    gridEl.addEventListener("dragstart", (e) => {
      if (!this.editMode) {
        e.preventDefault();
        return;
      }
      const wrapper = e.target.closest(".iris-hp-widget-wrapper");
      if (!wrapper) return;
      this.draggedWidgetId = wrapper.dataset.widgetId || null;
      if (this.draggedWidgetId && e.dataTransfer) {
        const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
        const cell = this.getCellFromEvent(gridEl, e);
        if (widget && cell) {
          this.dragOffsetCol = cell.col - widget.col;
          this.dragOffsetRow = cell.row - widget.row;
        } else {
          this.dragOffsetCol = 0;
          this.dragOffsetRow = 0;
        }
        e.dataTransfer.setData("text/plain", this.draggedWidgetId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0);
        wrapper.addClass("iris-hp-dragging");
      }
    });
    gridEl.addEventListener("dragover", (e) => {
      if (!this.editMode || !this.draggedWidgetId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      this.updateGhost(gridEl, e);
    });
    gridEl.addEventListener("dragleave", () => {
      this.removeGhost();
    });
    gridEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.removeGhost();
      if (!this.draggedWidgetId) return;
      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;
      const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
      if (!widget) return;
      const oldPositions = this.snapshotPositions(gridEl);
      widget.col = Math.max(0, Math.min(cell.col - this.dragOffsetCol, this.plugin.settings.columns - widget.width));
      widget.row = Math.max(0, cell.row - this.dragOffsetRow);
      this.engine.clamp(widget);
      this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
      this.draggedWidgetId = null;
      this.animateReflow(gridEl, oldPositions);
      this.plugin.saveData(this.plugin.settings);
    });
    gridEl.addEventListener("dragend", () => {
      this.draggedWidgetId = null;
      this.removeGhost();
      gridEl.querySelectorAll(".iris-hp-dragging").forEach((el) => el.removeClass("iris-hp-dragging"));
    });
    gridEl.addEventListener("click", (e) => {
      if (!this.editMode) return;
      if (e.target.closest(".iris-hp-widget-wrapper")) return;
      const cell = this.getCellFromEvent(gridEl, e);
      if (!cell) return;
      if (this.pendingWidget) {
        const col = Math.max(0, Math.min(cell.col, this.plugin.settings.columns - this.pendingWidget.width));
        const row = Math.max(0, cell.row);
        const result = this.pendingWidget;
        if (this.placingCleanup) this.placingCleanup();
        this.addWidgetAt(result, col, row);
        return;
      }
      const map = this.engine.buildOccupancyMap(this.plugin.settings.widgets);
      const key = cell.row * 32 + cell.col;
      if (map.has(key)) return;
      this.openPickerAt(cell.col, cell.row);
    });
    gridEl.addEventListener("widget-resize-start", (e) => {
      if (!this.editMode) return;
      const { widgetId, corner, event: mouseEvent } = e.detail;
      this.startResize(gridEl, widgetId, corner, mouseEvent);
    });
  }
  startResize(gridEl, widgetId, corner, startEvent) {
    const widget = this.plugin.settings.widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = this.getCellSize(gridRect);
    const stepX = cellW + GRID_GAP;
    const stepY = cellH + GRID_GAP;
    const origCol = widget.col;
    const origRow = widget.row;
    const origWidth = widget.width;
    const origHeight = widget.height;
    const anchorRight = origCol + origWidth;
    const anchorBottom = origRow + origHeight;
    const ghost = gridEl.createDiv({ cls: "iris-hp-resize-ghost" });
    this.setGridPos(ghost, widget.col, widget.row, widget.width, widget.height);
    const cellFromEvent = (e) => ({
      col: Math.floor((e.clientX - gridRect.left) / stepX),
      row: Math.floor((e.clientY - gridRect.top) / stepY)
    });
    const computeRect = (e) => {
      const end = cellFromEvent(e);
      let col = origCol, row = origRow, w = origWidth, h = origHeight;
      switch (corner) {
        case "br":
          w = Math.max(1, end.col - origCol + 1);
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "bl":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "tr":
          w = Math.max(1, end.col - origCol + 1);
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
        case "tl":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
        case "r":
          w = Math.max(1, end.col - origCol + 1);
          break;
        case "l":
          col = Math.max(0, Math.min(end.col, anchorRight - 1));
          w = anchorRight - col;
          break;
        case "b":
          h = Math.max(1, end.row - origRow + 1);
          break;
        case "t":
          row = Math.max(0, Math.min(end.row, anchorBottom - 1));
          h = anchorBottom - row;
          break;
      }
      w = Math.min(w, this.plugin.settings.columns - col);
      return { col, row, w, h };
    };
    const onMouseMove = (e) => {
      const r = computeRect(e);
      this.setGridPos(ghost, r.col, r.row, r.w, r.h);
    };
    const onMouseUp = (e) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      ghost.remove();
      const r = computeRect(e);
      widget.col = r.col;
      widget.row = r.row;
      widget.width = r.w;
      widget.height = r.h;
      if (widget.width !== origWidth || widget.height !== origHeight || widget.col !== origCol || widget.row !== origRow) {
        const oldPositions = this.snapshotPositions(gridEl);
        this.engine.resolveCollisions(this.plugin.settings.widgets, widget);
        this.animateReflow(gridEl, oldPositions);
        this.plugin.saveData(this.plugin.settings);
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }
  updateGhost(gridEl, e) {
    const cell = this.getCellFromEvent(gridEl, e);
    if (!cell) return;
    const widget = this.plugin.settings.widgets.find((w) => w.id === this.draggedWidgetId);
    if (!widget) return;
    if (!this.ghostEl) {
      this.ghostEl = gridEl.createDiv({ cls: "iris-hp-drop-ghost" });
    }
    const col = Math.max(0, Math.min(cell.col - this.dragOffsetCol, this.plugin.settings.columns - widget.width));
    const row = Math.max(0, cell.row - this.dragOffsetRow);
    this.setGridPos(this.ghostEl, col, row, widget.width, widget.height);
  }
  setGridPos(el, col, row, w, h) {
    el.style.gridColumn = `${col + 1} / span ${w}`;
    el.style.gridRow = `${row + 1} / span ${h}`;
  }
  removeGhost() {
    if (this.ghostEl) {
      this.ghostEl.remove();
      this.ghostEl = null;
    }
  }
  getCellSize(gridRect) {
    return {
      cellW: (gridRect.width - GRID_GAP * (this.plugin.settings.columns - 1)) / this.plugin.settings.columns,
      cellH: ROW_HEIGHT
    };
  }
  getCellFromEvent(gridEl, e) {
    const gridRect = gridEl.getBoundingClientRect();
    const { cellW, cellH } = this.getCellSize(gridRect);
    const relX = e.clientX - gridRect.left;
    const relY = e.clientY - gridRect.top;
    return this.engine.pixelToCell(relX, relY, cellW + GRID_GAP, cellH + GRID_GAP);
  }
  /** Snapshot bounding rects for all widget wrappers keyed by widget ID. */
  snapshotPositions(gridEl) {
    const positions = /* @__PURE__ */ new Map();
    gridEl.querySelectorAll(".iris-hp-widget-wrapper").forEach((el) => {
      const id = el.dataset.widgetId;
      if (id) positions.set(id, el.getBoundingClientRect());
    });
    return positions;
  }
  /** Apply new grid placements and FLIP-animate from old positions. */
  animateReflow(gridEl, oldPositions) {
    for (const config of this.plugin.settings.widgets) {
      const wrapper = gridEl.querySelector(
        `.iris-hp-widget-wrapper[data-widget-id="${config.id}"]`
      );
      if (!wrapper) continue;
      this.setGridPos(wrapper, config.col, config.row, config.width, config.height);
    }
    gridEl.offsetHeight;
    gridEl.querySelectorAll(".iris-hp-widget-wrapper").forEach((el) => {
      const id = el.dataset.widgetId;
      if (!id) return;
      const oldRect = oldPositions.get(id);
      if (!oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.25s ease";
        el.style.transform = "";
      });
    });
  }
};

// src/settings.ts
var import_obsidian10 = require("obsidian");
var IrisHomepageSettingsTab = class extends import_obsidian10.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "General" });
    new import_obsidian10.Setting(containerEl).setName("Grid columns").setDesc("Number of columns in the widget grid (2-16)").addDropdown((drop) => {
      for (let i = 2; i <= 16; i++) {
        drop.addOption(String(i * 2), String(i));
      }
      drop.setValue(String(this.plugin.settings.columns));
      drop.onChange(async (val) => {
        this.plugin.settings.columns = parseInt(val, 10);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian10.Setting(containerEl).setName("Open on startup").setDesc("Show the homepage when Obsidian starts").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.openOnStartup).onChange(async (val) => {
        this.plugin.settings.openOnStartup = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("Replace new tabs").setDesc("Open the homepage instead of an empty new tab").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.replaceNewTab).onChange(async (val) => {
        this.plugin.settings.replaceNewTab = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian10.Setting(containerEl).setName("Borderless widgets").setDesc("Remove borders and backgrounds from widget cards").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.borderless).onChange(async (val) => {
        this.plugin.settings.borderless = val;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "AI" });
    const apiKeySetting = new import_obsidian10.Setting(containerEl).setName("Anthropic API key").setDesc("Used as a fallback for natural language date parsing when chrono-node can't interpret the input");
    const existingKey = getApiKey(this.app);
    apiKeySetting.addText((text) => {
      text.setPlaceholder(existingKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "sk-ant-\u2026").onChange(() => {
      });
      const inputEl = text.inputEl;
      inputEl.type = "password";
      inputEl.style.width = "220px";
      apiKeySetting.addButton(
        (btn) => btn.setButtonText("Save").onClick(async () => {
          const val = inputEl.value.trim();
          if (val) {
            setApiKey(this.app, val);
            inputEl.value = "";
            inputEl.placeholder = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
          }
        })
      );
      if (existingKey) {
        apiKeySetting.addButton(
          (btn) => btn.setButtonText("Clear").setWarning().onClick(async () => {
            setApiKey(this.app, "");
            inputEl.placeholder = "sk-ant-\u2026";
            inputEl.value = "";
          })
        );
      }
    });
    containerEl.createEl("h2", { text: "Widgets" });
    for (let i = 0; i < this.plugin.settings.widgets.length; i++) {
      const config = this.plugin.settings.widgets[i];
      const label = resolveWidgetLabel(config.type);
      new import_obsidian10.Setting(containerEl).setName(label).setDesc(`Position: col ${config.col + 1}, row ${config.row + 1} | Size: ${config.width}x${config.height}`).addButton(
        (btn) => btn.setButtonText("Remove").setWarning().onClick(async () => {
          this.plugin.settings.widgets.splice(i, 1);
          await this.plugin.saveSettings();
          this.display();
        })
      );
      if (config.type === "command" && config.commandId) {
        const cmd = this.app.commands?.commands?.[config.commandId];
        new import_obsidian10.Setting(containerEl).setClass("iris-hp-setting-indent").setName("Command").setDesc(cmd?.name ?? config.commandId);
      }
      if (config.type === "embedded-note") {
        new import_obsidian10.Setting(containerEl).setClass("iris-hp-setting-indent").setName("Note path").setDesc("Path to the note to embed").addText(
          (text) => text.setPlaceholder("path/to/note.md").setValue(config.notePath ?? "").onChange(async (val) => {
            config.notePath = val.trim();
            await this.plugin.saveSettings();
          })
        );
      }
    }
  }
};

// src/main.ts
var IrisHomepagePlugin = class extends import_obsidian11.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.isReplacingTab = false;
    this.hideEmptyStyleEl = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_HOMEPAGE, (leaf) => new HomepageView(leaf, this));
    this.addCommand({
      id: "open-homepage",
      name: "Open home",
      callback: () => this.activateView()
    });
    this.addSettingTab(new IrisHomepageSettingsTab(this.app, this));
    this.updateEmptyTabVisibility();
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) {
        this.replaceEmptyTabs();
      }
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        if (this.settings.replaceNewTab) {
          this.replaceEmptyTabs();
        }
      })
    );
  }
  async onunload() {
    if (this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl.remove();
      this.hideEmptyStyleEl = null;
    }
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEPAGE);
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    if (!this.settings.gridVersion || this.settings.gridVersion < 2) {
      for (const w of this.settings.widgets) {
        w.height *= 2;
        w.row *= 2;
      }
      this.settings.gridVersion = 2;
    }
    if (this.settings.gridVersion < 3) {
      this.settings.columns *= 2;
      for (const w of this.settings.widgets) {
        w.width *= 2;
        w.col *= 2;
      }
      this.settings.gridVersion = 3;
    }
    if (!data?.gridVersion || data.gridVersion < 3) {
      await this.saveData(this.settings);
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.updateEmptyTabVisibility();
    this.refreshViews();
  }
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_HOMEPAGE)) {
      const view = leaf.view;
      view.render();
    }
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_HOMEPAGE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  updateEmptyTabVisibility() {
    if (this.settings.replaceNewTab && !this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl = document.createElement("style");
      this.hideEmptyStyleEl.textContent = `.workspace-leaf-content[data-type="empty"] { display: none !important; }`;
      document.head.appendChild(this.hideEmptyStyleEl);
    } else if (!this.settings.replaceNewTab && this.hideEmptyStyleEl) {
      this.hideEmptyStyleEl.remove();
      this.hideEmptyStyleEl = null;
    }
  }
  replaceEmptyTabs() {
    if (this.isReplacingTab) return;
    this.isReplacingTab = true;
    try {
      const emptyLeaves = this.app.workspace.getLeavesOfType("empty");
      for (const leaf of emptyLeaves) {
        leaf.setViewState({ type: VIEW_TYPE_HOMEPAGE, active: true });
      }
    } finally {
      this.isReplacingTab = false;
    }
  }
};
