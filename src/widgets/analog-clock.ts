import { App } from "obsidian";
import type { WidgetConfig } from "../types";
import type IrisHomepagePlugin from "../main";
import { BaseWidget } from "./base-widget";

const SVG_NS = "http://www.w3.org/2000/svg";

export class AnalogClockWidget extends BaseWidget {
  private hourHand: SVGLineElement | null = null;
  private minuteHand: SVGLineElement | null = null;
  private intervalId: number | null = null;

  constructor(app: App, containerEl: HTMLElement, config: WidgetConfig, plugin: IrisHomepagePlugin) {
    super(app, containerEl, config, plugin);
    this.render();
    this.intervalId = window.setInterval(() => this.tick(), 60_000);
  }

  render(): void {
    this.clearBody();
    this.bodyEl.addClass("iris-hp-clock-body");

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", "iris-hp-clock");
    this.bodyEl.appendChild(svg);

    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180;
      const r = 44;
      const cx = 50 + r * Math.sin(angle);
      const cy = 50 - r * Math.cos(angle);
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", cx.toString());
      dot.setAttribute("cy", cy.toString());
      dot.setAttribute("r", i % 3 === 0 ? "1.4" : "0.8");
      dot.setAttribute("class", "iris-hp-clock-dot");
      svg.appendChild(dot);
    }

    this.hourHand = this.makeHand(svg, "iris-hp-clock-hand-hour", 26);
    this.minuteHand = this.makeHand(svg, "iris-hp-clock-hand-minute", 38);

    const center = document.createElementNS(SVG_NS, "circle");
    center.setAttribute("cx", "50");
    center.setAttribute("cy", "50");
    center.setAttribute("r", "1.5");
    center.setAttribute("class", "iris-hp-clock-center");
    svg.appendChild(center);

    this.tick();
  }

  private makeHand(svg: SVGSVGElement, cls: string, length: number): SVGLineElement {
    const hand = document.createElementNS(SVG_NS, "line");
    hand.setAttribute("x1", "50");
    hand.setAttribute("y1", "50");
    hand.setAttribute("x2", "50");
    hand.setAttribute("y2", (50 - length).toString());
    hand.setAttribute("class", cls);
    svg.appendChild(hand);
    return hand;
  }

  private tick(): void {
    if (!this.hourHand || !this.minuteHand) return;
    const now = new Date();
    const m = now.getMinutes();
    const h = now.getHours() % 12;
    const minuteAngle = m * 6;
    const hourAngle = h * 30 + m * 0.5;
    this.hourHand.setAttribute("transform", `rotate(${hourAngle} 50 50)`);
    this.minuteHand.setAttribute("transform", `rotate(${minuteAngle} 50 50)`);
  }

  destroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    super.destroy();
  }
}
