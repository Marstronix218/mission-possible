"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";
import { getMissionStory } from "@/lib/story/missions";
import {
  downlinkLatency,
  gridSize,
  observationWindowHours,
  windowState,
  type Quadrant,
} from "../mission-playback";
import {
  LST_REFERENCE_SLUGS,
  PHASES,
  alignImage,
  captionFor,
  cellAtPoint,
  cellDetail,
  cellViews,
  clampTransform,
  footprintBand,
  observationSummary,
  parseContextReference,
  parseLstReference,
  phaseAt,
  scaleGradient,
  sensorProfile,
  sliderKey,
  viewAspect,
  zoomAt,
  ZOOM_MAX,
  ZOOM_MIN,
  type Bbox,
  type CellView,
  type ContextReference,
  type LstReference,
  type SensorProfile,
  type ViewTransform,
} from "./observation-model";
import styles from "./observation.module.css";

type ViewMode = "compare" | "real" | "sim";
type RealLayer = "lst" | "true-colour";

interface References {
  slug: string;
  context: ContextReference;
  contextLoaded: boolean;
  lst: LstReference | null;
}

function formatDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value ?? "";
  return new Date(value.slice(0, 10) + "T00:00:00Z").toLocaleDateString(
    "en-US",
    { timeZone: "UTC", dateStyle: "medium" },
  );
}

const getJson = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<unknown>) : null))
    .catch(() => null);

function useReferences(mission: Mission): References | null {
  const [refs, setRefs] = useState<References | null>(null);
  const { slug, bbox } = mission;
  useEffect(() => {
    let active = true;
    const wantsLst = LST_REFERENCE_SLUGS.includes(slug);
    Promise.all([
      getJson(`/nasa/${slug}.json`),
      wantsLst ? getJson(`/nasa/${slug}-lst.json`) : Promise.resolve(null),
    ]).then(([context, lst]) => {
      if (!active) return;
      setRefs({
        slug,
        context: parseContextReference(slug, context, bbox),
        contextLoaded: context !== null,
        lst: parseLstReference(lst),
      });
    });
    return () => {
      active = false;
    };
  }, [slug, bbox]);
  return refs?.slug === slug ? refs : null;
}

function useImage(src: string | null) {
  const [loaded, setLoaded] = useState<{
    src: string;
    el: HTMLImageElement;
  } | null>(null);
  useEffect(() => {
    if (!src) return;
    let active = true;
    const el = new window.Image();
    el.decoding = "async";
    el.onload = () => {
      if (active) setLoaded({ src, el });
    };
    el.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return loaded && loaded.src === src ? loaded.el : null;
}

interface Layer {
  img: HTMLImageElement;
  bbox: Bbox;
  /** Draw as a dim grey underlay (so masked LST pixels read as "no data"). */
  dim?: boolean;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  mission: Bbox,
  layer: Layer,
  w: number,
  h: number,
) {
  const a = alignImage(
    mission,
    layer.bbox,
    layer.img.naturalWidth,
    layer.img.naturalHeight,
  );
  if (!a) return;
  ctx.drawImage(
    layer.img,
    a.sx,
    a.sy,
    a.sw,
    a.sh,
    a.dx * w,
    a.dy * h,
    a.dw * w,
    a.dh * h,
  );
}

function toGrey(ctx: CanvasRenderingContext2D, w: number, h: number, k = 1) {
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * k;
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
}

/** Backing-store size for a map canvas `width` CSS pixels wide. */
function canvasSize(width: number, aspect: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.min(1600, Math.max(320, Math.round(width * dpr)));
  return [w, Math.round(w / aspect)] as const;
}

function canvas2d(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext("2d")!] as const;
}

/**
 * The simulated sensor picture: the reference layer the sensor can "see",
 * box-downsampled (repeated halving) to `columns × pixelsPerCell` pixels.
 * Deterministic for the same images and profile.
 */
function buildSimBase(
  missionBbox: Bbox,
  layers: Layer[],
  columns: number,
  rows: number,
  profile: SensorProfile,
  aspect: number,
) {
  const cw = 800;
  const ch = Math.round(cw / aspect);
  const [compose, cctx] = canvas2d(cw, ch);
  cctx.fillStyle = "#1a2430";
  cctx.fillRect(0, 0, cw, ch);
  for (const layer of layers) {
    drawLayer(cctx, missionBbox, layer, cw, ch);
    if (layer.dim) toGrey(cctx, cw, ch, 0.5);
  }
  let src: HTMLCanvasElement = compose;
  const tw = columns * profile.pixelsPerCell;
  const th = rows * profile.pixelsPerCell;
  while (src.width / 2 >= tw && src.height / 2 >= th) {
    const [next, nctx] = canvas2d(src.width / 2, src.height / 2);
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(src, 0, 0, next.width, next.height);
    src = next;
  }
  const [out, octx] = canvas2d(tw, th);
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, 0, 0, tw, th);
  if (profile.layer === "greyscale") toGrey(octx, tw, th);
  return out;
}

