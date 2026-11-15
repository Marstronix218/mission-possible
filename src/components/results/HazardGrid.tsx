import type { Mission, SimCellResult, TimelinePoint } from "@/types/game";
import { BLOCKED_CLOUD_PROBABILITY } from "@/lib/story/events";
import styles from "./HazardGrid.module.css";

type CellState = "pending" | "unseen" | "clear" | "found" | "falseAlarm" | "missed" | "blocked";

const glyph: Record<CellState, string> = {
  pending: "",
  unseen: "",
  clear: "",
  found: "!",
  falseAlarm: "?",
  missed: "×",
  blocked: "",
};

const legend: { state: CellState; label: string }[] = [
  { state: "found", label: "! Hazard found" },
  { state: "missed", label: "× Hazard missed" },
  { state: "blocked", label: "Striped: hazard likely hidden by smoke/cloud" },
  { state: "falseAlarm", label: "? False alarm" },
  { state: "clear", label: "Solid: seen, all clear" },
  { state: "unseen", label: "Dark: never seen" },
];

/**
 * Simulated hazard map: north is up, matching the ground track.
 * State is shown by symbol and pattern as well as color.
 */
export function HazardGrid({
  mission,
  cells,
  reveal = 1,
  track,
  label,
}: {
  mission: Mission;
  cells: SimCellResult[];
  /** 0..1 share of cells revealed (illustrative order). */
  reveal?: number;
  track?: TimelinePoint[];
  label: string;
}) {
  const gridById = new Map(mission.grid.map((c) => [c.id, c]));
  const rows = mission.grid.reduce((max, c) => Math.max(max, c.row), 0) + 1;
  const columns = mission.grid.reduce((max, c) => Math.max(max, c.column), 0) + 1;
  const revealed = Math.floor(reveal * cells.length);
  const states = cells.map((c, i): CellState => {
    if (i >= revealed) return "pending";
    const hazard = c.truth > 0.5;
    if (c.detected) return hazard ? "found" : "falseAlarm";
    if (hazard) {
      if (!c.observed && (gridById.get(c.id)?.cloudProbability ?? 0) >= BLOCKED_CLOUD_PROBABILITY) return "blocked";
      return "missed";
    }
    return c.observed ? "clear" : "unseen";
  });
  const count = (s: CellState) => states.filter((x) => x === s).length;
  const summary =
    `${label}. ${count("found")} hazard cells found, ${count("missed")} missed, ${count("blocked")} likely hidden by smoke or cloud, ` +
    `${count("falseAlarm")} false alarms, ${count("clear")} seen clear, ${count("unseen")} never seen` +
    (count("pending") ? `, ${count("pending")} not yet shown.` : ".");
  const [west, south, east, north] = mission.bbox;
  const point = (p: { lon: number; lat: number }) =>
    [((p.lon - west) / (east - west)) * 100, ((north - p.lat) / (north - south)) * 100] as const;
  const last = track?.length ? point(track[track.length - 1]) : null;
  return (
    <div>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        role="img"
        aria-label={summary}
      >
        {cells.map((c, i) => {
          const source = gridById.get(c.id);
          return (
            <span
              key={c.id}
              className={`${styles.cell} ${styles[states[i]]}`}
              style={source ? { gridRow: rows - source.row, gridColumn: source.column + 1 } : undefined}
              aria-hidden="true"
            >
              {glyph[states[i]]}
            </span>
          );
        })}
        {track && track.length > 0 && last && (
          <svg className={styles.track} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points={track.map((p) => point(p).join(",")).join(" ")}
              fill="none"
              stroke="#f8cd76"
              strokeWidth="0.6"
              strokeDasharray="1.5 1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={last[0]} cy={last[1]} r="1.6" fill="#fff0a5" stroke="#0b1722" strokeWidth="0.4" />
          </svg>
        )}
      </div>
      <ul className={styles.legend} aria-label="Map legend">
        {legend.map((item) => (
          <li key={item.state}>
            <span className={`${styles.cell} ${styles.swatch} ${styles[item.state]}`} aria-hidden="true">
              {glyph[item.state]}
            </span>
            {item.label}
          </li>
        ))}
        {track && (
          <li>
            <span aria-hidden="true" style={{ color: "#f8cd76" }}>
              ●┄
            </span>
            Satellite ground track
          </li>
        )}
      </ul>
    </div>
  );
}
