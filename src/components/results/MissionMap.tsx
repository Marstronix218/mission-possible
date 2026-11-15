"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Mission, SimResult } from "@/types/game";
import {
  cellFrame,
  gridSize,
  isTrueDetection,
  quadrantOf,
  type Quadrant,
} from "./mission-playback";

/** Glyphs for the final map. Shape carries the meaning, not just color. */
export const finalGlyph = {
  found: "!",
  falseAlarm: "⚑",
  "cloud-blocked": "☁",
  "never-in-view": "∅",
  "not-recognised": "?",
  "before-event": "◷",
} as const;

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/**
 * Canvas mission map. "live": the state at `hour` (hazard onset, passes,
 * blocked looks, detections). "final": what was found vs missed and why.
 * North is up: grid row 0 (south) is drawn at the bottom.
 */
export function MissionMap({
  mission,
  result,
  hour,
  mode,
  animate,
  retask,
  label,
}: {
  mission: Mission;
  result: SimResult;
  hour: number;
  mode: "live" | "final";
  /** Allow decorative flicker (off under reduced motion or when paused). */
  animate: boolean;
  retask?: { day: number; quadrant: Quadrant };
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const { rows, columns } = useMemo(() => gridSize(mission), [mission]);
  const spanHours = mission.durationDays * 24;
  const byId = useMemo(
    () => new Map(result.cells.map((c) => [c.id, c])),
    [result],
  );
  const sizeRef = useRef(0);

  const draw = useCallback(() => {
    const c = canvas.current;
    const width = sizeRef.current || wrap.current?.clientWidth || 0;
    if (!c || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const height = width * (rows / columns);
    if (
      c.width !== Math.round(width * dpr) ||
      c.height !== Math.round(height * dpr)
    ) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      c.style.height = `${height}px`;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const cw = width / columns;
    const ch = height / rows;
    const gap = Math.max(1, cw * 0.08);
    const hz = cssVar(`--hazard-${mission.category}`, "#ff6b35");
    const cyan = cssVar("--pop-cyan", "#2de2e6");
    const yellow = cssVar("--pop-yellow", "#ffd23f");
    const pink = cssVar("--pop-pink", "#ff5c8a");
    const smoky =
      mission.category === "wildfire" || mission.category === "volcano";
    const now = performance.now() / 1000;
    const persist = 2.5;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyphFont = `700 ${Math.max(8, cw * 0.62)}px system-ui, sans-serif`;

    mission.grid.forEach((g, index) => {
      const cell = byId.get(g.id);
      if (!cell) return;
      const x = g.column * cw;
      const y = (rows - 1 - g.row) * ch;
      const f = cellFrame(
        g,
        cell,
        mode === "final" ? spanHours : hour,
        spanHours,
      );
      const hazard = g.truth > 0.5;
      // Base: scanned cells are lighter.
      ctx.fillStyle = f.seen ? "#2b3a92" : "#141a4f";
      ctx.fillRect(x + gap / 2, y + gap / 2, cw - gap, ch - gap);
      // Hazard ground truth (mission data) once it has started.
      if (f.hazardActive) {
        const flicker =
          animate && mode === "live" && smoky
            ? 0.82 + 0.18 * Math.sin(now * 7 + index * 1.7)
            : 1;
        ctx.globalAlpha =
          (mode === "final" ? 0.35 : 0.45 + 0.45 * Math.min(1, g.truth)) *
          flicker;
        ctx.fillStyle = hz;
        ctx.fillRect(x + gap / 2, y + gap / 2, cw - gap, ch - gap);
        ctx.globalAlpha = 1;
      }
      // Cloud / smoke cover probability (mission data), drawn as haze.
      if (mode === "live" && g.cloudProbability > 0.05) {
        ctx.globalAlpha = Math.min(0.55, g.cloudProbability * 0.5);
        ctx.fillStyle = smoky ? "#b7a99a" : "#e9edff";
        ctx.beginPath();
        ctx.arc(
          x + cw / 2,
          y + ch / 2,
          (Math.min(cw, ch) / 2) * (0.7 + g.cloudProbability * 0.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (mode === "live") {
        // Sensor footprint: cells looked at in the last few mission hours.
        if (f.lastLookAge !== null && f.lastLookAge < persist) {
          const a = 1 - f.lastLookAge / persist;
          if (f.lastLookBlocked) {
            ctx.globalAlpha = 0.85 * a;
            ctx.fillStyle = "#c9cde6";
            ctx.fillRect(x + gap / 2, y + gap / 2, cw - gap, ch - gap);
            ctx.globalAlpha = a;
            ctx.fillStyle = "#1b2160";
            ctx.font = glyphFont;
            ctx.fillText("☁", x + cw / 2, y + ch / 2 + 1);
          } else {
            ctx.globalAlpha = a;
            ctx.strokeStyle = cyan;
            ctx.lineWidth = Math.max(1.5, cw * 0.14);
            ctx.strokeRect(x + gap, y + gap, cw - gap * 2, ch - gap * 2);
          }
          ctx.globalAlpha = 1;
        }
        if (f.flagged)
          drawPin(
            ctx,
            x,
            y,
            cw,
            ch,
            f.falseAlarm ? pink : yellow,
            f.falseAlarm ? finalGlyph.falseAlarm : "!",
            glyphFont,
          );
      } else {
        if (isTrueDetection(cell) || (cell.detected && !hazard)) {
          drawPin(
            ctx,
            x,
            y,
            cw,
            ch,
            hazard ? yellow : pink,
            hazard ? finalGlyph.found : finalGlyph.falseAlarm,
            glyphFont,
          );
        } else if (hazard) {
          ctx.strokeStyle = hz;
          ctx.lineWidth = Math.max(1.5, cw * 0.12);
          ctx.setLineDash([Math.max(2, cw * 0.18), Math.max(2, cw * 0.12)]);
          ctx.strokeRect(x + gap, y + gap, cw - gap * 2, ch - gap * 2);
          ctx.setLineDash([]);
          const glyph = cell.missReason
            ? finalGlyph[cell.missReason]
            : cell.observed
              ? finalGlyph["not-recognised"]
              : "×";
          ctx.fillStyle = "#ffffff";
          ctx.font = glyphFont;
          ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
          // An early false alarm can also leave a later hazard unconfirmed.
          // Keep its missed-zone outline/reason and add a separate corner badge.
          if (cell.detected)
            drawPin(
              ctx,
              x + cw * 0.58,
              y,
              cw * 0.42,
              ch * 0.42,
              pink,
              finalGlyph.falseAlarm,
              `700 ${Math.max(6, cw * 0.28)}px system-ui, sans-serif`,
            );
        }
      }
    });

    // Retask zone outline.
    if (retask && (mode === "final" || hour >= retask.day * 24)) {
      const q = retask.quadrant;
      const north = q[0] === "n";
      const east = q[1] === "e";
      const qx = east ? Math.ceil(columns / 2) * cw : 0;
      const qy = north ? 0 : Math.floor(rows / 2) * ch;
      const qw =
        (east ? columns - Math.ceil(columns / 2) : Math.ceil(columns / 2)) * cw;
      const qh =
        (north ? Math.ceil(rows / 2) : rows - Math.ceil(rows / 2)) * ch;
      ctx.strokeStyle = yellow;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(qx + 2, qy + 2, qw - 4, qh - 4);
      ctx.setLineDash([]);
    }
    // North arrow.
    ctx.fillStyle = "rgba(7,10,36,0.75)";
    ctx.beginPath();
    ctx.arc(width - 16, 16, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText("N", width - 16, 17);
  }, [rows, columns, mission, byId, spanHours, animate, mode, hour, retask]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      sizeRef.current = el.clientWidth;
      draw();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  });

  // Decorative flicker only: redraw on animation frames while allowed and visible.
  useEffect(() => {
    if (!animate || mode !== "live") return;
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 90) {
        last = t;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, mode, draw]);

  return (
    <div ref={wrap} className="relative w-full">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        className="block w-full rounded-2xl"
      />
    </div>
  );
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cw: number,
  ch: number,
  color: string,
  glyph: string,
  font: string,
) {
  const r = Math.min(cw, ch) * 0.46;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + cw / 2, y + ch / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, cw * 0.08);
  ctx.strokeStyle = "#070a24";
  ctx.stroke();
  ctx.fillStyle = "#070a24";
  ctx.font = font;
  ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
}

/** Text summary of the final map for screen readers and the legend. */
export function finalCounts(result: SimResult) {
  const counts = {
    found: 0,
    falseAlarm: 0,
    "cloud-blocked": 0,
    "never-in-view": 0,
    "not-recognised": 0,
    "before-event": 0,
    seen: 0,
  };
  for (const c of result.cells) {
    if (c.observed) counts.seen += 1;
    if (c.detected && !isTrueDetection(c)) counts.falseAlarm += 1;
    if (isTrueDetection(c)) counts.found += 1;
    else if (c.truth > 0.5) {
      const reason =
        c.missReason ?? (c.observed ? "not-recognised" : "never-in-view");
      counts[reason] += 1;
    }
  }
  return counts;
}

export { quadrantOf };
