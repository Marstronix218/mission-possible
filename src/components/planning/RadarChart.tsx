"use client";
import { useId } from "react";
import { radarPoint, radarPolygon, type RadarAxis } from "./radar-model";
import styles from "./planning.module.css";
export function RadarChart({
  axes,
  comparison,
  label,
  onSelect,
  active = 0,
  animate = false,
}: {
  axes: RadarAxis[];
  comparison?: RadarAxis[];
  label: string;
  onSelect?: (index: number) => void;
  active?: number;
  animate?: boolean;
}) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 360 310"
      className={styles.radar}
      role="group"
      aria-labelledby={id}
    >
      <title id={id}>{`${label}. Each axis uses a 0 to 100 scale.`}</title>
      {[25, 50, 75, 100].map((n) => (
        <polygon
          key={n}
          points={radarPolygon(axes.map(() => n))}
          fill="none"
          stroke="#6c8da0"
          strokeOpacity=".5"
        />
      ))}
      <text x="186" y="149" className={styles.scale}>
        0
      </text>
      <text x="186" y="99" className={styles.scale}>
        50
      </text>
      <text x="186" y="43" className={styles.scale}>
        100
      </text>
      {axes.map((a, i) => {
        const p = radarPoint(i, 100, 104, axes.length);
        return (
          <line
            key={a.id}
            x1="180"
            y1="150"
            x2={p.x}
            y2={p.y}
            stroke="#597486"
          />
        );
      })}
      {comparison && (
        <polygon
          points={radarPolygon(comparison.map((a) => a.value))}
          fill="#f5b76522"
          stroke="#ffc67b"
          strokeWidth="2.5"
          strokeDasharray="6 4"
        />
      )}
      <polygon
        className={animate ? styles.grow : undefined}
        points={radarPolygon(axes.map((a) => a.value))}
        fill="#75dce54d"
        stroke="#8cedf0"
        strokeWidth="3"
      />
      {axes.map((axis, i) => {
        const p = radarPoint(i, axis.value, 104, axes.length);
        const t = radarPoint(i, 128, 104, axes.length);
        return (
          <g key={axis.id}>
            <text
              x={t.x}
              y={t.y - 4}
              textAnchor="middle"
              className={styles.axisLabel}
            >
              {axis.label}
            </text>
            <text
              x={t.x}
              y={t.y + 13}
              textAnchor="middle"
              className={styles.axisValue}
            >
              {Math.round(axis.value)}
            </text>
            {onSelect ? (
              <circle
                cx={p.x}
                cy={p.y}
                r={active === i ? 8 : 6}
                fill={active === i ? "#d5f985" : "#8cedf0"}
                stroke="#10212e"
                strokeWidth="2"
                tabIndex={0}
                role="button"
                aria-label={`${axis.label}: ${axis.value} out of 100. Explain score`}
                onMouseEnter={() => onSelect(i)}
                onFocus={() => onSelect(i)}
                onClick={() => onSelect(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(i);
                  }
                }}
              />
            ) : (
              <circle cx={p.x} cy={p.y} r="4" fill="#8cedf0" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
