import { useId } from "react";
import type { PerfAxis } from "./component-performance";

export interface RadarSeries {
  name: string;
  /** installed = solid cyan; alternative = dashed amber. Line style + legend text, never colour alone. */
  kind: "installed" | "alternative";
  axes: PerfAxis[];
}

export const seriesStyle = {
  installed: {
    stroke: "#8ed5dc",
    fill: "#8ed5dc40",
    dash: undefined,
    width: 2.5,
  },
  alternative: {
    stroke: "#ffc67b",
    fill: "#ffc67b26",
    dash: "6 4",
    width: 2.5,
  },
} as const;

function point(
  i: number,
  n: number,
  value: number,
  cx: number,
  cy: number,
  r: number,
) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const v = Math.max(0, Math.min(100, value)) / 100;
  return { x: cx + Math.cos(a) * r * v, y: cy + Math.sin(a) * r * v };
}

function polygon(values: number[], cx: number, cy: number, r: number) {
  return values
    .map((v, i) => {
      const p = point(i, values.length, v, cx, cy, r);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

/** Split a label into ≤ 2 short lines for the SVG. */
function lines(label: string): string[] {
  const words = label.split(" ");
  if (words.length < 2 || label.length <= 12) return [label];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

/**
 * Radar of relative component characteristics with 3–5 axes. "mini" draws the
 * shape only (for cards); "full" adds axis labels and values.
 */
export function ComponentRadar({
  series,
  label,
  size = "full",
  decorative = false,
}: {
  series: RadarSeries[];
  label: string;
  size?: "mini" | "full";
  /** Hide from assistive tech when an accessible version is shown nearby. */
  decorative?: boolean;
}) {
  const id = useId();
  const axes = series[0]?.axes ?? [];
  const n = axes.length;
  if (n < 3) return null;
  const mini = size === "mini";
  const [w, h, cx, cy, r] = mini
    ? [100, 100, 50, 50, 44]
    : [340, 270, 170, 135, 82];
  const summary = series
    .map(
      (s) =>
        `${s.name} (${s.kind === "installed" ? "installed, solid" : "alternative, dashed"}): ${s.axes.map((a) => `${a.label} ${Math.round(a.value)}`).join(", ")}`,
    )
    .join(". ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-labelledby={decorative ? undefined : id}
      className={
        mini
          ? "h-24 w-24 shrink-0"
          : "mx-auto block h-auto w-full max-w-[340px]"
      }
    >
      {!decorative && (
        <title
          id={id}
        >{`${label}. Relative component characteristics on a 0 to 100 scale, not the mission score. ${summary}.`}</title>
      )}
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={polygon(Array(n).fill(ring), cx, cy, r)}
          fill="none"
          stroke="#6c8da0"
          strokeOpacity={ring === 100 ? 0.7 : 0.35}
        />
      ))}
      {axes.map((axis, i) => {
        const p = point(i, n, 100, cx, cy, r);
        return (
          <line
            key={axis.id}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="#597486"
            strokeOpacity=".7"
          />
        );
      })}
      {series.map((s, si) => {
        const style = seriesStyle[s.kind];
        return (
          <g key={`${s.name}-${si}`}>
            <polygon
              points={polygon(
                s.axes.map((a) => a.value),
                cx,
                cy,
                r,
              )}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={mini ? 2 : style.width}
              strokeDasharray={style.dash}
              strokeLinejoin="round"
            />
            {!mini &&
              s.axes.map((a, i) => {
                const p = point(i, n, a.value, cx, cy, r);
                return s.kind === "installed" ? (
                  <circle
                    key={a.id}
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill={style.stroke}
                  />
                ) : (
                  <rect
                    key={a.id}
                    x={p.x - 3.5}
                    y={p.y - 3.5}
                    width="7"
                    height="7"
                    fill={style.stroke}
                  />
                );
              })}
          </g>
        );
      })}
      {!mini &&
        axes.map((axis, i) => {
          const p = point(i, n, 100, cx, cy, r + 30);
          const anchor =
            Math.abs(p.x - cx) < 8 ? "middle" : p.x > cx ? "start" : "end";
          const x =
            anchor === "start" ? p.x - 14 : anchor === "end" ? p.x + 14 : p.x;
          const text = lines(axis.label);
          const values = series
            .map((s) => Math.round(s.axes[i]?.value ?? 0))
            .join(" / ");
          return (
            <text
              key={axis.id}
              x={x}
              y={p.y - (text.length - 1) * 6}
              textAnchor={anchor}
              fontSize="11"
              fill="currentColor"
            >
              {text.map((line, li) => (
                <tspan key={li} x={x} dy={li ? 12 : 0} fontWeight="700">
                  {line}
                </tspan>
              ))}
              <tspan x={x} dy="12" fill="#b9c8d3">
                {values}
              </tspan>
            </text>
          );
        })}
    </svg>
  );
}
