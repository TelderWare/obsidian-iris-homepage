import { App, Component, View, WorkspaceLeaf } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

export class ViewEmbedWidget extends BaseWidget {
  private embeddedView: View | null = null;
  private embeddedLeaf: WorkspaceLeaf | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /**
   * Scroll isolation: the embedded view shares its scroll state with the
   * "real" leaf of the same view type, so opening that leaf in a separate
   * window transfers its scroll position into our widget. We intercept
   * scroll events and restore the widget-local scrollTop whenever a scroll
   * occurs while the user isn't interacting with this widget.
   */
  private scrollState = new WeakMap<Element, number>();
  private heightState = new WeakMap<Element, number>();
  private isInteracting = false;
  private scrollIsolationCleanup: (() => void) | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
  }

  render(): void {
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

  private async embedView(): Promise<boolean> {
    const registry = (this.app as any).viewRegistry;
    if (!registry) return false;

    const viewByType: Map<string, unknown> = registry.viewByType instanceof Map
      ? registry.viewByType
      : new Map(Object.entries(registry.viewByType));
    const viewCreator = viewByType.get(this.config.type) as
      ((leaf: WorkspaceLeaf) => View) | undefined;

    if (!viewCreator) return false;

    // WorkspaceLeaf constructor takes a single App argument internally.
    const leaf = new (WorkspaceLeaf as any)(this.app) as WorkspaceLeaf;

    const view: View = viewCreator(leaf);
    (leaf as any).view = view;

    this.embeddedView = view;
    this.embeddedLeaf = leaf;

    this.bodyEl.appendChild(view.containerEl);
    view.containerEl.addClass("iris-hp-embedded-leaf");

    if ((view as any).onOpen) {
      await (view as any).onOpen();
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.triggerResize(view);
    });
    this.resizeObserver.observe(this.bodyEl);

    this.setupScrollIsolation();

    return true;
  }

  private setupScrollIsolation(): void {
    const root = this.containerEl;

    // Track pointer and focus state independently so that a focusout
    // (e.g. when an answered card is removed from the DOM) does not
    // override the fact that the pointer is still inside the widget.
    let pointerInside = false;
    let focusInside = false;
    const sync = () => { this.isInteracting = pointerInside || focusInside; };

    const onPointerEnter = () => { pointerInside = true; sync(); };
    const onPointerLeave = () => { pointerInside = false; sync(); };
    const onFocusIn = () => { focusInside = true; sync(); };
    const onFocusOut = (e: FocusEvent) => {
      // If focus is moving to another element inside the widget, stay interactive.
      if (e.relatedTarget && root.contains(e.relatedTarget as Node)) return;
      focusInside = false;
      sync();
    };

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);

    // Scroll events don't bubble, so listen in the capture phase on the body.
    const onScroll = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (!this.bodyEl.contains(target)) return;

      const current = (target as HTMLElement).scrollTop;
      const currentHeight = (target as HTMLElement).scrollHeight;

      if (this.isInteracting) {
        this.scrollState.set(target, current);
        this.heightState.set(target, currentHeight);
        return;
      }

      // External scroll (e.g. the twin leaf in another window pushed its
      // scroll state into our view). Restore our remembered value.
      const saved = this.scrollState.get(target);
      const savedHeight = this.heightState.get(target);
      if (saved === undefined) {
        // First scroll event for this element — adopt its current position
        // as the baseline so we don't clobber programmatic scroll-to-now.
        this.scrollState.set(target, current);
        this.heightState.set(target, currentHeight);
        return;
      }

      // If the content height changed, the embedded view updated its content
      // (e.g. advancing to the next review card). Adopt the new position
      // instead of fighting it.
      if (savedHeight !== undefined && currentHeight !== savedHeight) {
        this.scrollState.set(target, current);
        this.heightState.set(target, currentHeight);
        return;
      }

      if (current !== saved) {
        (target as HTMLElement).scrollTop = saved;
      }
    };
    this.bodyEl.addEventListener("scroll", onScroll, true);

    this.scrollIsolationCleanup = () => {
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      this.bodyEl.removeEventListener("scroll", onScroll, true);
    };
  }

  private triggerResize(view: View): void {
    const v = view as any;

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

  private cleanupView(): void {
    if (this.scrollIsolationCleanup) {
      this.scrollIsolationCleanup();
      this.scrollIsolationCleanup = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.embeddedView) {
      try {
        // Use unload() to properly detach all events registered via registerEvent().
        // onClose() alone only runs view-specific teardown but does not remove
        // event listeners registered on the Component, causing leaks.
        (this.embeddedView as Component).unload();
      } catch {
        // View may already be cleaned up
      }
      this.embeddedView.containerEl.remove();
      this.embeddedView = null;
      this.embeddedLeaf = null;
    }
  }

  destroy(): void {
    this.cleanupView();
    super.destroy();
  }
}
