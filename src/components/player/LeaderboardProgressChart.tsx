import { useId } from "react";
import type { ProgressGroup } from "@/lib/leaderboard/progress";
import { scoreComponentLabels } from "@/lib/leaderboard/progress";

const W = 360;
const H = 200;
const M = { top: 14, right: 14, bottom: 40, left: 46 };
const fmt = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1);

/**
 * Score-over-attempts line chart for one comparable group (same mission,
 * difficulty and engine). Circles mark attempts and a diamond marks the best
 * one, so meaning never depends on color; the table below repeats the data.
 */
export function LeaderboardProgressChart({
  group,
  title,
}: {
  group: ProgressGroup;
  title: string;
}) {
  const id = useId();
  const { points } = group;
  const n = points.length;
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (i: number) =>
    M.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (score: number) => M.top + plotH - (score / 100) * plotH;
  const step = Math.max(1, Math.ceil(n / 10));
  const best = points.find((p) => p.best);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: 520, display: "block" }}
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
      >
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>
          {`${n} attempt${n === 1 ? "" : "s"}, scores ${points
            .map((p) => p.score.toFixed(1))
            .join(", ")}. Best ${group.best.toFixed(1)}, latest ${group.latest.toFixed(1)}.`}
        </desc>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity={t === 0 ? 0.6 : 0.15}
            />
            <text
              x={M.left - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              fill="currentColor"
            >
              {t}
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={M.left}
          y1={M.top}
          y2={M.top + plotH}
          stroke="currentColor"
          strokeOpacity={0.6}
        />
        {points.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={p.id}
              x={x(i)}
              y={M.top + plotH + 14}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
            >
              {p.n}
            </text>
          ) : null,
        )}
        <text
          x={M.left + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
        >
          Attempt number
        </text>
        <text
          transform={`translate(12 ${M.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11"
          fill="currentColor"
        >
          Score (0–100)
        </text>
        {n > 1 && (
          <polyline
            fill="none"
            stroke="var(--pop-cyan)"
            strokeWidth={2.5}
            points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")}
          />
        )}
        {points.map((p, i) =>
          p.best ? (
            <path
              key={p.id}
              d={`M${x(i)} ${y(p.score) - 8}l8 8-8 8-8-8z`}
              fill="var(--pop-yellow)"
              stroke="var(--space-950)"
              strokeWidth={1.5}
            />
          ) : (
            <circle
              key={p.id}
              cx={x(i)}
              cy={y(p.score)}
              r={4.5}
              fill="var(--space-950)"
              stroke="var(--pop-cyan)"
              strokeWidth={2}
            />
          ),
        )}
      </svg>
      <figcaption className="muted text-sm">
        ● attempt · ◆ best attempt
        {best ? ` (attempt ${best.n}, ${best.score.toFixed(1)} points)` : ""}
      </figcaption>
      <details className="mt-2">
        <summary>Show attempts as a table</summary>
        <div className="table-scroll">
          <table>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Attempt</th>
                <th scope="col">Date</th>
                <th scope="col">Score</th>
                <th scope="col">Change</th>
                <th scope="col">Components that changed</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    {p.n}
                    {p.best && " ◆ best"}
                  </th>
                  <td>{new Date(p.at).toLocaleDateString("en-US")}</td>
                  <td>{p.score.toFixed(1)}</td>
                  <td>
                    {p.delta === null ? "First attempt" : `${fmt(p.delta)} points`}
                  </td>
                  <td>
                    {p.delta === null
                      ? "—"
                      : !p.breakdown
                        ? "Breakdown not saved"
                        : p.changes.length
                        ? p.changes
                            .map(
                              (c) =>
                                `${scoreComponentLabels[c.component]} ${fmt(c.delta)}`,
                            )
                            .join(", ")
                        : "No component changed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