function hatchPattern(ctx: CanvasRenderingContext2D, size: number) {
  const [p, pctx] = canvas2d(size, size);
  pctx.strokeStyle = "rgba(255,255,255,0.28)";
  pctx.lineWidth = Math.max(1, size / 8);
  pctx.beginPath();
  pctx.moveTo(0, size);
  pctx.lineTo(size, 0);
  pctx.moveTo(-size / 2, size / 2);
  pctx.lineTo(size / 2, -size / 2);
  pctx.moveTo(size / 2, size * 1.5);
  pctx.lineTo(size * 1.5, size / 2);
  pctx.stroke();
  return ctx.createPattern(p, "repeat");
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(cx - r * 0.55, cy + r * 0.1, r * 0.45, 0, Math.PI * 2);
  ctx.arc(cx, cy - r * 0.2, r * 0.6, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.6, cy + r * 0.12, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawStates(
  ctx: CanvasRenderingContext2D,
  views: CellView[],
  rows: number,
  columns: number,
  w: number,
  h: number,
  live: boolean,
) {
  const cw = w / columns;
  const ch = h / rows;
  const hatch = hatchPattern(ctx, Math.max(6, Math.round(cw / 2)));
  for (const v of views) {
    const x = v.column * cw;
    const y = (rows - 1 - v.row) * ch;
    if (v.state === "unseen") {
      ctx.fillStyle = "rgba(4,8,20,0.74)";
      ctx.fillRect(x, y, cw, ch);
      if (hatch) {
        ctx.fillStyle = hatch;
        ctx.fillRect(x, y, cw, ch);
      }
    } else if (v.state === "blocked") {
      ctx.fillStyle = "rgba(226,232,242,0.86)";
      ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = "#7d8aa0";
      drawCloud(ctx, x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.34);
    } else if (v.state === "onboard") {
      ctx.fillStyle = "rgba(255,210,63,0.14)";
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = Math.max(1.5, cw * 0.09);
      ctx.setLineDash([Math.max(2, cw * 0.12), Math.max(2, cw * 0.1)]);
      const inset = ctx.lineWidth;
      ctx.strokeRect(x + inset, y + inset, cw - inset * 2, ch - inset * 2);
      ctx.setLineDash([]);
    }
    if (live && v.recentLook) {
      ctx.strokeStyle = v.recentLook === "clear" ? "#8ed5dc" : "#ffffff";
      ctx.lineWidth = Math.max(1.5, cw * 0.12);
      ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
    }
  }
}

const MISS_LABEL = {
  "never-in-view": "missed: never in view",
  "cloud-blocked": "missed: hidden by cloud or smoke",
  "not-recognised": "missed: seen but not recognised",
  "before-event": "missed: checked before it started",
} as const;

/** SVG marker for a hazard result; shape carries meaning, not only colour. */
function Marker({
  v,
  x,
  y,
  cw,
  ch,
  hazardColour,
}: {
  v: CellView;
  x: number;
  y: number;
  cw: number;
  ch: number;
  hazardColour: string;
}) {
  const cx = x + cw / 2;
  const cy = y + ch / 2;
  const r = Math.min(cw, ch) * 0.36;
  return (
    <g>
      {v.mark === "found" && (
        <g>
          <title>Hazard confirmed by your satellite</title>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="#ffd23f"
            stroke="#07121b"
            strokeWidth={r * 0.28}
          />
          <circle cx={cx} cy={cy} r={r * 0.32} fill="#07121b" />
        </g>
      )}
      {(v.mark === "zone" || v.mark === "missed") && (
        <rect
          x={x + cw * 0.08}
          y={y + ch * 0.08}
          width={cw * 0.84}
          height={ch * 0.84}
          fill="none"
          stroke={v.mark === "missed" ? "#ffffff" : hazardColour}
          strokeWidth={Math.min(cw, ch) * 0.1}
          strokeDasharray={`${cw * 0.18} ${cw * 0.12}`}
        >
          <title>
            {v.mark === "missed" && v.missReason
              ? `Hazard zone ${MISS_LABEL[v.missReason]}`
              : "Hazard zone in the mission data, not found yet"}
          </title>
        </rect>
      )}
      {v.mark === "missed" && v.missReason && (
        <g transform={`translate(${cx} ${cy})`}>
          <title>{`Hazard zone ${MISS_LABEL[v.missReason]}`}</title>
          <circle
            r={r * 0.85}
            fill="#07121b"
            stroke="#fff"
            strokeWidth={r * 0.12}
          />
          {v.missReason === "cloud-blocked" && (
            <path
              d={`M${-r * 0.5} ${r * 0.2} a${r * 0.25} ${r * 0.25} 0 0 1 ${r * 0.2} ${-r * 0.45} a${r * 0.32} ${r * 0.32} 0 0 1 ${r * 0.6} 0 a${r * 0.22} ${r * 0.22} 0 0 1 ${r * 0.2} ${r * 0.45} z`}
              fill="#fff"
            />
          )}
          {v.missReason === "never-in-view" && (
            <g fill="none" stroke="#fff" strokeWidth={r * 0.14}>
              <circle r={r * 0.45} />
              <line x1={-r * 0.32} y1={r * 0.32} x2={r * 0.32} y2={-r * 0.32} />
            </g>
          )}
          {v.missReason === "before-event" && (
            <g fill="none" stroke="#fff" strokeWidth={r * 0.14}>
              <circle r={r * 0.45} />
              <polyline points={`0,${-r * 0.3} 0,0 ${r * 0.25},${r * 0.12}`} />
            </g>
          )}
          {v.missReason === "not-recognised" && (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={r * 1.1}
              fontWeight={700}
              fill="#fff"
            >
              ?
            </text>
          )}
        </g>
      )}
      {v.falseAlarm && (
        <g
          transform={
            v.mark === "missed"
              ? `translate(${x + cw * 0.78} ${y + ch * 0.24}) scale(0.6)`
              : `translate(${cx} ${cy})`
          }
        >
          <title>False alarm: flagged as a hazard when there was none</title>
          <polygon
            points={`0,${-r} ${r * 0.95},${r * 0.75} ${-r * 0.95},${r * 0.75}`}
            fill="none"
            stroke="#ff5c8a"
            strokeWidth={r * 0.3}
            strokeLinejoin="round"
          />
          <polygon
            points={`0,${-r} ${r * 0.95},${r * 0.75} ${-r * 0.95},${r * 0.75}`}
            fill="none"
            stroke="#07121b"
            strokeWidth={r * 0.1}
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

/** Small legend swatch drawn with the same pattern as the map. */
function Swatch({ kind }: { kind: string }) {
  return (
    <svg className={styles.swatch} viewBox="0 0 22 16" aria-hidden="true">
      <defs>
        <pattern
          id={`hatch-${kind}`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="5"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.4"
          />
        </pattern>
      </defs>
      {kind === "downlinked" && (
        <rect
          width="22"
          height="16"
          fill="#9cc29a"
          stroke="#fff"
          strokeWidth="1"
        />
      )}
      {kind === "onboard" && (
        <rect
          x="1.5"
          y="1.5"
          width="19"
          height="13"
          fill="rgba(255,210,63,0.25)"
          stroke="#ffd23f"
          strokeWidth="2"
          strokeDasharray="3 2"
        />
      )}
      {kind === "blocked" && (
        <g>
          <rect width="22" height="16" fill="#e2e8f2" />
          <circle cx="8" cy="9" r="3" fill="#7d8aa0" />
          <circle cx="11.5" cy="7" r="4" fill="#7d8aa0" />
          <circle cx="15" cy="9.5" r="2.8" fill="#7d8aa0" />
        </g>
      )}
      {kind === "unseen" && (
        <g>
          <rect width="22" height="16" fill="#0b1220" />
          <rect width="22" height="16" fill={`url(#hatch-${kind})`} />
        </g>
      )}
      {kind === "look" && (
        <rect
          x="1.5"
          y="1.5"
          width="19"
          height="13"
          fill="none"
          stroke="#8ed5dc"
          strokeWidth="2.5"
        />
      )}
      {kind === "band" && (
        <rect
          x="1"
          y="3"
          width="20"
          height="10"
          fill="rgba(142,213,220,0.25)"
          stroke="#8ed5dc"
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}

function MarkerSwatch({ v, colour }: { v: Partial<CellView>; colour: string }) {
  const view = {
    mark: "none",
    falseAlarm: false,
    missReason: null,
    ...v,
  } as CellView;
  return (
    <svg
      className={`${styles.swatch} ${styles.markerSwatch}`}
      viewBox="0 0 20 16"
      aria-hidden="true"
    >
      <rect width="20" height="16" rx="3" fill="#2a3a4a" />
      <Marker v={view} x={2} y={0} cw={16} ch={16} hazardColour={colour} />
    </svg>
  );
}

export interface ObservationViewProps {
  mission: Mission;
  design: SatelliteDesign;
  resources: ResourceSummary;
  result: SimResult;
  hour: number;
  mode: "live" | "final";
  /** Decorative motion allowed (false under reduced motion or when paused). */
  animate: boolean;
  retask?: { day: number; quadrant: Quadrant };
  /** Rendered over the map (decision prompts). */
  overlay?: ReactNode;
  /** Show the final numbers panel (coverage, sent to Earth, deadline). */
  showSummary?: boolean;
}

/**
 * Simulated Observation: the REAL NASA reference image and YOUR SATELLITE'S
 * simulated observation on the same bbox, with a toggle, a before/after
 * slider, zoom and cell details. The simulated picture is built only from the
 * engine result and your design; NASA imagery is never presented as yours.
 */
export function ObservationView({
  mission,
  design,
  resources,
  result,
  hour,
  mode,
  animate,
  retask,
  overlay,
  showSummary = false,
}: ObservationViewProps) {
  const refs = useReferences(mission);
  const lst = refs?.lst ?? null;
  const story = getMissionStory(mission.slug);
  const hazard = story?.hazardNoun ?? "hazard";
  const hazardColour = `var(--hazard-${mission.category}, #ffb703)`;
  const span = mission.durationDays * 24;
  const at = mode === "final" ? span : Math.min(hour, span);
  const latency = downlinkLatency(result, resources);
  const { rows, columns } = useMemo(() => gridSize(mission), [mission]);
  const aspect = useMemo(() => viewAspect(mission.bbox), [mission.bbox]);
  const profile = useMemo(
    () => sensorProfile(design, result, lst !== null),
    [design, result, lst],
  );
  const views = useMemo(
    () => cellViews(mission, result, at, latency),
    [mission, result, at, latency],
  );
  const summary = useMemo(
    () => observationSummary(mission, result, latency),
    [mission, result, latency],
  );
  const windowHours = useMemo(() => observationWindowHours(design), [design]);
  const win = windowState(windowHours, at, span);
  const onboard = views.filter((v) => v.state === "onboard").length;
  const phase =
    mode === "final"
      ? "complete"
      : phaseAt({
          hour: at,
          span,
          windowOpen: win.open,
          onboardCells: onboard,
        });
  const caption = captionFor(
    phase,
    mission.city,
    profile.kind,
    result.score.coverage,
  );
  const band = mode === "live" ? footprintBand(design, at, windowHours) : null;

  const [view, setView] = useState<ViewMode>(
    mode === "final" ? "compare" : "sim",
  );
  const [realLayer, setRealLayer] = useState<RealLayer>("lst");
  const [split, setSplit] = useState(50);
  const [t, setT] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ row: number; column: number }>({
    row: Math.floor(rows / 2),
    column: Math.floor(columns / 2),
  });
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(0);

  const viewport = useRef<HTMLDivElement>(null);
  const realCanvas = useRef<HTMLCanvasElement>(null);
  const simCanvas = useRef<HTMLCanvasElement>(null);
  const baseCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(
    null,
  );
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    start: ViewTransform;
    dist?: number;
  } | null>(null);

  const hasLst = lst !== null;
  const showLstReal = hasLst && realLayer === "lst";
  const trueColourSrc = lst
    ? lst.trueColourSrc
    : refs
      ? refs.context.src
      : null;
  const trueColourBbox = lst ? lst.bbox : (refs?.context.bbox ?? mission.bbox);
  const trueColourImg = useImage(trueColourSrc);
  const lstImg = useImage(lst ? lst.src : null);

  // Track the viewport width for canvas resolution.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel / trackpad-pinch zoom needs Ctrl/⌘ at every zoom level; a plain
  // wheel always scrolls the page.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      setT((prev) => zoomAt(prev, Math.exp(-e.deltaY * 0.0025), fx, fy));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // REAL reference canvas.
  useEffect(() => {
    const c = realCanvas.current;
    if (!c || !width) return;
    const [pxW, pxH] = canvasSize(width, aspect);
    c.width = pxW;
    c.height = pxH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, pxW, pxH);
    if (trueColourImg)
      drawLayer(
        ctx,
        mission.bbox,
        { img: trueColourImg, bbox: trueColourBbox },
        pxW,
        pxH,
      );
    if (showLstReal && lstImg && lst)
      drawLayer(ctx, mission.bbox, { img: lstImg, bbox: lst.bbox }, pxW, pxH);
  }, [
    width,
    aspect,
    trueColourImg,
    trueColourBbox,
    lstImg,
    lst,
    showLstReal,
    mission.bbox,
  ]);

  // SIMULATED canvas: sensor picture at its detail level + engine cell states.
  useEffect(() => {
    const c = simCanvas.current;
    if (!c || !width) return;
    const [pxW, pxH] = canvasSize(width, aspect);
    c.width = pxW;
    c.height = pxH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, pxW, pxH);
    const layers: Layer[] = [];
    if (trueColourImg)
      layers.push({
        img: trueColourImg,
        bbox: trueColourBbox,
        dim: profile.layer === "lst",
      });
    if (profile.layer === "lst" && lstImg && lst)
      layers.push({ img: lstImg, bbox: lst.bbox });
    const ready = trueColourImg && (profile.layer !== "lst" || lstImg);
    if (ready) {
      const key = [
        mission.slug,
        profile.layer,
        profile.pixelsPerCell,
        layers.length,
      ].join("|");
      if (baseCache.current?.key !== key)
        baseCache.current = {
          key,
          canvas: buildSimBase(
            mission.bbox,
            layers,
            columns,
            rows,
            profile,
            aspect,
          ),
        };
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(baseCache.current.canvas, 0, 0, pxW, pxH);
    }
    drawStates(ctx, views, rows, columns, pxW, pxH, mode === "live");
  }, [
    width,
    trueColourImg,
    trueColourBbox,
    lstImg,
    lst,
    profile,
    views,
    rows,
    columns,
    mission.slug,
    mission.bbox,
    aspect,
    mode,
  ]);

  // ── Interaction ────────────────────────────────────────────────────
  const zoomed = t.scale > 1.001;
  const relPoint = (e: { clientX: number; clientY: number }) => {
    const rect = viewport.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      w: rect.width,
      h: rect.height,
    };
  };
  function selectAt(px: number, py: number) {
    const g = cellAtPoint(mission, t, px, py);
    if (!g) return;
    setSelected(g.id);
    setCursor({ row: g.row, column: g.column });
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      moved: pts.length > 1,
      start: t,
      dist:
        pts.length === 2
          ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          : undefined,
    };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const p = relPoint(e);
    if (pts.length === 2 && g.dist) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = relPoint({
        clientX: (pts[0].x + pts[1].x) / 2,
        clientY: (pts[0].y + pts[1].y) / 2,
      });
      setT(zoomAt(g.start, dist / g.dist, mid.x, mid.y));
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) > 5) g.moved = true;
    if (g.moved && g.start.scale > 1)
      setT(
        clampTransform({
          ...g.start,
          x: g.start.x + dx / p.w,
          y: g.start.y + dy / p.h,
        }),
      );
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    const single = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (g && single && !g.moved) {
      const p = relPoint(e);
      selectAt(p.x, p.y);
    }
    if (pointers.current.size === 0) gesture.current = null;
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Keys typed in the slider handle or a decision prompt belong to them.
    if (e.target !== e.currentTarget) return;
    const moves: Record<string, [number, number]> = {
      ArrowUp: [1, 0],
      ArrowDown: [-1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      if (e.shiftKey) {
        setT((prev) =>
          clampTransform({
            ...prev,
            x: prev.x - dc * 0.1,
            y: prev.y + dr * 0.1,
          }),
        );
        return;
      }
      setCursor((c) => ({
        row: Math.min(rows - 1, Math.max(0, c.row + dr)),
        column: Math.min(columns - 1, Math.max(0, c.column + dc)),
      }));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const g = mission.grid.find(
        (x) => x.row === cursor.row && x.column === cursor.column,
      );
      if (g) setSelected(g.id);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      setT((prev) => zoomAt(prev, 1.5));
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      setT((prev) => zoomAt(prev, 1 / 1.5));
    } else if (e.key === "0") {
      e.preventDefault();
      setT({ scale: 1, x: 0, y: 0 });
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSelected(null);
    }
  }
  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>) {
    const next = sliderKey(split, e.key);
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    setSplit(next);
  }
  function onHandlePointer(e: PointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (e.type === "pointerdown")
      e.currentTarget.setPointerCapture(e.pointerId);
    if (
      e.type === "pointermove" &&
      !e.currentTarget.hasPointerCapture(e.pointerId)
    )
      return;
    const p = relPoint(e);
    setSplit(Math.round(Math.min(100, Math.max(0, p.x * 100))));
  }

  // ── Derived display data ───────────────────────────────────────────
  const W = aspect * 100;
  const H = 100;
  const cw = W / columns;
  const ch = H / rows;
  const stageStyle = {
    transform: `translate(${t.x * 100}%, ${t.y * 100}%) scale(${t.scale})`,
  };
  const marked = views.filter((v) => v.mark !== "none" || v.falseAlarm);
  const selectedView = selected
    ? (views.find((v) => v.id === selected) ?? null)
    : null;
  const detail = selectedView
    ? cellDetail(
        selectedView,
        result.cells.find((c) => c.id === selectedView.id),
        mission,
        at,
        lst,
      )
    : null;
  const showReal = view !== "sim";
  const showSim = view !== "real";
  const simClip = view === "compare" ? `inset(0 0 0 ${split}%)` : undefined;
  const realDate = lst
    ? formatDate(lst.observedOn)
    : formatDate(refs?.context.observedOn);
  const realSourceShort = lst
    ? showLstReal
      ? `${lst.platform === "landsat-9" ? "Landsat 9" : "Landsat 8"} land surface temperature`
      : `${lst.platform === "landsat-9" ? "Landsat 9" : "Landsat 8"} true colour`
    : (refs?.context.source.replace(/^NASA GIBS \/ /, "") ?? "NASA imagery");
  const realTag = `REAL NASA OBSERVATION · reference${realDate ? ` · ${realDate}` : ""} · ${realSourceShort}`;
  const simTag = `YOUR SATELLITE'S OBSERVATION · simulated${mode === "live" ? ` · hour ${Math.floor(at)}` : ""}`;
  const counts = {
    downlinked: views.filter(
      (v) => v.state === "downlinked" || v.state === "observed",
    ).length,
    onboard,
    blocked: views.filter((v) => v.state === "blocked").length,
    unseen: views.filter((v) => v.state === "unseen").length,
    found: views.filter((v) => v.mark === "found").length,
  };
  const mapLabel =
    `${mission.city} observation map, north up. ${view === "real" ? realTag : view === "sim" ? simTag : `${realTag} on the left, ${simTag} on the right`}. ` +
    `Your satellite: ${counts.downlinked} cells observed and sent to Earth, ${counts.onboard} observed but not sent, ` +
    `${counts.blocked} blocked by cloud or smoke, ${counts.unseen} not observed, ${counts.found} ${hazard} zones confirmed. ` +
    "Use arrow keys to move between cells, Enter for details, plus and minus to zoom, Shift plus arrows to pan.";
  const quadRect = (() => {
    if (!retask || (mode === "live" && at < retask.day * 24)) return null;
    const north = retask.quadrant[0] === "n";
    const east = retask.quadrant[1] === "e";
    const westCols = Math.ceil(columns / 2);
    const southRows = Math.ceil(rows / 2);
    return {
      x: east ? westCols * cw : 0,
      y: north ? 0 : (rows - southRows) * ch,
      w: (east ? columns - westCols : westCols) * cw,
      h: (north ? rows - southRows : southRows) * ch,
    };
  })();
  const pct = (n: number) => `${Math.round(n)}%`;

  return (
    <div className={`${styles.wrap} ${animate ? styles.animate : ""}`}>
      <div className={styles.captionRow}>
        <ol className={styles.steps} aria-label="Observation steps">
          {PHASES.map((p, i) => {
            const current = PHASES.findIndex((x) => x.id === phase);
            return (
              <li
                key={p.id}
                aria-current={p.id === phase ? "step" : undefined}
                data-done={i < current ? "true" : undefined}
              >
                <span aria-hidden="true">{i < current ? "✓" : i + 1}</span>{" "}
                {p.label}
              </li>
            );
          })}
        </ol>
        <p className={styles.caption} role="status">
          {caption}
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Choose view">
          {(
            [
              ["compare", "Compare ⇆"],
              ["real", "Real NASA"],
              ["sim", "Your satellite"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {hasLst && showReal && (
          <div
            className={styles.segmented}
            role="group"
            aria-label="Real NASA layer"
          >
            <button
              type="button"
              aria-pressed={realLayer === "lst"}
              onClick={() => setRealLayer("lst")}
            >
              Surface temperature
            </button>
            <button
              type="button"
              aria-pressed={realLayer === "true-colour"}
              onClick={() => setRealLayer("true-colour")}
            >
              True colour
            </button>
          </div>
        )}
        <div className={styles.zoomGroup} role="group" aria-label="Zoom">
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Zoom in"
            disabled={t.scale >= ZOOM_MAX}
            onClick={() => setT((p) => zoomAt(p, 1.5))}
          >
            +
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Zoom out"
            disabled={t.scale <= ZOOM_MIN}
            onClick={() => setT((p) => zoomAt(p, 1 / 1.5))}
          >
            −
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            aria-label="Reset zoom"
            disabled={!zoomed}
            onClick={() => setT({ scale: 1, x: 0, y: 0 })}
          >
            ⟲
          </button>
        </div>
      </div>

      <div
        ref={viewport}
        className={styles.viewport}
        style={{ aspectRatio: `${aspect}` }}
        data-zoomed={zoomed ? "true" : "false"}
        tabIndex={0}
        role="group"
        aria-label={mapLabel}
        aria-roledescription="interactive map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <div className={styles.layer} hidden={!showReal}>
          <div className={styles.stage} style={stageStyle}>
            <canvas
              ref={realCanvas}
              className={styles.canvas}
              aria-hidden="true"
            />
          </div>
        </div>
        <div
          className={styles.layer}
          hidden={!showSim}
          style={{ clipPath: simClip }}
        >
          <div className={styles.stage} style={stageStyle}>
            <canvas
              ref={simCanvas}
              className={styles.canvas}
              data-pixelated="true"
              aria-hidden="true"
            />
            <svg
              className={styles.overlaySvg}
              viewBox={`0 0 ${W} ${H}`}
              aria-hidden="true"
            >
              {quadRect && (
                <rect
                  x={quadRect.x + 0.4}
                  y={quadRect.y + 0.4}
                  width={quadRect.w - 0.8}
                  height={quadRect.h - 0.8}
                  fill="none"
                  stroke="#cbf36b"
                  strokeWidth={0.8}
                  strokeDasharray="3 2"
                />
              )}
              {marked.map((v) => (
                <Marker
                  key={v.id}
                  v={v}
                  x={v.column * cw}
                  y={(rows - 1 - v.row) * ch}
                  cw={cw}
                  ch={ch}
                  hazardColour={hazardColour}
                />
              ))}
              {band && (
                <g>
                  <rect
                    className={styles.band}
                    x={0}
                    y={band.top * H}
                    width={W}
                    height={band.height * H}
                    vectorEffect="non-scaling-stroke"
                  />
                  <g
                    transform={`translate(${W * (0.35 + 0.3 * band.progress)} ${Math.max(3, band.top * H + (band.height * H) / 2)})`}
                  >
                    <rect
                      x={-5}
                      y={-1.4}
                      width={3.4}
                      height={2.8}
                      fill="#8ed5dc"
                      stroke="#07121b"
                      strokeWidth={0.4}
                    />
                    <rect
                      x={1.6}
                      y={-1.4}
                      width={3.4}
                      height={2.8}
                      fill="#8ed5dc"
                      stroke="#07121b"
                      strokeWidth={0.4}
                    />
                    <rect
                      x={-1.6}
                      y={-1.8}
                      width={3.2}
                      height={3.6}
                      rx={0.6}
                      fill="#e8ecff"
                      stroke="#07121b"
                      strokeWidth={0.5}
                    />
                  </g>
                </g>
              )}
              {selectedView && (
                <rect
                  x={selectedView.column * cw}
                  y={(rows - 1 - selectedView.row) * ch}
                  width={cw}
                  height={ch}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        </div>
        {focused && (
          <svg
            className={styles.overlaySvg}
            style={{ zIndex: 2 }}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden="true"
          >
            <g transform={`translate(${t.x * W} ${t.y * H}) scale(${t.scale})`}>
              <rect
                x={cursor.column * cw}
                y={(rows - 1 - cursor.row) * ch}
                width={cw}
                height={ch}
                fill="none"
                stroke="#cbf36b"
                strokeWidth={3}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        )}
        {view === "compare" && (
          <>
            <span className={styles.divider} style={{ left: `${split}%` }} />
            <button
              type="button"
              className={styles.handle}
              style={{ left: `${split}%` }}
              role="slider"
              aria-label="Comparison divider: real NASA image on the left, your simulated observation on the right"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={split}
              aria-valuetext={`${split}% real NASA image, ${100 - split}% your satellite`}
              aria-orientation="horizontal"
              onKeyDown={onHandleKey}
              onPointerDown={onHandlePointer}
              onPointerMove={onHandlePointer}
            >
              <span aria-hidden="true">⇆</span>
            </button>
          </>
        )}
        {showReal && (
          <span
            className={`${styles.tag} ${styles.tagReal} ${view === "real" ? styles.tagFull : ""}`}
            aria-hidden="true"
          >
            {realTag}
          </span>
        )}
        {showSim && (
          <span
            className={`${styles.tag} ${styles.tagSim} ${view === "sim" ? styles.tagFull : ""}`}
            aria-hidden="true"
          >
            {simTag}
          </span>
        )}
        <span className={styles.north} aria-hidden="true">
          N
        </span>
        {overlay && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {overlay}
          </div>
        )}
      </div>
      <p className={styles.hint}>
        Click or tap a cell for details (keyboard: arrows + Enter). Zoom with
        the buttons, pinch, or Ctrl/⌘ + scroll; drag to pan when zoomed.
        {view === "compare"
          ? " Drag the ⇆ divider (or use arrow keys on it) to compare."
          : ""}
      </p>

      {detail && selectedView && (
        <section
          className={styles.detail}
          aria-live="polite"
          aria-label="Cell details"
        >
          <h4>What happened in this cell</h4>
          <dl>
            {detail.map((l) => (
              <div key={l.label} style={{ display: "contents" }}>
                <dt>{l.label}</dt>
                <dd>{l.value}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className={styles.close}
            aria-label="Close cell details"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
        </section>
      )}

      <div className={styles.legend}>
        <div>
          <strong>Quick map key</strong>
          <ul className={styles.legendList} aria-label="Essential map symbols">
            <li>
              <MarkerSwatch v={{ mark: "found" }} colour={hazardColour} />{" "}
              Yellow target = your satellite confirmed a {hazard} zone
            </li>
            {mode === "live" ? (
              <li>
                <MarkerSwatch v={{ mark: "zone" }} colour={hazardColour} /> Blue
                dashed box = a known {hazard} zone not confirmed yet
              </li>
            ) : (
              <li>
                <MarkerSwatch
                  v={{ mark: "missed", missReason: "never-in-view" }}
                  colour={hazardColour}
                />{" "}
                White outlined symbol = a missed zone; the icon shows why
              </li>
            )}
            <li>
              <Swatch kind="unseen" /> Dark stripes = this cell has not been
              observed clearly
            </li>
          </ul>
        </div>
        {hasLst && lst && (showLstReal || profile.layer === "lst") && (
          <div className={styles.scale}>
            <strong>Land surface temperature (°C)</strong>
            <div
              className={styles.scaleBar}
              style={{ background: scaleGradient(lst.scale) }}
              aria-hidden="true"
            />
            <div className={styles.scaleTicks} aria-hidden="true">
              <span>≤{lst.scale.minC}</span>
              <span>{Math.round((lst.scale.minC + lst.scale.maxC) / 2)}</span>
              <span>≥{lst.scale.maxC} °C</span>
            </div>
            <span className={styles.hint}>
              Colour = temperature of the ground and rooftops measured by
              Landsat, from {lst.scale.minC} °C (dark blue) to {lst.scale.maxC}{" "}
              °C (dark red) — land surface temperature, not air temperature.
              Water and cloud have no value
              {profile.layer === "lst"
                ? " (grey in your satellite's view)"
                : ""}
              .
            </span>
          </div>
        )}
        <details>
          <summary>Detailed map key</summary>
          <ul
            className={styles.legendList}
            aria-label="Your satellite's observation legend"
          >
            <li>
              <Swatch kind="downlinked" /> Bright cell: observed and sent to
              Earth
            </li>
            <li>
              <Swatch kind="onboard" /> Gold dotted cell: observed, but data{" "}
              {mode === "final"
                ? "never reached Earth"
                : "is still on the satellite"}
            </li>
            <li>
              <Swatch kind="blocked" /> Cloud icon: every look was blocked by
              cloud or smoke
            </li>
            <li>
              <Swatch kind="unseen" /> Dark striped cell: not observed
            </li>
            {mode === "live" && (
              <li>
                <Swatch kind="look" /> Cyan outline: the sensor is looking at
                this cell now
              </li>
            )}
            {mode === "live" && (
              <li>
                <Swatch kind="band" /> Cyan dashed band: current sensor viewing
                area
              </li>
            )}
          </ul>
          <ul className={styles.legendList} aria-label="Hazard marker legend">
            <li>
              <MarkerSwatch v={{ mark: "found" }} colour={hazardColour} />{" "}
              Yellow target: {hazard} confirmed
            </li>
            {mode === "live" && (
              <li>
                <MarkerSwatch v={{ mark: "zone" }} colour={hazardColour} /> Blue
                dashed box: known {hazard} zone, not found yet
              </li>
            )}
            <li>
              <MarkerSwatch v={{ falseAlarm: true }} colour={hazardColour} />{" "}
              Pink triangle: false alarm
            </li>
            {mode === "final" && (
              <>
                <li>
                  <MarkerSwatch
                    v={{ mark: "missed", missReason: "cloud-blocked" }}
                    colour={hazardColour}
                  />{" "}
                  Cloud: hidden by cloud or smoke
                </li>
                <li>
                  <MarkerSwatch
                    v={{ mark: "missed", missReason: "never-in-view" }}
                    colour={hazardColour}
                  />{" "}
                  Slashed circle: never in view
                </li>
                <li>
                  <MarkerSwatch
                    v={{ mark: "missed", missReason: "not-recognised" }}
                    colour={hazardColour}
                  />{" "}
                  Question mark: seen but not recognised
                </li>
                <li>
                  <MarkerSwatch
                    v={{ mark: "missed", missReason: "before-event" }}
                    colour={hazardColour}
                  />{" "}
                  Clock: checked before the event started
                </li>
              </>
            )}
          </ul>
        </details>
        <p className={styles.source}>
          <strong>Your satellite (simulated):</strong>{" "}
          {profile.instrument?.name ?? "No instrument"} {profile.measures}.
          Detail: about {profile.pixelsPerCell}×{profile.pixelsPerCell} pixels
          per grid cell (catalog detail × orbit factor {profile.detailFactor};
          illustrative, not metres). Data reaches Earth{" "}
          {Math.round(latency * 10) / 10} h after a clear look (engine radio
          delay).{profile.note ? ` ${profile.note}` : ""} Background pixels are
          the real NASA reference, coarsened to your sensor&apos;s detail; only
          the look, cloud and hazard overlays come from the simulation.
        </p>
        <p className={styles.source}>
          <strong>Real NASA reference:</strong>{" "}
          {lst ? (
            <>
              {lst.source}, scene {lst.productId}, acquired{" "}
              {lst.acquired.slice(0, 16).replace("T", " ")} UTC. Processed from
              Collection 2 Level-2 surface temperature (DN × 0.00341802 + 149
              K).{" "}
              <a href={lst.url} target="_blank" rel="noreferrer">
                STAC item ↗
              </a>{" "}
              · <a href={`/nasa/${mission.slug}-lst.json`}>provenance ↗</a>
              {lst.landingPage && (
                <>
                  {" "}
                  ·{" "}
                  <a href={lst.landingPage} target="_blank" rel="noreferrer">
                    about Landsat surface temperature ↗
                  </a>
                </>
              )}
              . {lst.usage}
            </>
          ) : refs ? (
            <>
              {refs.contextLoaded
                ? refs.context.source
                : "Image details could not be loaded"}
              {refs.context.observedOn
                ? `, observed ${formatDate(refs.context.observedOn)}`
                : ""}
              . <a href={`/nasa/${mission.slug}.json`}>provenance ↗</a>.{" "}
              {refs.context.usage}
            </>
          ) : (
            "Loading reference details…"
          )}{" "}
          It is a real picture for comparison — it was not taken by your
          satellite.
        </p>
      </div>

      {showSummary && (
        <dl className={styles.stats} aria-label="Observation results (engine)">
          <div>
            <dt>COVERAGE</dt>
            <dd>{pct(summary.coveragePct)}</dd>
            <small>
              {summary.observedCells} of {summary.totalCells} cells seen clearly
              (coverage score {summary.coveragePct}/100)
            </small>
          </div>
          <div>
            <dt>SENT TO EARTH</dt>
            <dd>{summary.timed ? pct(summary.downlinkedPct) : "—"}</dd>
            <small>
              {summary.timed
                ? `${summary.downlinkedCells} cells' data landed before the mission ended; ${summary.notDownlinkedCells} stayed on board`
                : "This saved attempt has no pass timing"}
            </small>
          </div>
          <div>
            <dt>FIRST DELIVERY</dt>
            <dd>
              {summary.firstDeliveryHours === null
                ? "none"
                : `h ${summary.firstDeliveryHours}`}
            </dd>
            <small>
              Target {summary.deadlineHours} h ·{" "}
              {summary.deadlineMet === null
                ? "no confirmed data reached Earth"
                : summary.deadlineMet
                  ? "✓ on time"
                  : "✕ late"}
            </small>
          </div>
          <div>
            <dt>{hazard.toUpperCase()} ZONES</dt>
            <dd>
              {summary.hazardFound} / {summary.hazardCells}
            </dd>
            <small>
              confirmed · {summary.falseAlarms} false alarm
              {summary.falseAlarms === 1 ? "" : "s"}
            </small>
          </div>
          {summary.dataMargin !== null && summary.dataMargin < 1 && (
            <div>
              <dt>DATA BOTTLENECK</dt>
              <dd>{pct(summary.dataMargin * 100)}</dd>
              <small>
                Your radio and storage can move only this share of the data
                collected each day (engine data margin). The engine applies this
                to the whole mission, not to particular cells.
              </small>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
